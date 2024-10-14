# API Documentation

## Base URL

All API requests should be made to: `http://localhost:5000/api`

## Authentication

Most endpoints require a valid JWT token in the Authorization header:
`Authorization: Bearer <your_token_here>`

## Endpoints

### User Authentication

#### Register a new user

- **URL**: `/register`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "username": "string",
    "email": "string",
    "password": "string"
  }
  ```
- **Success Response**: `201 Created`
- **Error Response**: `400 Bad Request`

#### Login

- **URL**: `/login`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Success Response**: `200 OK`
  ```json
  {
    "token": "string",
    "user_id": "integer"
  }
  ```
- **Error Response**: `401 Unauthorized`

### Accounts

#### Get user's accounts

- **URL**: `/accounts`
- **Method**: `GET`
- **Auth required**: Yes
- **Success Response**: `200 OK`
  ```json
  [
    {
      "id": "integer",
      "name": "string",
      "type": "string",
      "balance": "float"
    }
  ]
  ```

#### Link a new account

- **URL**: `/accounts/link`
- **Method**: `POST`
- **Auth required**: Yes
- **Body**:
  ```json
  {
    "public_token": "string",
    "account_id": "string"
  }
  ```
- **Success Response**: `201 Created`
- **Error Response**: `400 Bad Request`

### Transactions

#### Get user's transactions

- **URL**: `/transactions`
- **Method**: `GET`
- **Auth required**: Yes
- **Query Parameters**:
  - `start_date`: YYYY-MM-DD (optional)
  - `end_date`: YYYY-MM-DD (optional)
  - `account_id`: integer (optional)
- **Success Response**: `200 OK`
  ```json
  [
    {
      "id": "integer",
      "date": "string",
      "amount": "float",
      "description": "string",
      "category": "string",
      "account_id": "integer"
    }
  ]
  ```

#### Add a new transaction

- **URL**: `/transactions`
- **Method**: `POST`
- **Auth required**: Yes
- **Body**:
  ```json
  {
    "date": "YYYY-MM-DD",
    "amount": "float",
    "description": "string",
    "category": "string",
    "account_id": "integer"
  }
  ```
- **Success Response**: `201 Created`
- **Error Response**: `400 Bad Request`

### Budgets

#### Get user's budgets

- **URL**: `/budgets`
- **Method**: `GET`
- **Auth required**: Yes
- **Success Response**: `200 OK`
  ```json
  [
    {
      "id": "integer",
      "category": "string",
      "amount": "float",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD"
    }
  ]
  ```

#### Create a new budget

- **URL**: `/budgets`
- **Method**: `POST`
- **Auth required**: Yes
- **Body**:
  ```json
  {
    "category": "string",
    "amount": "float",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD"
  }
  ```
- **Success Response**: `201 Created`
- **Error Response**: `400 Bad Request`

### Spending Trends

#### Get spending trends

- **URL**: `/spending-trends`
- **Method**: `GET`
- **Auth required**: Yes
- **Query Parameters**:
  - `start_date`: YYYY-MM-DD (optional)
  - `end_date`: YYYY-MM-DD (optional)
- **Success Response**: `200 OK`
  ```json
  [
    {
      "category": "string",
      "total_amount": "float"
    }
  ]
  ```
