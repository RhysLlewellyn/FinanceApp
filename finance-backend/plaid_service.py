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
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
import os
import time
from datetime import datetime, timedelta
from models import db, Transaction, Account, PlaidItem
import traceback

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
    try:
        client = create_plaid_client()
        # Create the proper request object
        request = ItemPublicTokenExchangeRequest(
            public_token=public_token
        )
        exchange_response = client.item_public_token_exchange(request)
        logger.debug("Successfully exchanged public token")
        return exchange_response['access_token'], exchange_response['item_id']
    except plaid.ApiException as e:
        logger.error(f"Plaid API error in exchange_public_token: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Error in exchange_public_token: {str(e)}")
        raise

def fetch_and_store_transactions(access_token, user_id, logger, start_date=None, end_date=None):
    try:
        if start_date is None:
            start_date = (datetime.now() - timedelta(days=30)).date()
        if end_date is None:
            end_date = datetime.now().date()

        logger.info(f"Fetching transactions for user {user_id} from {start_date} to {end_date}")
        
        # Get transactions from Plaid
        transactions = get_transactions_from_plaid(access_token, start_date, end_date, logger)
        
        # Get all accounts for this user
        accounts = {account.plaid_account_id: account.id for account in 
                   Account.query.filter_by(user_id=user_id).all()}
        
        stored_count = 0
        for plaid_transaction in transactions:
            # Skip if transaction already exists
            existing = Transaction.query.filter_by(
                transaction_id=plaid_transaction['transaction_id']
            ).first()
            
            if existing:
                continue
                
            # Get the internal account ID
            account_id = accounts.get(plaid_transaction['account_id'])
            if not account_id:
                logger.warning(f"Account not found for transaction {plaid_transaction['transaction_id']}")
                continue
            
            # Handle date fields properly
            transaction_date = plaid_transaction['date']
            if isinstance(transaction_date, str):
                transaction_date = datetime.strptime(transaction_date, '%Y-%m-%d').date()
            elif isinstance(transaction_date, datetime):
                transaction_date = transaction_date.date()
                
            # Handle authorized_date
            authorized_date = plaid_transaction.get('authorized_date')
            if authorized_date:
                if isinstance(authorized_date, str):
                    authorized_date = datetime.strptime(authorized_date, '%Y-%m-%d').date()
                elif isinstance(authorized_date, datetime):
                    authorized_date = authorized_date.date()

            # Invert the amount
            amount = -float(plaid_transaction['amount'])
            
            new_transaction = Transaction(
                user_id=user_id,
                account_id=account_id,
                transaction_id=plaid_transaction['transaction_id'],
                amount=amount,
                date=transaction_date,
                name=plaid_transaction['name'],
                category=plaid_transaction.get('personal_finance_category', {}).get('primary', 'UNCATEGORIZED'),
                subcategory=plaid_transaction.get('personal_finance_category', {}).get('detailed', None),
                pending=plaid_transaction.get('pending', False),
                merchant_name=plaid_transaction.get('merchant_name'),
                payment_channel=plaid_transaction.get('payment_channel', 'OTHER'),
                location_city=plaid_transaction.get('location', {}).get('city'),
                location_region=plaid_transaction.get('location', {}).get('region'),
                location_country=plaid_transaction.get('location', {}).get('country'),
                authorized_date=authorized_date,
                logo_url=plaid_transaction.get('logo_url'),
                website=plaid_transaction.get('website'),
                iso_currency_code=plaid_transaction.get('iso_currency_code')
            )
            
            db.session.add(new_transaction)
            stored_count += 1
            
        db.session.commit()
        logger.info(f"Successfully stored {stored_count} new transactions for user {user_id}")
        return stored_count
        
    except Exception as e:
        logger.error(f"Error in fetch_and_store_transactions: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        db.session.rollback()
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
        response = client.accounts_get(access_token)
        logger.info(f"Plaid response: {response}")
        return response['accounts']
    except Exception as e:
        logger.error(f"Error getting account info from Plaid: {str(e)}")
        raise

def get_transactions_from_plaid(access_token, start_date, end_date, logger):
    try:
        client = create_plaid_client()
        
        request = TransactionsGetRequest(
            access_token=access_token,
            start_date=start_date,
            end_date=end_date,
            options=TransactionsGetRequestOptions(
                include_personal_finance_category=True
            )
        )
        
        response = client.transactions_get(request)
        transactions = response['transactions']
        
        # Handle pagination
        while len(transactions) < response['total_transactions']:
            request = TransactionsGetRequest(
                access_token=access_token,
                start_date=start_date,
                end_date=end_date,
                options=TransactionsGetRequestOptions(
                    include_personal_finance_category=True,
                    offset=len(transactions)
                )
            )
            response = client.transactions_get(request)
            transactions.extend(response['transactions'])
        
        logger.info(f"Successfully fetched {len(transactions)} transactions from Plaid")
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
        logger = app.logger
        plaid_items = PlaidItem.query.all()
        
        for plaid_item in plaid_items:
            try:
                logger.info(f"Updating transactions for PlaidItem {plaid_item.id}")
                fetch_and_store_transactions(
                    access_token=plaid_item.access_token,
                    user_id=plaid_item.user_id,
                    logger=logger
                )
            except Exception as e:
                logger.error(f"Error updating transactions for PlaidItem {plaid_item.id}: {str(e)}")
                continue

def sync_accounts(user_id, access_token, logger):
    try:
        client = create_plaid_client()
        request = AccountsGetRequest(access_token=access_token)
        response = client.accounts_get(request)
        
        plaid_item = PlaidItem.query.filter_by(user_id=user_id).order_by(PlaidItem.id.desc()).first()
        if not plaid_item:
            error_msg = f"No PlaidItem found for user {user_id}"
            logger.error(error_msg)
            raise Exception(error_msg)
        
        logger.info(f"Processing {len(response['accounts'])} accounts")
        
        for plaid_account in response['accounts']:
            logger.info(f"Processing account: {plaid_account}")
            
            account = Account.query.filter_by(
                user_id=user_id,
                plaid_account_id=plaid_account['account_id']
            ).first()
            
            balances = plaid_account['balances']
            account_data = {
                'user_id': user_id,
                'plaid_account_id': plaid_account['account_id'],
                'name': plaid_account['name'],
                'type': str(plaid_account['type']),
                'subtype': str(plaid_account.get('subtype', '')),
                'balance': float(balances.get('current', 0.0)),
                'iso_currency_code': balances.get('iso_currency_code'),
                'plaid_item_id': plaid_item.id
            }
            
            if not account:
                account = Account(**account_data)
                db.session.add(account)
                logger.info(f"Created new account: {account.name}")
            else:
                for key, value in account_data.items():
                    setattr(account, key, value)
                logger.info(f"Updated existing account: {account.name}")
        
        db.session.commit()
        logger.info(f"Successfully synced accounts for user {user_id}")
        return True
        
    except plaid.ApiException as e:
        error_msg = f"Plaid API error while syncing accounts: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Traceback: {traceback.format_exc()}")
        db.session.rollback()
        raise Exception(error_msg)
        
    except Exception as e:
        error_msg = f"Error syncing accounts: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Traceback: {traceback.format_exc()}")
        db.session.rollback()
        raise Exception(error_msg)
