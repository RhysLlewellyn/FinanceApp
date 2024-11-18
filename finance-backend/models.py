from extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, date
import uuid
from cryptography.fernet import Fernet, InvalidToken
from flask import current_app
import base64
import logging
import traceback

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    accounts = db.relationship('Account', backref='user', lazy=True)
    custom_categories = db.relationship('CustomCategory', back_populates='user', cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Account(db.Model):
    id = db.Column(db.String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    plaid_item_id = db.Column(db.Integer, db.ForeignKey('plaid_item.id'), nullable=False)
    plaid_account_id = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    balance = db.Column(db.Float, nullable=False)
    type = db.Column(db.String(50), nullable=False)
    subtype = db.Column(db.String(50))
    iso_currency_code = db.Column(db.String(3), nullable=True)
    transactions = db.relationship('Transaction', backref='account', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'balance': self.balance,
            'type': self.type,
            'subtype': self.subtype,
            'plaid_account_id': self.plaid_account_id,
            'iso_currency_code': self.iso_currency_code
        }

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    account_id = db.Column(db.String, db.ForeignKey('account.id'), nullable=False)
    transaction_id = db.Column(db.String(255), unique=True, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False)
    name = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(100))
    subcategory = db.Column(db.String(100))
    merchant_name = db.Column(db.String(255))
    payment_channel = db.Column(db.String(50))
    pending = db.Column(db.Boolean, default=False)
    location_address = db.Column(db.String(255))
    location_city = db.Column(db.String(100))
    location_region = db.Column(db.String(100))
    location_postal_code = db.Column(db.String(20))
    location_country = db.Column(db.String(2))
    location_lat = db.Column(db.Float)
    location_lon = db.Column(db.Float)
    authorized_date = db.Column(db.Date)
    personal_finance_category = db.Column(db.String(100))
    logo_url = db.Column(db.String(255))
    website = db.Column(db.String(255))
    iso_currency_code = db.Column(db.String(3))

    def to_dict(self):
        return {
            'id': self.id,
            'transaction_id': self.transaction_id,
            'date': self.date.isoformat(),
            'name': self.name,
            'amount': float(self.amount),
            'category': self.category,
            'subcategory': self.subcategory,
            'merchant_name': self.merchant_name,
            'payment_channel': self.payment_channel,
            'pending': self.pending,
            'location': {
                'address': self.location_address,
                'city': self.location_city,
                'region': self.location_region,
                'postal_code': self.location_postal_code,
                'country': self.location_country,
                'lat': self.location_lat,
                'lon': self.location_lon
            } if self.location_city else None,
            'authorized_date': self.authorized_date.isoformat() if self.authorized_date else None,
            'personal_finance_category': self.personal_finance_category,
            'logo_url': self.logo_url,
            'website': self.website,
            'iso_currency_code': self.iso_currency_code,
            'account_id': self.account_id
        }

class Budget(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    budget_category = db.Column(db.String(100), nullable=False)
    budget_limit = db.Column(db.Float, nullable=False)
    current_spending = db.Column(db.Float, nullable=False, default=0.0)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    is_recurring = db.Column(db.Boolean, default=False)
    recurrence_period = db.Column(db.String(20)) # e.g. "weekly", "monthly", "yearly"

    # Notify the relationship to include cascade
    alerts = db.relationship('BudgetAlert', back_populates='budget', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Budget {self.budget_category}: {self.budget_limit}>'

class PlaidItem(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    _access_token = db.Column('access_token', db.String(255), nullable=False)
    item_id = db.Column(db.String(255), nullable=False, unique=True)
    institution_id = db.Column(db.String(100), nullable=True)
    institution_name = db.Column(db.String(100), nullable=True)
    available_products = db.Column(db.JSON, nullable=True)
    billed_products = db.Column(db.JSON, nullable=True)
    webhook_url = db.Column(db.String(255), nullable=True)
    error = db.Column(db.JSON, nullable=True)
    last_successful_update = db.Column(db.DateTime, nullable=True)

    # Relationships
    user = db.relationship('User', backref=db.backref('plaid_items', lazy=True))
    accounts = db.relationship('Account', backref='plaid_item', lazy=True)

    @property
    def access_token(self):
        """Decrypt the access token when accessing it"""
        if not self._access_token:
            current_app.logger.error("No access token stored")
            return None
        try:
            cipher_suite = Fernet(current_app.config['ENCRYPTION_KEY'].encode())
            decrypted = cipher_suite.decrypt(self._access_token.encode())
            return decrypted.decode()
        except Exception as e:
            current_app.logger.error(f"Error decrypting access token: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            return None

    @access_token.setter
    def access_token(self, token):
        """Encrypt the access token before storing it"""
        if not token:
            current_app.logger.error("Attempted to set empty access token")
            raise ValueError("Access token cannot be empty")
        try:
            cipher_suite = Fernet(current_app.config['ENCRYPTION_KEY'].encode())
            encrypted = cipher_suite.encrypt(token.encode())
            self._access_token = encrypted.decode()
            current_app.logger.debug("Successfully encrypted access token")
        except Exception as e:
            current_app.logger.error(f"Error encrypting access token: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            raise

class CustomCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    keywords = db.Column(db.String(255))
    user = db.relationship('User', back_populates='custom_categories')

    def __init__(self, user_id, name, keywords=None):
        self.user_id = user_id
        self.name = name
        self.keywords = keywords

class BudgetAlert(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    budget_id = db.Column(db.Integer, db.ForeignKey('budget.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    alert_type = db.Column(db.String(50), nullable=False)  # e.g., '80%', '100%', 'over'
    message = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_read = db.Column(db.Boolean, default=False)

    budget = db.relationship('Budget', back_populates='alerts')

    def __repr__(self):
        return f'<BudgetAlert {self.alert_type} for Budget {self.budget_id}>'
    
class FinancialGoal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    target_amount = db.Column(db.Float, nullable=False)
    current_amount = db.Column(db.Float, default=0)
    target_date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'target_amount': self.target_amount,
            'current_amount': self.current_amount,
            'target_date': self.target_date.isoformat(),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    message = db.Column(db.String(255), nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('notifications', lazy=True))