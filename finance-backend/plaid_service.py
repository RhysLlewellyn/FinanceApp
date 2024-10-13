import plaid
from plaid.exceptions import ApiException
from plaid.api import plaid_api
from plaid.api_client import ApiClient, ApiException
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.model.account_subtype import AccountSubtype
from plaid.model.account_type import AccountType
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.transactions_get_request import TransactionsGetRequest
from plaid.model.transactions_get_request_options import TransactionsGetRequestOptions
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.country_code import CountryCode
from plaid.model.sandbox_public_token_create_request import SandboxPublicTokenCreateRequest
from plaid.model.sandbox_public_token_create_request_options import SandboxPublicTokenCreateRequestOptions
import os
from datetime import datetime, timedelta
from models import db, Transaction, Account, PlaidItem

def create_plaid_client():
    configuration = plaid.Configuration(
        host=plaid.Environment.Sandbox,  # Change this to Development or Production when ready
        api_key={
            'clientId': os.getenv('PLAID_CLIENT_ID'),
            'secret': os.getenv('PLAID_SECRET'),
        }
    )
    api_client = plaid.ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)

def create_link_token(user_id, logger):
    client = create_plaid_client()
    logger.info(f"Creating link token for user {user_id}")
    try:
        request = LinkTokenCreateRequest(
            products=[Products('transactions')],
            client_name='Alpha Finance',
            country_codes=[CountryCode('GB')],
            language='en',
            user=LinkTokenCreateRequestUser(
                client_user_id=str(user_id)
            )
        )
        logger.debug(f"Link token request: {request}")
        response = client.link_token_create(request)
        logger.info(f"Link token created successfully for user {user_id}")
        return response['link_token']
    except plaid.ApiException as e:
        logger.error(f"Plaid API error in create_link_token: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error in create_link_token: {str(e)}")
        raise

def create_sandbox_public_token():
    client = create_plaid_client()
    request = SandboxPublicTokenCreateRequest(
        institution_id='ins_109508',
        initial_products=[Products('transactions')],
        options=SandboxPublicTokenCreateRequestOptions(
            webhook='https://example.com/webhook'
        )
    )
    response = client.sandbox_public_token_create(request)
    return response['public_token']

def exchange_public_token(public_token, logger):
    client = create_plaid_client()
    exchange_response = client.item_public_token_exchange(
        plaid.model.item_public_token_exchange_request.ItemPublicTokenExchangeRequest(
            public_token=public_token
        )
    )
    access_token = exchange_response['access_token']
    item_id = exchange_response['item_id']
    return access_token, item_id

def fetch_and_store_transactions(access_token, user_id, logger):
    client = create_plaid_client()
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=30)

    try:
        logger.info(f"Fetching transactions for user {user_id} from {start_date} to {end_date}")
        transactions = get_transactions_from_plaid(access_token, start_date, end_date, logger)
        # Process transactions...
        logger.info(f"Stored {len(transactions)} transactions for user {user_id}")
        return len(transactions)
    except Exception as e:
        logger.error(f"Error in fetch_and_store_transactions: {str(e)}")
        raise

def handle_plaid_error(e, logger):
    error_type = getattr(e, 'type', 'UNKNOWN')
    error_code = getattr(e, 'code', 'UNKNOWN')
    error_message = str(e)

    logger.error(f"Plaid Error: Type: {error_type}, Code: {error_code}, Message: {error_message}")

    if error_type == "ITEM_ERROR":
        if error_code == "ITEM_LOGIN_REQUIRED":
            return "Your bank requires re-authentication. Please update your credentials and try again.", 400
        elif error_code == "ITEM_NOT_FOUND":
            return "There was an issue with the financial institution. Please try again later.", 503
        elif error_code == "API_ERROR":
            return "There was an issue with the Plaid API. Please try again later.", 503
        elif error_code == "RATE_LIMIT_EXCEEDED":
            return "Too many requests. Please try again later.", 429
        
        return f"An error occurred: {error_message}", 500

def get_account_info_from_plaid(access_token, logger):
    try:
        client = create_plaid_client()
        logger.info("Fetching account info from Plaid")
        request = AccountsGetRequest(access_token=access_token)
        response = client.accounts_get(request)
        
        accounts_info = []
        for account in response['accounts']:
            accounts_info.append({
                'name': account['name'],
                'balance': account['balances']['current'],
                'account_id': account['account_id'],
                'type': str(account['type']),  # Convert to string
                'subtype': str(account.get('subtype', ''))  # Convert to string, use empty string if None
            })
        
        logger.info("Account info fetched successfully")
        return accounts_info
    except ApiException as e:  # Update this exception
        logger.error(f"Error fetching account info from Plaid: {str(e)}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected error fetching account info from Plaid: {str(e)}")
        raise e

def get_transactions_from_plaid(access_token, start_date, end_date, logger):
    try:
        client = create_plaid_client()
        start_date = (datetime.now() - timedelta(days=30)).date()
        end_date = datetime.now().date()

        # Convert dates to string format expected by Plaid
        start_date_str = start_date.strftime('%Y-%m-%d')
        end_date_str = end_date.strftime('%Y-%m-%d')
        
        request = TransactionsGetRequest(
            access_token=access_token,
            start_date=start_date,
            end_date=end_date,
            options=TransactionsGetRequestOptions()
        )
        response = client.transactions_get(request)
        transactions = response['transactions']
        
        while len(transactions) < response['total_transactions']:
            request = TransactionsGetRequest(
                access_token=access_token,
                start_date=start_date,
                end_date=end_date,
                options=TransactionsGetRequestOptions(
                    offset=len(transactions)
                )
            )
            response = client.transactions_get(request)
            transactions.extend(response['transactions'])
        
        logger.info(f"Transactions fetched successfully")
        return transactions
    except plaid.ApiException as e:
        logger.error(f"Error fetching transactions from Plaid: {str(e)}")
        raise

def insert_transaction(transaction_data, logger):
    account = Account.query.filter_by(plaid_account_id=transaction_data['account_id']).first()
    if not account:
        logger.warning(f"Account not found for plaid_account_id: {transaction_data['account_id']}")
        # Option 1: Skip the transaction
        return None
        
        # Option 2: Create a placeholder account
        # account = Account(user_id=transaction_data['user_id'], plaid_account_id=transaction_data['account_id'], name="Placeholder")
        # db.session.add(account)
        # db.session.flush()  # This will assign an ID to the account without committing the transaction
    
    new_transaction = Transaction(
        user_id=transaction_data['user_id'],
        account_id=account.id,  # Use the database ID, not the Plaid account ID
        transaction_id=transaction_data['transaction_id'],
        amount=transaction_data['amount'],
        date=transaction_data['date'],
        name=transaction_data['name'],
        category=transaction_data['category'][0] if transaction_data['category'] else None,
    )
    db.session.add(new_transaction)
    return new_transaction

def update_transactions():
    with app.app_context():
        plaid_items = PlaidItem.query.all()
        for plaid_item in plaid_items:
            try:
                access_token = plaid_item.access_token
                start_date = (datetime.now() - timedelta(days=30)).date()
                end_date = datetime.now().date()

                transactions = get_transactions_from_plaid(access_token, start_date, end_date, app.logger)

                for transaction in transactions:
                    existing_transaction = Transaction.query.filter_by(transaction_id=transaction['transaction_id']).first()
                    if not existing_transaction:
                        insert_transaction({
                            'user_id': plaid_item.user_id,
                            'account_id': transaction['account_id'],
                            'transaction_id': transaction['transaction_id'],
                            'amount': transaction['amount'],
                            'date': transaction['date'],
                            'name': transaction['name'],
                            'category': transaction['category']
                        }, app.logger)
                
                db.session.commit()
                app.logger.info(f"Updated transactions for PlaidItem {plaid_item.id}")
            except Exception as e:
                app.logger.error(f"Error updating transactions for PlaidItem {plaid_item.id}: {str(e)}")
                db.session.rollback()

def sync_accounts(user_id, access_token, logger):
    try:
        plaid_accounts = get_account_info_from_plaid(access_token, logger)
        plaid_item = PlaidItem.query.filter_by(user_id=user_id, access_token=access_token).first()
        
        if not plaid_item:
            logger.error(f"No PlaidItem found for user {user_id} with the given access token")
            raise ValueError("No PlaidItem found for the given access token")
        
        for plaid_account in plaid_accounts:
            db_account = Account.query.filter_by(plaid_account_id=plaid_account['account_id']).first()
            if db_account:
                # Update existing account
                db_account.name = plaid_account['name']
                db_account.balance = plaid_account['balance']
                db_account.type = plaid_account['type']
                db_account.subtype = plaid_account['subtype']
            else:
                # Create new account
                new_account = Account(
                    user_id=user_id,
                    plaid_item_id=plaid_item.id,  # Add this line
                    plaid_account_id=plaid_account['account_id'],
                    name=plaid_account['name'],
                    balance=plaid_account['balance'],
                    type=plaid_account['type'],
                    subtype=plaid_account['subtype']
                )
                db.session.add(new_account)
        
        db.session.commit()
        logger.info(f"Synchronized accounts for user {user_id}")
    except Exception as e:
        logger.error(f"Error synchronizing accounts for user {user_id}: {str(e)}")
        db.session.rollback()
        raise
