from flask_mail import Mail, Message

mail = Mail()

def send_email(user_email, subject, body):
    msg = Message(subject, recipients=[user_email], body=body)
    mail.send(msg)

def notify_user(user, message):
    # This will be expanded in the future to handle different types of notifications
    send_email_notification(user.email, "Budget Alert", message)
