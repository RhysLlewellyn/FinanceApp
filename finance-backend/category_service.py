from models import CustomCategory, db
from fuzzywuzzy import process

default_category_map = {
    'Food': ['Restaurant', 'Cafe', 'Grocery', 'Bar', 'Fast Food'],
    'Transportation': ['Uber', 'Lyft', 'Taxi', 'Public Transportation', 'Gas', 'Parking'],
    'Entertainment': ['Movies', 'Concert', 'Theater', 'Streaming Service', 'Games'],
    'Shopping': ['Amazon', 'Walmart', 'Target', 'Clothing', 'Electronics'],
    'Utilities': ['Rent', 'Electricity', 'Water', 'Internet', 'Phone', 'Insurance'],
}

def get_category_map(user_id):
    custom_categories = CustomCategory.query.filter_by(user_id=user_id).all()
    category_map = default_category_map.copy()
    for custom_category in custom_categories:
        category_map[custom_category.name] = custom_category.keywords.split(',') if custom_category.keywords else []
    return category_map

def categorize_transaction(transaction_name, user_id):
    category_map = get_category_map(user_id)
    transaction_name = transaction_name.lower()
    for category, keywords in category_map.items():
        if any(keyword.lower() in transaction_name for keyword in keywords):
            return category
    return 'Uncategorized'

def auto_categorize_transaction(user_id, transaction_name):
    # Get user's custom categories
    custom_categories = CustomCategory.query.filter_by(user_id=user_id).all()
    
    # Create a dictionary of category names and their keywords
    category_keywords = {cat.name: cat.keywords.split(',') if cat.keywords else [] for cat in custom_categories}
    
    # Check if transaction name matches any category keywords
    for category, keywords in category_keywords.items():
        if any(keyword.lower() in transaction_name.lower() for keyword in keywords):
            return category
    
    # If no match found, use fuzzy matching to find the closest category
    category_names = list(category_keywords.keys())
    best_match, score = process.extractOne(transaction_name, category_names)
    
    # If the best match has a score above 80, use it; otherwise, return 'Uncategorized'
    return best_match if score > 80 else 'Uncategorized'

def update_category_keywords(user_id, category_name, transaction_name):
    custom_category = CustomCategory.query.filter_by(user_id=user_id, name=category_name).first()
    if not custom_category:
        custom_category = CustomCategory(user_id=user_id, name=category_name)
        db.session.add(custom_category)
    
    keywords = set(custom_category.keywords.split(',') if custom_category.keywords else [])
    keywords.add(transaction_name.lower())
    custom_category.keywords = ','.join(keywords)
    db.session.commit()