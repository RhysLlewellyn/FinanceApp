import os
import logging
from logging.handlers import RotatingFileHandler
import traceback
from datetime import datetime, date, timedelta, timezone

from flask import Flask, jsonify, request
from flask_migrate import Migrate
from flask_cors import CORS
from flask_mail import Mail
from flask_apscheduler import APScheduler
from flask_jwt_extended import JWTManager, create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from flask_caching import Cache
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from config import Config
from dotenv import load_dotenv
from extensions import db
from models import User, Account, Transaction, Budget, BudgetAlert, PlaidItem, CustomCategory, FinancialGoal
from category_service import categorize_transaction, get_category_map, auto_categorize_transaction, update_category_keywords
from plaid_service import (
    create_link_token as plaid_create_link_token,
    exchange_public_token,
    sync_accounts,
    create_plaid_client,
    fetch_and_store_transactions,
    get_account_info_from_plaid,
    get_transactions_from_plaid,
    update_transactions as plaid_update_transactions
)
from budget_service import check_budget_alerts, get_user_budget_alerts, mark_alert_as_read, create_next_recurring_budgets
from notification_service import mail
from sqlalchemy.orm import joinedload

import plaid
from plaid.api import plaid_api
from plaid.exceptions import ApiException as PlaidApiException
from plaid.model.transactions_get_request import TransactionsGetRequest
from plaid.model.transactions_get_request_options import TransactionsGetRequestOptions

#print("Loading environment variables...")
load_dotenv()
#print(f"DATABASE_URL after load_dotenv: {os.getenv('DATABASE_URL')}")


def create_app(config_class='config.Config'):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize Limiter
    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        default_limits=["200 per day", "50 per hour"]
    )

    # Add this line to set the JWT token expiration time
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)  # or any suitable duration

    # Configurations
    app.config['SESSION_COOKIE_SECURE'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'None'
    app.config['SESSION_COOKIE_HTTPONLY'] = True

    app.logger.debug(f"Current working directory: {os.getcwd()}")
    app.logger.debug("Database configuration loaded")

    if not app.config['SQLALCHEMY_DATABASE_URI']:
        raise ValueError("No database URI configured. Set the DATABASE_URL environment variable.")
    # Initialize extensions
    CORS(app, resources={
        r"/*": {
            "origins": ["http://localhost:3000"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,
            "expose_headers": ["Content-Range", "X-Content-Range"]
        }
    })

    # Add OPTIONS method handling for all routes
    @app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
    @app.route('/<path:path>', methods=['OPTIONS'])
    def handle_options(path):
        return '', 204

    db.init_app(app)
    JWTManager(app)
    Migrate(app, db)
    mail.init_app(app)

    cache = Cache(app, config={'CACHE_TYPE': 'simple'})

    # Initialize scheduler
    scheduler = APScheduler()
    scheduler.init_app(app)
    scheduler.start()

    @scheduler.task('cron', id='sync_transactions', hour='*/6')
    def sync_transactions_job():
        with app.app_context():
            users = User.query.all()
            for user in users:
                try:
                    plaid_update_transactions(user.id)
                except Exception as e:
                    app.logger.error(f"Error syncing transactions for user {user.id}: {str(e)}")

    # Configure API key authorization: plaid_api
    configuration = plaid.Configuration(
        host=plaid.Environment.Sandbox,
        api_key={
            'clientId': os.getenv('PLAID_CLIENT_ID'),
            'secret': os.getenv('PLAID_SECRET'),
        }
    )

    # Create an instance of the API class
    api_client = plaid_api.ApiClient(configuration)
    client = plaid_api.PlaidApi(api_client)

    # Set up logging
    if not app.debug:
        if not os.path.exists('logs'):
            os.mkdir('logs')
        file_handler = RotatingFileHandler('logs/myapp.log', maxBytes=10240, backupCount=10)
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)

        app.logger.setLevel(logging.INFO)
        app.logger.info('MyApp startup')
        
    @app.route('/register', methods=['POST'])
    def register():
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        email = data.get('email')
        
        if not username or not password or not email:
            return jsonify({'message': 'Username, email, and password are required'}), 400
        
        # Check if user already exists
        if User.query.filter_by(username=username).first():
            return jsonify({'message': 'Username already exists'}), 400
            
        if User.query.filter_by(email=email).first():
            return jsonify({'message': 'Email already exists'}), 400
        
        try:
            new_user = User(
                username=username,
                email=email
            )
            new_user.set_password(password)  # Use the model's method to hash password
            
            db.session.add(new_user)
            db.session.commit()
            
            return jsonify({
                'message': 'User created successfully',
                'user': {
                    'id': new_user.id,
                    'username': new_user.username,
                    'email': new_user.email
                }
            }), 201
            
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error creating user: {str(e)}")
            return jsonify({'message': 'Error creating user'}), 500
    
    @app.route('/login', methods=['POST'])
    @limiter.limit("5 per minute")
    def login():
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        app.logger.info(f"Login attempt: username={username}")
        
        if not username or not password:
            return jsonify({'message': 'Username and password are required'}), 400
            
        user = User.query.filter_by(username=username).first()
        
        if user and check_password_hash(user.password_hash, password):
            access_token = create_access_token(identity=user.id)
                        
            return jsonify({
                'access_token': access_token,
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'username': user.username,
                }
            }), 200
        
        # Handle failed login attempt
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:  # Lock account after 5 failed attempts
                user.account_locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
            db.session.commit()
        
        return jsonify({'message': 'Invalid credentials'}), 401
    
    @app.route('/check_users', methods=['GET'])
    def check_users():
        users = User.query.all()
        return jsonify([{"id": user.id, "username": user.username} for user in users])
        
    @app.route('/protected', methods=['GET'])
    @jwt_required()
    def protected():
        current_user = get_jwt_identity()
        return jsonify(logged_in_as=current_user), 200
    
    @app.route('/create_link_token', methods=['POST'])
    @jwt_required()
    def create_link_token():
        user_id = get_jwt_identity()
        app.logger.info(f"Attempting to create link token for user {user_id}")
        try:
            link_token = plaid_create_link_token(user_id, app.logger)
            app.logger.info(f"Link token created successfully for user {user_id}")
            return jsonify({"link_token": link_token}), 200
        except plaid.ApiException as e:
            app.logger.error(f"Plaid API error creating link token: {str(e)}")
            return jsonify({"error": str(e), "type": "plaid_api_error"}), 400
        except Exception as e:
            app.logger.error(f"Unexpected error creating link token: {str(e)}")
            return jsonify({"error": str(e), "type": "unexpected_error"}), 500

    @app.route('/set_access_token', methods=['POST'])
    @jwt_required()
    def set_access_token():
        user_id = get_jwt_identity()
        app.logger.info(f"Received set_access_token request for user {user_id}")
        
        try:
            public_token = request.json.get('public_token')
            if not public_token:
                return jsonify({"error": "No public token provided"}), 400

            # Exchange public token for access token
            access_token, item_id = exchange_public_token(public_token, app.logger)
            app.logger.info(f"Successfully exchanged public token for user {user_id}")

            # Create or update PlaidItem
            plaid_item = PlaidItem.query.filter_by(user_id=user_id, item_id=item_id).first()
            
            if not plaid_item:
                app.logger.debug("Creating new PlaidItem")
                plaid_item = PlaidItem(
                    user_id=user_id,
                    item_id=item_id,
                    last_successful_update=datetime.now(timezone.utc)
                )
                plaid_item.access_token = access_token  # This will trigger encryption
                db.session.add(plaid_item)
            else:
                app.logger.debug("Updating existing PlaidItem")
                plaid_item.access_token = access_token  # This will trigger encryption
                plaid_item.last_successful_update = datetime.now(timezone.utc)

            db.session.commit()
            app.logger.debug(f"Saved PlaidItem with ID: {plaid_item.id}")

            # Verify the token was stored correctly
            stored_item = PlaidItem.query.get(plaid_item.id)
            if not stored_item or not stored_item.access_token:
                raise Exception("Failed to store access token")

            # Use the original access_token for immediate operations
            sync_accounts(user_id, access_token, app.logger)
            fetch_and_store_transactions(access_token, user_id, app.logger)
            
            return jsonify({
                "message": "Access token set, accounts and transactions synced",
                "item_id": item_id
            }), 201

        except Exception as e:
            app.logger.error(f"Error in set_access_token: {str(e)}")
            app.logger.error(traceback.format_exc())
            db.session.rollback()
            return jsonify({"error": str(e)}), 500

    @app.route('/refresh_token', methods=['POST'])
    @jwt_required(refresh=True)
    def refresh_token():
        try:
            user_id = get_jwt_identity()
            new_token = create_access_token(identity=user_id)
            return jsonify(access_token=new_token), 200
        except Exception as e:
            app.logger.error(f"Token refresh failed: {str(e)}")
            return jsonify({"msg": "Token refresh failed"}), 401

    @app.route('/logout', methods=['POST'])
    @jwt_required()
    def logout():
        user_id = get_jwt_identity()
        app.logger.info(f"User {user_id} logged out")
        return jsonify({"message": "Logged out successfully"}), 200

    @app.route('/fetch_account_info', methods=['GET', 'POST', 'OPTIONS'])
    @jwt_required()
    def fetch_account_info():
        if request.method == 'OPTIONS':
            return '', 204
        
        user_id = get_jwt_identity()
        app.logger.info(f"Fetching account info for user {user_id}")
        try:
            plaid_item = PlaidItem.query.filter_by(user_id=user_id).order_by(PlaidItem.id.desc()).first()
            if not plaid_item:
                app.logger.warning(f"No PlaidItem found for user {user_id}")
                return jsonify({
                    "error": "No linked bank account found",
                    "code": "NO_LINKED_ACCOUNT"
                }), 400

            app.logger.info(f"PlaidItem ID: {plaid_item.id}")
            
            # Add debug logging for access token
            app.logger.debug(f"Raw access token value: {plaid_item._access_token}")
            decrypted_token = plaid_item.access_token
            app.logger.debug(f"Decrypted access token exists: {decrypted_token is not None}")
            
            if not decrypted_token:
                app.logger.error("Access token is None after decryption")
                return jsonify({
                    "error": "Invalid access token",
                    "code": "INVALID_ACCESS_TOKEN"
                }), 500
            
            try:
                sync_accounts(user_id, decrypted_token, app.logger)
                
                # Fetch the updated accounts
                accounts = Account.query.filter_by(user_id=user_id).all()
                accounts_data = [account.to_dict() for account in accounts]

                return jsonify({
                    "message": "Account info fetched successfully", 
                    "accounts": accounts_data
                }), 200
                
            except Exception as sync_error:
                app.logger.error(f"Error syncing accounts: {str(sync_error)}")
                app.logger.error(f"Error type: {type(sync_error)}")
                app.logger.error(traceback.format_exc())
                return jsonify({
                    "error": "Failed to sync accounts",
                    "details": str(sync_error)
                }), 500

        except Exception as e:
            app.logger.error(f"Error in fetch_account_info: {str(e)}")
            app.logger.error(f"Error type: {type(e)}")
            app.logger.error(traceback.format_exc())
            db.session.rollback()
            return jsonify({
                "error": "An unexpected error occurred",
                "details": str(e)
            }), 500

    @app.route('/accounts', methods=['GET'])
    @jwt_required()
    def get_accounts():
        user_id = get_jwt_identity()
        try:
            accounts = Account.query.filter_by(user_id=user_id).all()
            return jsonify([account.to_dict() for account in accounts]), 200
        except Exception as e:
            app.logger.error(f"Error fetching accounts for user {user_id}: {str(e)}")
            return jsonify({"error": "An error occurred while fetching accounts"}), 500

    @app.route('/accounts/<int:account_id>', methods=['GET'])
    @jwt_required()
    def get_account(account_id):
        user_id = get_jwt_identity()
        app.logger.info(f"Fetching account {account_id} for user {user_id}")
        try:
            account = Account.query.filter_by(id=account_id, user_id=user_id).first()
            if not account:
                return jsonify({"error": "Account not found"}), 404

            formatted_account = {
                'id': account.id,
                'name': account.name,
                'balance': account.balance,
                'type': account.type,
                'subtype': account.subtype,
                'plaid_account_id': account.plaid_account_id
            }

            return jsonify(formatted_account), 200
        except Exception as e:
            app.logger.error(f"Error fetching account {account_id} for user {user_id}: {str(e)}")
            return jsonify({"error": "An error occurred while fetching the account"}), 500

    @app.route('/accounts_summary', methods=['GET'])
    @jwt_required()
    def get_accounts_summary():
        user_id = get_jwt_identity()
        accounts = Account.query.filter_by(user_id=user_id).all()
        total_balance = sum(account.balance for account in accounts)
        # Add real-time balance check using Plaid's Balance API
        updated_balances = get_real_time_balances(access_token)
        # Update account balances in the database
        update_account_balances(user_id, updated_balances)
        cache.delete(f'accounts_user_{user_id}')
        return jsonify({
            'totalBalance': total_balance,
            'numberOfAccounts': len(accounts)
        }), 200

    @app.route('/transactions', methods=['GET'])
    @jwt_required()
    @cache.cached(timeout=3600, key_prefix='transactions_user_{user_id}')
    def get_transactions():
        user_id = get_jwt_identity()
        app.logger.info(f"Fetching transactions for user {user_id}")
        
        try:
            # Get parameters
            days = request.args.get('days', default=30, type=int)
            start_date = datetime.now().date() - timedelta(days=days)
            
            # Query stored transactions
            transactions = Transaction.query.filter(
                Transaction.user_id == user_id,
                Transaction.date >= start_date
            ).order_by(Transaction.date.desc()).all()
            
            return jsonify([t.to_dict() for t in transactions]), 200
            
        except Exception as e:
            app.logger.error(f"Error in get_transactions: {str(e)}")
            return jsonify({"error": "An unexpected error occurred"}), 500

    @app.route('/sync_transactions', methods=['POST'])
    @jwt_required()
    def sync_transactions():
        user_id = get_jwt_identity()
        try:
            plaid_item = PlaidItem.query.filter_by(user_id=user_id).order_by(PlaidItem.id.desc()).first()
            if not plaid_item:
                return jsonify({"error": "No linked bank account found"}), 400

            # Sync transactions
            count = fetch_and_store_transactions(plaid_item.access_token, user_id, app.logger)
            
            # Clear cache
            cache.delete(f'transactions_user_{user_id}')
            
            return jsonify({
                "message": f"Successfully synced {count} new transactions",
                "count": count
            }), 200
            
        except Exception as e:
            app.logger.error(f"Error syncing transactions: {str(e)}")
            return jsonify({"error": "Failed to sync transactions"}), 500

    def update_transactions():
        """Background job to update transactions for all users"""
        with app.app_context():
            logger = app.logger
            logger.info("Starting scheduled transaction update")
            
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
            
            logger.info("Completed scheduled transaction update")

    @app.route('/recent_transactions', methods=['GET'])
    @jwt_required()
    def get_recent_transactions():
        user_id = get_jwt_identity()
        limit = request.args.get('limit', 5, type=int)  # Default to 5 recent transactions
        transactions = Transaction.query.filter_by(user_id=user_id).order_by(Transaction.date.desc()).limit(limit).all()
        return jsonify([{
            'id': t.id,
            'date': t.date.isoformat(),
            'description': t.name,
            'amount': float(t.amount),
            'category': t.category
        } for t in transactions]), 200

    @app.route('/stored_transactions', methods=['POST'])
    @jwt_required()
    def add_transaction():
        user_id = get_jwt_identity()
        data = request.get_json()
    
        # Validate input data
        required_fields = ['amount', 'date', 'name', 'account_id']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400
    
        # Auto-categorize the transaction if no category is provided
        category = data.get('category') or auto_categorize_transaction(user_id, data['name'])

        try:
            # Create new transaction
            new_transaction = Transaction(
                user_id=user_id,
                transaction_id=data.get('transaction_id'),
                amount=float(data['amount']),
                date=datetime.fromisoformat(data['date']),
                name=data['name'],
                category=category,
                account_id=data['account_id']
            )
            db.session.add(new_transaction)

            # Update account balance
            account = Account.query.get(data['account_id'])
            if not account or account.user_id != user_id:
                return jsonify({"error": "Invalid account"}), 400
        
            account.balance += float(data['amount'])
        
            db.session.commit()
            cache.delete(f'transactions_user_{user_id}')
            cache.delete(f'accounts_user_{user_id}')

            # Check budget alerts
            alerts = check_budget_alerts(user_id)
        
            return jsonify({
                "message": "Transaction added successfully",
                "transaction": new_transaction.to_dict(),
                "account": account.to_dict(),
                "budget_alerts": alerts
            }), 201

        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error adding transaction: {str(e)}")
            return jsonify({"error": str(e)}), 500
    
    @app.route('/stored_transactions', methods=['GET'])
    @jwt_required()
    def get_stored_transactions():
        user_id = get_jwt_identity()
        try:
            days_requested = request.args.get('days_requested', default=30, type=int)
            start_date = datetime.now().date() - timedelta(days=days_requested)
            
            transactions = Transaction.query.filter(
                Transaction.user_id == user_id,
                Transaction.date >= start_date
            ).order_by(Transaction.date.desc()).all()
            
            transactions_list = []
            for transaction in transactions:
                transaction_dict = {
                    'id': transaction.id,
                    'date': transaction.date.isoformat(),
                    'name': transaction.name,
                    'amount': float(transaction.amount),
                    'category': transaction.category,
                    'subcategory': transaction.subcategory,
                    'merchant_name': transaction.merchant_name,
                    'payment_channel': transaction.payment_channel,
                    'pending': transaction.pending,
                    'location': {
                        'address': transaction.location_address,
                        'city': transaction.location_city,
                        'region': transaction.location_region,
                        'postal_code': transaction.location_postal_code,
                        'country': transaction.location_country,
                        'lat': transaction.location_lat,
                        'lon': transaction.location_lon
                    } if transaction.location_city else None,
                    'authorized_date': transaction.authorized_date.isoformat() if transaction.authorized_date else None,
                    'personal_finance_category': transaction.personal_finance_category,
                    'logo_url': transaction.logo_url,
                    'website': transaction.website,
                    'iso_currency_code': transaction.iso_currency_code,
                    'account_id': transaction.account_id
                }
                transactions_list.append(transaction_dict)
                
            return jsonify({'transactions': transactions_list}), 200
            
        except Exception as e:
            app.logger.error(f"Error in get_stored_transactions: {str(e)}")
            app.logger.error(traceback.format_exc())
            return jsonify({'error': str(e)}), 500

    @app.route('/recurring_transactions', methods=['GET'])
    @jwt_required()
    def get_recurring_transactions():
        user_id = get_jwt_identity()
        plaid_item = PlaidItem.query.filter_by(user_id=user_id).first()

        try:
            client = create_plaid_client()
            response = client.transactions_recurring_get(
                access_token=plaid_item.access_token
            )
            return jsonify(response.to_dict()), 200
        except PlaidApiException as e:
            return jsonify({'error': str(e)}), 400

    @app.route('/stored_transactions/bulk_update', methods=['PUT'])
    @jwt_required()
    def bulk_update_transaction_categories():
        user_id = get_jwt_identity()
        data = request.json
        transaction_ids = data.get('transaction_ids', [])
        new_category = data.get('category')

        if not transaction_ids or not new_category:
            return jsonify({'error': 'Missing required fields'}), 400

        try:
            updated_count = Transaction.query.filter(
                Transaction.id.in_(transaction_ids),
                Transaction.user_id == user_id
            ).update({Transaction.category: new_category}, synchronize_session=False)

            db.session.commit()

            return jsonify({
                'message': f'Successfully updated {updated_count} transactions',
                'updated_count': updated_count
            }), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

    @app.route('/get_categories', methods=['GET'])
    @jwt_required()
    def get_categories():
        user_id = get_jwt_identity()
        category_map = get_category_map(user_id)
        categories = list(set(list(category_map.keys()) + ['Uncategorized']))
        return jsonify(categories), 200
    
    @app.route('/add_custom_category', methods=['POST'])
    @jwt_required()
    def add_custom_category():
        user_id = get_jwt_identity()
        data = request.get_json()
        category_name = data.get('name')
        keywords = data.get('keywords')

        if not category_name:
            return jsonify({'error': 'Category name is required'}), 400

        new_category = CustomCategory(user_id=user_id, name=category_name, keywords=keywords)
        db.session.add(new_category)
        db.session.commit()

        return jsonify({
            'message': 'Custom category added successfully',
            'category_id': new_category.id
        }), 201
    
    @app.route('/stored_transactions/<transaction_id>', methods=['PUT'])
    @jwt_required()
    def update_stored_transaction_category(transaction_id):
        if transaction_id == 'null' or transaction_id == 'undefined':
            return jsonify({'error': 'Invalid transaction ID'}), 400
        
        user_id = get_jwt_identity()
        data = request.json
        new_category = data.get('category')

        transaction = Transaction.query.filter_by(id=transaction_id, user_id=user_id).first()
        if not transaction:
            app.logger.error(f"Stored transaction not found for id: {transaction_id}")
            return jsonify({'error': 'Stored transaction not found'}), 404

        transaction.category = new_category
        db.session.commit()
        cache.delete(f'transactions_user_{user_id}')

        # Update category keywords
        update_category_keywords(user_id, new_category, transaction.name)

        return jsonify({'message': 'Stored transaction category updated successfully'}), 200
    
    @app.route('/set_budget', methods=['POST'])
    @jwt_required()
    def set_budget():
        user_id = get_jwt_identity()
        data = request.json
        budget_category = data.get('budget_category')
        budget_limit = data.get('budget_limit')
        start_date = date.fromisoformat(data.get('start_date', date.today().isoformat()))
        end_date = date.fromisoformat(data.get('end_date', (date.today() + timedelta(days=30)).isoformat()))
        is_recurring = data.get('is_recurring', False)
        recurrence_period = data.get('recurrence_period')
        current_spending = data.get('current_spending', 0.0)

        if not all([budget_category, budget_limit]):
            return jsonify({"error": "Missing required fields"}), 400

        new_budget = Budget(
            user_id=user_id,
            budget_category=budget_category,
            budget_limit=budget_limit,
            start_date=start_date,
            end_date=end_date,
            is_recurring=is_recurring,
            recurrence_period=recurrence_period,
            current_spending=current_spending
        )
        db.session.add(new_budget)
        db.session.commit()
        return jsonify({"message": "Budget created successfully"}), 201
    
    @app.route('/budget_status', methods=['GET'])
    @jwt_required()
    def get_budget_status():
        user_id = get_jwt_identity()
        budgets = Budget.query.filter_by(user_id=user_id).all()
        budget_status = []

        for budget in budgets:
            transactions = Transaction.query.filter(
                Transaction.user_id == user_id,
                Transaction.category == budget.budget_category,
                Transaction.date >= budget.start_date,
                Transaction.date <= budget.end_date
            ).all()

            total_spent = sum(transaction.amount for transaction in transactions)
            remaining = budget.budget_limit - total_spent
            status = "On Track" if remaining > 0 else "Over Budget"

            budget_status.append({
                "id": budget.id,
                "category": budget.budget_category,
                "limit": float(budget.budget_limit),
                "spent": float(total_spent),
                "remaining": float(remaining),
                "status": status,
                "start_date": budget.start_date.isoformat(),
                "end_date": budget.end_date.isoformat(),
                "is_recurring": budget.is_recurring,
                "recurrence_period": budget.recurrence_period
            })
    
        return jsonify(budget_status), 200

    @app.route('/budget_summary', methods=['GET'])
    @jwt_required()
    def get_budget_summary():
        user_id = get_jwt_identity()
        budgets = Budget.query.filter_by(user_id=user_id).all()
        total_budget = sum(budget.budget_limit for budget in budgets)
        total_spent = sum(budget.current_spending for budget in budgets)
        remaining = total_budget - total_spent
        return jsonify({
            'totalBudget': float(total_budget),
            'totalSpent': float(total_spent),
            'remaining': float(remaining)
        }), 200

    @app.route('/update_budget/<int:budget_id>', methods=['PUT'])
    @jwt_required()
    def update_budget(budget_id):
        user_id = get_jwt_identity()
        app.logger.info(f"Attempting to update budget {budget_id} for user {user_id}")
        budget = Budget.query.filter_by(id=budget_id, user_id=user_id).first()
        
        if not budget:
            app.logger.warning(f"Budget {budget_id} not found for user {user_id}")
            return jsonify({"error": "Budget not found"}), 404
        
        data = request.json
        app.logger.info(f"Received data for budget update: {data}")
        
        budget.budget_category = data.get('budget_category', budget.budget_category)
        budget.budget_limit = data.get('budget_limit', budget.budget_limit)
        budget.start_date = date.fromisoformat(data.get('start_date', budget.start_date.isoformat()))
        budget.end_date = date.fromisoformat(data.get('end_date', budget.end_date.isoformat()))
        budget.is_recurring = data.get('is_recurring', budget.is_recurring)
        budget.recurrence_period = data.get('recurrence_period', budget.recurrence_period)
        
        db.session.commit()
        app.logger.info(f"Budget {budget_id} updated successfully")
        cache.delete(f'budgets_user_{user_id}')
        
        updated_budget = {
            "id": budget.id,
            "budget_category": budget.budget_category,
            "budget_limit": float(budget.budget_limit),
            "start_date": budget.start_date.isoformat(),
            "end_date": budget.end_date.isoformat(),
            "is_recurring": budget.is_recurring,
            "recurrence_period": budget.recurrence_period
        }
        return jsonify(updated_budget), 200
    
    @app.route('/delete_budget/<int:budget_id>', methods=['DELETE'])
    @jwt_required()
    def delete_budget(budget_id):
        user_id = get_jwt_identity()
        budget = Budget.query.filter_by(id=budget_id, user_id=user_id).first()
    
        if not budget:
            return jsonify({"error": "Budget not found"}), 404
    
        try:
            # Explicitly delete associated alerts
            BudgetAlert.query.filter_by(budget_id=budget_id).delete()
        
            db.session.delete(budget)
            db.session.commit()
            app.logger.info(f"Budget {budget_id} and its alerts deleted successfully")
            cache.delete(f'budgets_user_{user_id}')

            return jsonify({"message": "Budget and associated alerts deleted successfully"}), 200
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error deleting budget {budget_id}: {str(e)}")
            return jsonify({"error": "An error occurred while deleting the budget"}), 500
    
    @app.route('/set_recurring_budget', methods=['POST'])
    @jwt_required()
    def set_recurring_budget():
        user_id = get_jwt_identity()
        data = request.get_json()
        
        budget_category = data.get('budget_category')
        budget_limit = data.get('budget_limit')
        start_date = datetime.strptime(data.get('start_date'), '%Y-%m-%d').date()
        end_date = datetime.strptime(data.get('end_date'), '%Y-%m-%d').date()
        recurrence_period = data.get('recurrence_period')

        if not all([budget_category, budget_limit, start_date, end_date, recurrence_period]):
            return jsonify({"error": "Missing required fields"}), 400
        
        new_budget = Budget(
            user_id=user_id,
            budget_category=budget_category,
            budget_limit=budget_limit,
            start_date=start_date,
            end_date=end_date,
            is_recurring=True,
            recurrence_period=recurrence_period
        )
        
        db.session.add(new_budget)
        db.session.commit()
        cache.delete(f'budgets_user_{user_id}')

        return jsonify({'message': 'Recurring budget set successfully'}), 201
    
    # Schedule the create_next_recurring_budgets function to run every day at midnight
    scheduler.add_job(id='create_recurring_budgets', func=create_next_recurring_budgets, trigger='cron', hour=0)
    
    @app.route('/recurring_budgets', methods=['GET'])
    @jwt_required()
    def get_recurring_budgets():
        user_id = get_jwt_identity()
        recurring_budgets = Budget.query.filter_by(user_id=user_id, is_recurring=True).all()
        return jsonify([{
            'id': budget.id,
            'category': budget.budget_category,
            'limit': budget.budget_limit,
            'start_date': budget.start_date.isoformat(),
            'end_date': budget.end_date.isoformat()
        } for budget in recurring_budgets]), 200
    
    @app.route('/stop_recurring_budget/<int:budget_id>', methods=['POST'])
    @jwt_required()
    def stop_recurring_budget(budget_id):
        user_id = get_jwt_identity()
        budget = Budget.query.filter_by(id=budget_id, user_id=user_id, is_recurring=True).first()
        if not budget:
            return jsonify({"error": "Recurring budget not found"}), 404
        budget.is_recurring = False
        db.session.commit()
        return jsonify({"message": "Recurring budget stopped successfully"}), 200

    @app.route('/spending_trends', methods=['GET'])
    @jwt_required()
    def get_spending_trends():
        try:
            user_id = get_jwt_identity()
            start_date_str = request.args.get('start_date', (datetime.now() - timedelta(days=30)).date().isoformat())
            end_date_str = request.args.get('end_date', datetime.now().date().isoformat())
            
            # Convert string dates to datetime objects
            start_date = datetime.fromisoformat(start_date_str).date()
            end_date = datetime.fromisoformat(end_date_str).date()

            app.logger.info(f"Fetching spending trends for user {user_id} from {start_date} to {end_date}")
            
            transactions = Transaction.query.filter(
                Transaction.user_id == user_id,
                Transaction.date.isnot(None),
                Transaction.date >= start_date,
                Transaction.date <= end_date
            ).all()
            
            category_totals = {}
            for transaction in transactions:
                if transaction.category and transaction.amount:
                    # Invert all transaction amounts
                    adjusted_amount = -transaction.amount
                    category_totals[transaction.category] = category_totals.get(transaction.category, 0) + adjusted_amount

            # Convert Decimal values to float for JSON serialization
            category_totals = {k: float(v) for k, v in category_totals.items()}

            app.logger.info(f"Spending trends for user {user_id}: {category_totals}")
            return jsonify(category_totals)
        except ValueError as ve:
            app.logger.error(f"Value Error in get_spending_trends: {str(ve)}")
            return jsonify({"error": "Invalid date format provided"}), 400
        except Exception as e:
            app.logger.error(f"Error in get_spending_trends: {str(e)}")
            return jsonify({"error": "An error occurred while fetching spending trends"}), 500
      
    @app.route('/budget_alerts', methods=['GET'])
    @jwt_required()
    def get_budget_alerts():
        user_id = get_jwt_identity()
        check_budget_alerts(user_id)  # This will create new alerts if necessary
    
        # Modify this line to only fetch unread alerts
        alerts = get_user_budget_alerts(user_id, is_read=False)
    
        return jsonify([{
            'id': alert.id,
            'budget_category': alert.budget.budget_category,
            'alert_type': alert.alert_type,
            'message': alert.message,
            'created_at': alert.created_at.isoformat()
        } for alert in alerts]), 200

    @app.route('/budget_alerts/<int:alert_id>/read', methods=['POST'])
    @jwt_required()
    def mark_alert_as_read(alert_id):
        user_id = get_jwt_identity()
        alert = BudgetAlert.query.filter_by(id=alert_id, user_id=user_id).first()
    
        if not alert:
            return jsonify({"error": "Alert not found"}), 404
    
        alert.is_read = True
        db.session.commit()
        cache.delete(f'budgets_alerts_user_{user_id}')
    
        return jsonify({"message": "Alert marked as read"}), 200
    
    @app.route('/profile', methods=['GET'])
    @jwt_required()
    def get_profile():
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        return jsonify({
            "username": user.username,
            "email": user.email
        })

    @app.route('/profile', methods=['PUT'])
    @jwt_required()
    def update_profile():
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
    
        data = request.json
        user.username = data.get('username', user.username)
        user.email = data.get('email', user.email)
        db.session.commit()
        cache.delete(f'profile_user_{user_id}')
    
        return jsonify({"message": "Profile updated successfully"})

    @app.route('/download_receipt/<transaction_id>', methods=['GET'])
    @jwt_required()
    def download_receipt(transaction_id):
        user_id = get_jwt_identity()
        transaction = Transaction.query.filter_by(id=transaction_id, user_id=user_id).first()
        
        if not transaction:
            return jsonify({'error': 'Transaction not found'}), 404
        
        if not transaction.receipt_path:
            return jsonify({'error': 'No receipt available for this transaction'}), 404
        
        try:
            return send_file(transaction.receipt_path, as_attachment=True)
        except Exception as e:
            app.logger.error(f"Error downloading receipt: {str(e)}")
            return jsonify({'error': 'Failed to download receipt'}), 500

    @app.route('/weekly_activity', methods=['GET'])
    @jwt_required()
    def get_weekly_activity():
        user_id = get_jwt_identity()
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=7)
        
        try:
            transactions = Transaction.query.filter(
                Transaction.user_id == user_id,
                Transaction.date >= start_date,
                Transaction.date <= end_date
            ).order_by(Transaction.date).all()

            daily_totals = {day: {"deposit": 0, "withdraw": 0} for day in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
            
            for transaction in transactions:
                day = transaction.date.strftime('%a')  # Get the abbreviated day name
                if transaction.amount > 0:
                    daily_totals[day]["deposit"] += transaction.amount
                else:
                    daily_totals[day]["withdraw"] += abs(transaction.amount)

            weekly_activity = [
                {"day": day, "deposit": totals["deposit"], "withdraw": totals["withdraw"]}
                for day, totals in daily_totals.items()
            ]

            return jsonify(weekly_activity), 200
        except Exception as e:
            app.logger.error(f"Error in get_weekly_activity: {str(e)}")
            return jsonify({"error": "An error occurred while processing your request"}), 500

    @app.route('/balance_history', methods=['GET'])
    @jwt_required()
    def get_balance_history():
        user_id = get_jwt_identity()
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=30)
    
        try:
            accounts = Account.query.filter_by(user_id=user_id).all()
            final_balance = sum(account.balance for account in accounts)

            # Get all transactions in reverse order
            transactions = Transaction.query.filter(
                Transaction.user_id == user_id,
                Transaction.date >= start_date,
                Transaction.date <= end_date
            ).order_by(Transaction.date.desc()).all()

            # Work backwards from current balance
            balance_history = []
            current_balance = final_balance

            for day in reversed([(start_date + timedelta(n)) for n in range((end_date - start_date).days + 1)]):
                day_transactions = [t for t in transactions if t.date == day]
                # Subtract the day's transactions (reverse the changes)
                day_change = sum(t.amount for t in day_transactions)
                balance_history.insert(0, {
                    "date": day.strftime('%Y-%m-%d'),
                    "balance": float(current_balance)
                })
                current_balance -= day_change  # Work backwards

            return jsonify(balance_history), 200
        except Exception as e:
            app.logger.error(f"Error in get_balance_history: {str(e)}")
            return jsonify({"error": "An error occurred while processing your request"}), 500

    @app.route('/plaid_webhook', methods=['POST'])
    def plaid_webhook():
        webhook_type = request.json['webhook_type']
        webhook_code = request.json['webhook_code']
        
        if webhook_type == 'TRANSACTIONS' and webhook_code == 'SYNC_UPDATES_AVAILABLE':
            item_id = request.json['item_id']
            plaid_item = PlaidItem.query.filter_by(item_id=item_id).first()
            if plaid_item:
                plaid_update_transactions(plaid_item.user_id)

        return '', 200

    @app.route('/financial_health_score', methods=['GET'])
    @jwt_required()
    def get_financial_health_score():
        user_id = get_jwt_identity()
        try:
            # Fetch necessary data for score calculation
            accounts = Account.query.filter_by(user_id=user_id).all()
            transactions = Transaction.query.filter_by(user_id=user_id).all()
            budgets = Budget.query.filter_by(user_id=user_id).all()
            goals = FinancialGoal.query.filter_by(user_id=user_id).all()

            # Calculate financial health score
            score, breakdown = calculate_financial_health_score(accounts, transactions, budgets, goals)

            return jsonify({'score': score, 'breakdown': breakdown}), 200
        except Exception as e:
            app.logger.error(f"Error calculating financial health score: {str(e)}")
            return jsonify({"error": "An error occurred while calculating the financial health score"}), 500

    def calculate_financial_health_score(accounts, transactions, budgets, goals):
        total_balance = sum(account.balance for account in accounts)
        total_income = sum(t.amount for t in transactions if t.amount > 0)
        total_expenses = sum(abs(t.amount) for t in transactions if t.amount < 0)
        total_budget = sum(budget.budget_limit for budget in budgets)

        # Calculate sub-scores
        savings_ratio = min(total_balance / (total_income or 1), 1) * 20
        income_expense_ratio = min(total_income / (total_expenses or 1), 2) * 20
        budget_adherence = min(total_budget / (total_expenses or 1), 1) * 20
    
        # Calculate debt-to-income ratio
        debt = sum(account.balance for account in accounts if account.type == 'loan' or account.type == 'credit')
        debt_to_income_ratio = 20 * (1 - min(debt / (total_income or 1), 1))
    
        # Calculate goal progress
        goal_progress = sum(goal.current_amount / goal.target_amount for goal in goals) / (len(goals) or 1) * 20

        # Calculate overall score (out of 100)
        score = savings_ratio + income_expense_ratio + budget_adherence + debt_to_income_ratio + goal_progress

        breakdown = {
            'savings_ratio': round(savings_ratio, 2),
            'income_expense_ratio': round(income_expense_ratio, 2),
            'budget_adherence': round(budget_adherence, 2),
            'debt_to_income_ratio': round(debt_to_income_ratio, 2),
            'goal_progress': round(goal_progress, 2)
        }

        return round(score, 2), breakdown

    @app.route('/financial_goals', methods=['GET'])
    @jwt_required()
    def get_financial_goals():
        user_id = get_jwt_identity()
        try:
            goals = FinancialGoal.query.filter_by(user_id=user_id).all()
            return jsonify([goal.to_dict() for goal in goals]), 200
        except Exception as e:
            app.logger.error(f"Error fetching financial goals: {str(e)}")
            return jsonify({"error": "An error occurred while fetching financial goals"}), 500

    @app.route('/financial_goals', methods=['POST'])
    @jwt_required()
    def create_financial_goal():
        user_id = get_jwt_identity()
        data = request.json
        try:
            new_goal = FinancialGoal(
                user_id=user_id,
                name=data['name'],
                target_amount=data['target_amount'],
                current_amount=data.get('current_amount', 0),
                target_date=datetime.fromisoformat(data['target_date'])
            )
            db.session.add(new_goal)
            db.session.commit()
            return jsonify(new_goal.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error creating financial goal: {str(e)}")
            return jsonify({"error": "An error occurred while creating the financial goal"}), 500

    @app.route('/financial_goals/<int:goal_id>', methods=['PUT'])
    @jwt_required()
    def update_financial_goal(goal_id):
        user_id = get_jwt_identity()
        data = request.json
        try:
            goal = FinancialGoal.query.filter_by(id=goal_id, user_id=user_id).first()
            if not goal:
                return jsonify({"error": "Goal not found"}), 404
        
            goal.name = data.get('name', goal.name)
            goal.target_amount = data.get('target_amount', goal.target_amount)
            goal.current_amount = data.get('current_amount', goal.current_amount)
            goal.target_date = datetime.fromisoformat(data.get('target_date', goal.target_date.isoformat()))
        
            db.session.commit()
            return jsonify(goal.to_dict()), 200
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error updating financial goal: {str(e)}")
            return jsonify({"error": "An error occurred while updating the financial goal"}), 500

    @app.route('/financial_goals/<int:goal_id>', methods=['DELETE'])
    @jwt_required()
    def delete_financial_goal(goal_id):
        user_id = get_jwt_identity()
        try:
            goal = FinancialGoal.query.filter_by(id=goal_id, user_id=user_id).first()
            if not goal:
                return jsonify({"error": "Goal not found"}), 404
        
            db.session.delete(goal)
            db.session.commit()
            return jsonify({"message": "Goal deleted successfully"}), 200
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error deleting financial goal: {str(e)}")
            return jsonify({"error": "An error occurred while deleting the financial goal"}), 500

    @app.route('/accounts/<string:account_id>', methods=['DELETE'])
    @jwt_required()
    def delete_account(account_id):
        user_id = get_jwt_identity()
        app.logger.info(f"Attempting to delete account {account_id} for user {user_id}")
        
        try:
            # Find the account
            account = Account.query.filter_by(
                plaid_account_id=account_id,
                user_id=user_id
            ).first()
            
            if not account:
                app.logger.warning(f"Account {account_id} not found for user {user_id}")
                return jsonify({"error": "Account not found"}), 404

            # Delete related transactions first
            Transaction.query.filter_by(account_id=account.id).delete()
            
            # Delete the account
            db.session.delete(account)
            db.session.commit()
            
            app.logger.info(f"Successfully deleted account {account_id} for user {user_id}")
            return jsonify({"message": "Account deleted successfully"}), 200
            
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error deleting account {account_id}: {str(e)}")
            return jsonify({"error": str(e)}), 500

    if app.config['TESTING']:
        from test_routes import test_bp
        app.register_blueprint(test_bp)
            
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)