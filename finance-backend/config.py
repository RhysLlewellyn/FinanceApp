import os
from dotenv import load_dotenv
from cryptography.fernet import Fernet

# Add debug print
print("Current working directory:", os.getcwd())
print("Loading .env file...")

load_dotenv()

# Add debug print
print("Environment variables after load_dotenv:")
print("JWT_SECRET_KEY:", os.getenv('JWT_SECRET_KEY'))
print("DATABASE_URL:", os.getenv('DATABASE_URL'))

class Config:
    # Database settings
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    if not SQLALCHEMY_DATABASE_URI:
        raise ValueError("No DATABASE_URL set for Flask application")
    
    # JWT settings
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    if not JWT_SECRET_KEY:
        raise ValueError("No JWT_SECRET_KEY set for Flask application")
    
    TESTING = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = os.getenv('SQLALCHEMY_ECHO', 'False').lower() == 'true'

    #print(f"SQLALCHEMY_DATABASE_URI set to: {SQLALCHEMY_DATABASE_URI}")

    # Plaid settings (from original)
    PLAID_CLIENT_ID = os.getenv('PLAID_CLIENT_ID')
    PLAID_SECRET = os.getenv('PLAID_SECRET')
    PLAID_ENV = os.getenv('PLAID_ENV', 'sandbox')
    
    # Mail settings (from original)
    MAIL_SERVER = os.getenv('MAIL_SERVER', '127.0.0.1')
    MAIL_PORT = int(os.getenv('MAIL_PORT', 1025))
    MAIL_USE_TLS = os.getenv('MAIL_USE_TLS', 'False').lower() == 'true'
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.getenv('MAIL_DEFAULT_SENDER', 'dev@financeapp.local')

    # Encryption (from original)
    ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY')
    if not ENCRYPTION_KEY:
        ENCRYPTION_KEY = Fernet.generate_key().decode()  # Generate a key if none exists

class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv('TEST_DATABASE_URL')
    if not SQLALCHEMY_DATABASE_URI:
        raise ValueError("No TEST_DATABASE_URL set for Flask application")
    
    JWT_SECRET_KEY = 'test-secret-key'
    SQLALCHEMY_ECHO = True
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }
    #print(f"Test SQLALCHEMY_DATABASE_URI set to: {SQLALCHEMY_DATABASE_URI}")