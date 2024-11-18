import React from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom';
import './App.css';
import Layout from './components/Layout.js';
import Login from './components/Login';
import Register from './components/Register';
import Accounts from './components/Accounts';
import Transactions from './components/Transactions';
import Budgets from './components/Budgets';
import Dashboard from './components/Dashboard';
import Landing from './components/Landing';
import ProtectedRoute from './components/ProtectedRoute';
import PlaidLinkWrapper from './components/PlaidLinkWrapper.js';
import { AuthProvider } from './services/authContext';
import { PlaidLinkProvider } from './services/PlaidLinkProvider';
import Profile from './components/Profile.js';
import SpendingTrends from './components/SpendingTrends';
import CreateBudget from './components/CreateBudget';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import FinancialGoals from './components/FinancialGoals';
import CreateFinancialGoal from './components/CreateFinancialGoal';
import { NotificationProvider } from './contexts/NotificationContext';

function App() {
  return (
    <NotificationProvider>
      <div className="app-container">
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router>
            <AuthProvider>
              <Layout>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <PlaidLinkProvider>
                          <Dashboard />
                        </PlaidLinkProvider>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/accounts"
                    element={
                      <ProtectedRoute>
                        <PlaidLinkProvider>
                          <Accounts />
                        </PlaidLinkProvider>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/transactions"
                    element={
                      <ProtectedRoute>
                        <PlaidLinkProvider>
                          <Transactions />
                        </PlaidLinkProvider>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/budgets"
                    element={
                      <ProtectedRoute>
                        <PlaidLinkProvider>
                          <Budgets />
                        </PlaidLinkProvider>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/budgets/new"
                    element={
                      <ProtectedRoute>
                        <PlaidLinkProvider>
                          <CreateBudget />
                        </PlaidLinkProvider>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/spending-trends"
                    element={
                      <ProtectedRoute>
                        <PlaidLinkProvider>
                          <SpendingTrends />
                        </PlaidLinkProvider>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <PlaidLinkProvider>
                          <Profile />
                        </PlaidLinkProvider>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/link" element={<PlaidLinkWrapper />} />
                  <Route
                    path="/goals"
                    element={
                      <ProtectedRoute>
                        <PlaidLinkProvider>
                          <FinancialGoals />
                        </PlaidLinkProvider>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/goals/new"
                    element={
                      <ProtectedRoute>
                        <PlaidLinkProvider>
                          <CreateFinancialGoal />
                        </PlaidLinkProvider>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </AuthProvider>
          </Router>
        </ThemeProvider>
      </div>
    </NotificationProvider>
  );
}

export default App;
