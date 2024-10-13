from models import Budget, Transaction, BudgetAlert
from flask import current_app
from extensions import db
from datetime import datetime, timedelta
from sqlalchemy import func


def update_budget_spending(user_id):
    budgets = Budget.query.filter_by(user_id=user_id).all()
    
    for budget in budgets:
        total_spent = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == user_id,
            Transaction.category == budget.budget_category,
            Transaction.date >= budget.start_date,
            Transaction.date <= budget.end_date
        ).scalar() or 0.0

        budget.current_spending = total_spent
        db.session.add(budget)
    
    db.session.commit()

def check_budget_alerts(user_id):
    update_budget_spending(user_id)
    budgets = Budget.query.filter_by(user_id=user_id).all()
    alerts = []
    
    print(f"Checking budget alerts for user {user_id}")
    print(f"Number of budgets: {len(budgets)}")
    
    for budget in budgets:
        if budget.budget_limit > 0:  # Avoid division by zero
            percentage = (budget.current_spending / budget.budget_limit) * 100
            print(f"Budget {budget.id}: {budget.budget_category}, Limit: {budget.budget_limit}, Current: {budget.current_spending}, Percentage: {percentage:.2f}%")
            
            if 80 <= percentage < 100 and not BudgetAlert.query.filter_by(budget_id=budget.id, alert_type='80%', is_read=False).first():
                print(f"Creating 80% alert for budget {budget.id}")
                alert = create_budget_alert(budget, '80%', f"You've spent {percentage:.1f}% of your {budget.budget_category} budget.")
                alerts.append(alert)
            elif percentage >= 100 and not BudgetAlert.query.filter_by(budget_id=budget.id, alert_type='over', is_read=False).first():
                print(f"Creating over budget alert for budget {budget.id}")
                alert = create_budget_alert(budget, 'over', f"You've exceeded your {budget.budget_category} budget by {(percentage - 100):.1f}%.")
                alerts.append(alert)
    
    print(f"Number of alerts created: {len(alerts)}")
    return alerts

def create_budget_alert(budget, alert_type, message):
    alert = BudgetAlert(
        user_id=budget.user_id,
        budget_id=budget.id,
        alert_type=alert_type,
        message=message
    )
    db.session.add(alert)
    db.session.commit()
    return alert

def get_user_budget_alerts(user_id, is_read=None):
    query = BudgetAlert.query.filter_by(user_id=user_id)
    if is_read is not None:
        query = query.filter_by(is_read=is_read)
    return query.order_by(BudgetAlert.created_at.desc()).all()

def mark_alert_as_read(alert_id):
    alert = BudgetAlert.query.get(alert_id)
    if alert:
        alert.is_read = True
        db.session.commit()
        return True
    return False

def create_next_recurring_budgets():
    today = datetime.now().date()
    recurring_budgets = Budget.query.filter_by(is_recurring=True, end_date=today).all()
    for budget in recurring_budgets:
        new_start_date = budget.end_date + timedelta(days=1)
        new_end_date = new_start_date + (budget.end_date - budget.start_date)
        new_budget = Budget(
            user_id=budget.user_id,
            budget_category=budget.budget_category,
            budget_limit=budget.budget_limit,
            start_date=new_start_date,
            end_date=new_end_date,
            is_recurring=True
        )
        db.session.add(new_budget)
    db.session.commit()

