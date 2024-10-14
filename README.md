# Personal Finance Manager

## Video Demo: [Your YouTube video URL here]

## Table of Contents

1. [Description](#description)
2. [Features](#features)
3. [Installation](#installation)
4. [Usage](#usage)
5. [API Integration](#api-integration)
6. [Technology Stack](#technology-stack)
7. [File Structure](#file-structure)
8. [Design Decisions](#design-decisions)
9. [Challenges and Future Improvements](#challenges-and-future-improvements)

## Description

Personal Finance Manager is a comprehensive web application designed to help users manage their finances effectively. It provides tools for tracking accounts, transactions, budgets, and spending trends, all within a user-friendly interface.

## Features

1. **User Authentication**: Secure login and registration system.
2. **Dashboard**: Overview of financial status.
3. **Account Management**: Link and manage multiple bank accounts.
4. **Transaction Tracking**: Record and categorize transactions.
5. **Budgeting**: Create and manage budgets.
6. **Spending Trends**: Visualize spending patterns.
7. **Profile Management**: Update personal information.

## Installation

### Prerequisites

- Node.js (v14 or later)
- Python (v3.8 or later)
- PostgreSQL

### Frontend Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/personal-finance-manager.git
   cd personal-finance-manager/frontend
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the frontend root directory and add:
   ```
   REACT_APP_API_URL=http://localhost:5000
   ```

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd ../backend
   ```
2. Create a virtual environment and activate it:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the backend root directory and add:
   ```
   DATABASE_URL=postgresql://username:password@localhost/dbname
   SECRET_KEY=your_secret_key
   PLAID_CLIENT_ID=your_plaid_client_id
   PLAID_SECRET=your_plaid_secret
   ```

### Database Setup

1. Create a PostgreSQL database:
   ```
   createdb personal_finance_manager
   ```
2. Run database migrations:
   ```
   flask db upgrade
   ```

## Usage

1. Start the backend server:
   ```
   cd backend
   flask run
   ```
2. In a new terminal, start the frontend development server:
   ```
   cd frontend
   npm start
   ```
3. Open a web browser and navigate to `http://localhost:3000`
4. Register a new account or log in with existing credentials
5. Use the navigation menu to access different features:
   - Dashboard: View overall financial status
   - Accounts: Link and manage bank accounts
   - Transactions: View and categorize transactions
   - Budgets: Set up and track budgets
   - Spending Trends: Analyze spending patterns

## API Integration

### Plaid API

This application uses Plaid for bank account integration. To set up Plaid:

1. Sign up for a Plaid account at https://dashboard.plaid.com/signup
2. Obtain your Plaid client ID and secret
3. Add these to your backend `.env` file

### Internal API Endpoints

- `POST /api/register`: Register a new user
- `POST /api/login`: Authenticate a user
- `GET /api/accounts`: Retrieve user's linked accounts
- `POST /api/accounts/link`: Link a new bank account
- `GET /api/transactions`: Retrieve user's transactions
- `POST /api/transactions`: Add a new transaction
- `GET /api/budgets`: Retrieve user's budgets
- `POST /api/budgets`: Create a new budget
- `GET /api/spending-trends`: Retrieve spending trend data

For detailed API documentation, refer to the `API.md` file in the `docs` directory.

## Technology Stack

- Frontend: React.js, Material-UI
- Backend: Python, Flask
- Database: PostgreSQL
- Authentication: JWT
- Third-party Integration: Plaid API

### File Structure:

- `src/components/`: React components for different pages and features
  - `Dashboard.js`: Main dashboard component
  - `Transactions.js`: Transaction management component
  - `Accounts.js`: Account management component
  - `Budgets.js`: Budget creation and tracking component
  - `SpendingTrends.js`: Spending analysis and visualization component
  - `Profile.js`: User profile management component
  - `Layout.js`: Overall layout component with navigation
- `src/services/`: Service files for API calls and context providers
  - `api.js`: Centralized API call functions
  - `authContext.js`: Authentication context provider
  - `PlaidLinkProvider.js`: Plaid integration service
- `backend/`: Python Flask backend files
  - `app.py`: Main Flask application file
  - `models.py`: Database models
  - `routes/`: API route handlers

### Design Decisions:

1. **React for Frontend**: Chosen for its component-based architecture, which allows for reusable UI elements and efficient rendering.

2. **Material-UI**: Provides a consistent, professional look across the application and offers responsive design out of the box.

3. **Flask Backend**: Lightweight and flexible Python framework, ideal for creating RESTful APIs.

4. **JWT Authentication**: Stateless authentication method, suitable for scalable web applications.

5. **Plaid Integration**: Offers secure, standardized access to bank account data, simplifying the process of linking accounts.

6. **Chart.js for Visualizations**: Provides interactive and customizable charts for clear representation of financial data.

7. **Modular Structure**: The application is divided into components and services, promoting code reusability and easier maintenance.

8. **Responsive Design**: Ensures the application is usable on various devices, from desktops to mobile phones.

### Challenges and Future Improvements:

During development, handling real-time updates of financial data and ensuring data accuracy across different components were significant challenges. Future improvements could include:

1. Implementing real-time notifications for budget alerts
2. Adding more detailed financial reports and forecasting features
3. Integrating with additional financial services beyond banking (e.g., investments, cryptocurrencies)
4. Enhancing data visualization with more interactive and customizable charts
5. Implementing machine learning for transaction categorization and spending predictions
