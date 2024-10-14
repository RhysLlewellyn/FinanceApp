import React from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  useNavigate,
} from 'react-router-dom';
import './App.css';
import Layout from './components/layout';
import Login from './components/Login';
import Register from './components/Register';
import Accounts from './components/Accounts';
import Transactions from './components/Transactions';
import Budgets from './components/Budgets';
import PlaidLink from './components/PlaidLink';
import Dashboard from './components/Dashboard';
import Landing from './components/Landing';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './services/authContext';
import PlaidLinkWrapper from './components/PlaidLinkWrapper';
import Profile from './components/Profile.js';
import SpendingTrends from './components/SpendingTrends';
import { PlaidLinkProvider } from './services/PlaidLinkProvider';
import CreateBudget from './components/CreateBudget';

function App() {
  return (
    <Router>
      <AuthProvider>
        <PlaidLinkProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounts"
                element={
                  <ProtectedRoute>
                    <Accounts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions"
                element={
                  <ProtectedRoute>
                    <Transactions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/budgets"
                element={
                  <ProtectedRoute>
                    <Budgets />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/budgets/new"
                element={
                  <ProtectedRoute>
                    <CreateBudget />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/spending-trends"
                element={
                  <ProtectedRoute>
                    <SpendingTrends />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route path="/link" element={<PlaidLinkWrapper />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </PlaidLinkProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
