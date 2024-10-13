import os

from dotenv import load_dotenv

load_dotenv()

class Config:
    #print("Loading configuration...")
    
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    if not SQLALCHEMY_DATABASE_URI:
        raise ValueError("No DATABASE_URL set for Flask application")
    
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    if not JWT_SECRET_KEY:
        raise ValueError("No JWT_SECRET_KEY set for Flask application")
    
    TESTING = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = os.getenv('SQLALCHEMY_ECHO', 'False').lower() == 'true'

    #print(f"SQLALCHEMY_DATABASE_URI set to: {SQLALCHEMY_DATABASE_URI}")

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