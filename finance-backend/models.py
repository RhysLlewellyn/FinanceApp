from extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, date
import uuid

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
    transactions = db.relationship('Transaction', backref='account', lazy=True)

    def to_dict(self):
        return{
            'id': self.id,
            'name': self.name,
            'balance': self.balance,
            'type': self.type,
            'subtype': self.subtype,
            'plaid_account_id': self.plaid_account_id
        }

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    account_id = db.Column(db.String, db.ForeignKey('account.id'), nullable=False)
    transaction_id = db.Column(db.String(255), nullable=True)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False)
    name = db.Column(db.String(255))
    category = db.Column(db.String(255))


    def to_dict(self):
        return {
            'id': self.id,
            'transaction_id': self.transaction_id,
            'date': self.date.isoformat(),
            'name': self.name,
            'amount': float(self.amount),
            'category': self.category,
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
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    access_token = db.Column(db.String(255), nullable=False)
    item_id = db.Column(db.String(255), nullable=False)
    accounts = db.relationship('Account', backref='plaid_item', lazy=True)
    user = db.relationship('User', backref=db.backref('plaid_items', lazy=True))

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