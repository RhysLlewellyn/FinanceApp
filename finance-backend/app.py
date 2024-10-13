import os
import logging
from logging.handlers import RotatingFileHandler
import traceback
from datetime import datetime, date, timedelta

from flask import Flask, jsonify, request
from flask_migrate import Migrate
from flask_cors import CORS
from flask_mail import Mail
from flask_apscheduler import APScheduler
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash

from config import Config
from dotenv import load_dotenv
from extensions import db
from models import User, Account, Transaction, Budget, BudgetAlert, PlaidItem, CustomCategory
from category_service import categorize_transaction, get_category_map, auto_categorize_transaction, update_category_keywords
from plaid_service import (
    create_link_token as plaid_create_link_token,
    exchange_public_token,
    sync_accounts,
    create_plaid_client,
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

    # Add this line to set the JWT token expiration time
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)  # or any suitable duration

    app.logger.debug(f"Current working directory: {os.getcwd()}")
    app.logger.debug("Database configuration loaded")

    if not app.config['SQLALCHEMY_DATABASE_URI']:
        raise ValueError("No database URI configured. Set the DATABASE_URL environment variable.")
    # Initialize extensions
    CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})
    db.init_app(app)
    JWTManager(app)
    Migrate(app, db)
    mail.init_app(app)

    # Initialize scheduler
    scheduler = APScheduler()
    scheduler.init_app(app)
    scheduler.start()

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

    # Create a route for the home page test
    @app.route('/')
    def hello():
        return "Hello, Flask!"
        
    @app.route('/register', methods=['POST'])
    def register():
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        if User.query.filter_by(username=username).first() or User.query.filter_by(email=email).first():
            return jsonify({'message': 'User already exists'}), 400
        
        new_user = User(username=username, email=email)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()

        return jsonify({'message': 'User created successfully'}), 201
    
    @app.route('/login', methods=['POST'])
    def login():
        username = request.json.get('username', None)
        password = request.json.get('password', None)
        app.logger.info(f"Login attempt: username={username}")

        try:
            user = User.query.filter_by(username=username).first()
            if user:
                app.logger.info(f"User found: {user.id}")
                if user.check_password(password):
                    access_token = create_access_token(identity=user.id)
                    app.logger.info(f"Access token created for user {user.id}")
                    return jsonify(access_token=access_token), 200
                else:
                    app.logger.warning("Password check failed")
            else:
                app.logger.warning("User not found")
            
            return jsonify({"msg": "Bad username or password"}), 401
        except Exception as e:
            app.logger.error(f"Unexpected error in login route: {str(e)}")
            return jsonify({"error": "An unexpected error occurred"}), 500
    
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
        public_token = request.json.get('public_token')
        
        if not public_token:
            return jsonify({"error": "Missing public_token"}), 400

        try:
            access_token, item_id = exchange_public_token(public_token, app.logger)
            # Save the access token and item_id to your database
            plaid_item = PlaidItem(user_id=user_id, access_token=access_token, item_id=item_id)
            db.session.add(plaid_item)
            db.session.commit()

            return jsonify({"message": "Access token set successfully"}), 200
        except plaid.ApiException as e:
            app.logger.error(f"Error exchanging public token: {str(e)}")
            return jsonify({"error": str(e)}), 400

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

    @app.route('/fetch_account_info', methods=['POST'])
    @jwt_required()
    def fetch_account_info():
        user_id = get_jwt_identity()
        app.logger.info(f"Fetching account info for user {user_id}")
        try:
            plaid_item = PlaidItem.query.filter_by(user_id=user_id).order_by(PlaidItem.id.desc()).first()
            if not plaid_item:
                app.logger.warning(f"No PlaidItem found for user {user_id}")
                return jsonify({"error": "No linked bank account found"}), 400

            app.logger.info(f"PlaidItem ID: {plaid_item.id}")
            
            # Sync accounts first
            sync_accounts(user_id, plaid_item.access_token, app.logger)
            
            # Fetch transactions
            start_date = (datetime.now() - timedelta(days=30)).date()
            end_date = datetime.now().date()
            transactions = get_transactions_from_plaid(plaid_item.access_token, start_date, end_date, app.logger)
            
            for transaction in transactions:
                existing_transaction = Transaction.query.filter_by(transaction_id=transaction['transaction_id']).first()
                if not existing_transaction:
                    account = Account.query.filter_by(plaid_account_id=transaction['account_id']).first()
                    if account:
                        new_transaction = Transaction(
                            user_id=user_id,
                            transaction_id=transaction['transaction_id'],
                            amount=transaction['amount'],
                            date=transaction['date'],
                            name=transaction['name'],
                            category=transaction['category'][0] if transaction['category'] else None,
                            account_id=account.id  # Use the database ID, not the Plaid account ID
                        )
                        db.session.add(new_transaction)
                        app.logger.info(f"Added new transaction {new_transaction.transaction_id} for user {user_id}")
                    else:
                        app.logger.warning(f"Account not found for transaction {transaction['transaction_id']}")
            
            db.session.commit()
            return jsonify({"message": "Account info and transactions fetched successfully"}), 200
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error fetching account info and transactions for user {user_id}: {str(e)}")
            return jsonify({"error": "An error occurred while fetching account info and transactions"}), 500
        
    @app.route('/accounts', methods=['GET', 'OPTIONS'])
    @jwt_required()
    def get_accounts():
        if request.method == 'OPTIONS':
            headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '3600'
            }
            return ('', 204, headers)
    
        user_id = get_jwt_identity()
        app.logger.info(f"Fetching accounts for user {user_id}")
        try:
            accounts = Account.query.filter_by(user_id=user_id).all()

            formatted_accounts = [{
                'id': account.id,
                'name': account.name,
                'balance': account.balance,
                'type': account.type,
                'subtype': account.subtype,
                'plaid_account_id': account.plaid_account_id
            } for account in accounts]

            return jsonify(formatted_accounts), 200
        except Exception as e:
            app.logger.error(f"Error fetching accounts for user {user_id}: {str(e)}")
            return jsonify([]), 200 # Return an empty array on error

    @app.route('/accounts/<int:account_id>', methods=['GET', 'OPTIONS'])
    @jwt_required()
    def get_account(account_id):
        if request.method == 'OPTIONS':
            headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '3600'
            }
            return ('', 204, headers)
    
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
        return jsonify({
            'totalBalance': total_balance,
            'numberOfAccounts': len(accounts)
        }), 200

    @app.route('/transactions', methods=['GET'])
    @jwt_required()
    def get_transactions():
        user_id = get_jwt_identity()
        app.logger.info(f"Fetching transactions for user {user_id}")
        
        try:
            plaid_item = PlaidItem.query.filter_by(user_id=user_id).order_by(PlaidItem.id.desc()).first()
            if not plaid_item:
                return jsonify([]), 200  # Return an empty array if no linked account

            app.logger.info(f"PlaidItem found: {plaid_item.id}")
            
            access_token = plaid_item.access_token
            
            start_date = (datetime.now() - timedelta(days=30)).date()
            end_date = datetime.now().date()
            
            request = TransactionsGetRequest(
                access_token=access_token,
                start_date=start_date,
                end_date=end_date,
                options=TransactionsGetRequestOptions(
                    count=500,
                    offset=0
                )
            )
            
            response = client.transactions_get(request)
            transactions = response['transactions']
            
            # Transform transactions to the format expected by the frontend
            formatted_transactions = [{
                'id': transaction['transaction_id'],
                'date': transaction['date'],
                'name': transaction['name'],
                'category': transaction['category'][0] if transaction['category'] else 'Uncategorized',
                'amount': transaction['amount']
            } for transaction in transactions]
            
            return jsonify(formatted_transactions), 200
            
        except plaid.ApiException as e:
            app.logger.error(f"Plaid API error in get_transactions: {str(e)}")
            return jsonify([]), 200  # Return an empty array on error
        except Exception as e:
            app.logger.error(f"Unexpected error in get_transactions: {str(e)}")
            return jsonify([]), 200  # Return an empty array on error

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
        try:
            user_id = get_jwt_identity()
            plaid_item = PlaidItem.query.filter_by(user_id=user_id).first()
            if not plaid_item:
                return jsonify({"error": "No linked bank account found"}), 400
            
            sync_accounts(user_id, plaid_item.access_token, app.logger)  # Pass all required arguments
            
            page = request.args.get('page', 1, type=int)
            per_page = request.args.get('per_page', 10, type=int)
            order_by = request.args.get('order_by', 'date')
            order = request.args.get('order', 'desc')
            category = request.args.get('category')
            account_id = request.args.get('account_id')
            start_date = request.args.get('start_date')
            end_date = request.args.get('end_date')

            query = Transaction.query.filter_by(user_id=user_id)

            if category:
                query = query.filter_by(category=category)
            if account_id:
                query = query.filter_by(account_id=account_id)
            if start_date:
                query = query.filter(Transaction.date >= datetime.strptime(start_date, '%Y-%m-%d').date())
            if end_date:
                query = query.filter(Transaction.date <= datetime.strptime(end_date, '%Y-%m-%d').date())

            if order == 'asc':
                query = query.order_by(getattr(Transaction, order_by).asc())
            else:
                query = query.order_by(getattr(Transaction, order_by).desc())

            pagination = query.paginate(page=page, per_page=per_page, error_out=False)
            transactions = pagination.items

            return jsonify({
                'transactions': [transaction.to_dict() for transaction in transactions],
                'total': pagination.total,
                'pages': pagination.pages,
                'page': page
            }), 200
        except Exception as e:
            app.logger.error(f"Error in get_stored_transactions: {str(e)}")
            return jsonify({"error": "An error occurred while processing your request"}), 500

    def update_transactions():
        plaid_update_transactions(app)

    # Schedule the update_transactions function to run every day at midnight
    scheduler.add_job(id='update_transactions', func=update_transactions, trigger='cron', hour=0)

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
                    category_totals[transaction.category] = category_totals.get(transaction.category, 0) + transaction.amount

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
    
        return jsonify({"message": "Profile updated successfully"})

    if app.config['TESTING']:
        from test_routes import test_bp
        app.register_blueprint(test_bp)
            
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)