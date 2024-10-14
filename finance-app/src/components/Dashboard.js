import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Button,
  Box,
  CircularProgress,
  useTheme,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { Link } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import api from '../services/api';
import { usePlaidLinkContext } from '../services/PlaidLinkProvider';
import { useAuth } from '../services/authContext';
import { formatCurrency } from '../utils/currencyFormatter';

function Dashboard() {
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [spendingTrends, setSpendingTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const { open, ready } = usePlaidLinkContext();
  const { isAuthenticated } = useAuth();
  const theme = useTheme();

  const fetchDashboardData = useCallback(async () => {
    if (isAuthenticated) {
      try {
        setLoading(true);
        const [
          transactionsResponse,
          budgetResponse,
          accountsResponse,
          spendingTrendsResponse,
        ] = await Promise.all([
          api.get('/recent_transactions'),
          api.get('/budget_summary'),
          api.get('/accounts'),
          api.get('/spending_trends'),
        ]);

        setRecentTransactions(transactionsResponse.data);
        setBudgetSummary(budgetResponse.data);
        setAccounts(accountsResponse.data.slice(0, 5)); // Only take top 5 accounts

        // Convert spending trends data to array and sort
        const trendsData = Object.entries(spendingTrendsResponse.data)
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5); // Take top 5 categories
        setSpendingTrends(trendsData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleOpenPlaidLink = useCallback(() => {
    if (ready) {
      open();
    }
  }, [open, ready]);

  // Custom tooltip for the pie chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{ bgcolor: 'background.paper', p: 2, border: '1px solid #ccc' }}
        >
          <Typography>{payload[0].name}</Typography>
          <Typography>{formatCurrency(payload[0].value)}</Typography>
        </Box>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Grid container spacing={3}>
        {/* Link Your Bank Account */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Link Your Bank Account
            </Typography>
            <Button
              variant="contained"
              onClick={handleOpenPlaidLink}
              disabled={!ready}
            >
              {ready ? 'Link Account' : 'Loading...'}
            </Button>
          </Paper>
        </Grid>

        {/* Budget Summary */}
        {budgetSummary && (
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Budget Summary
              </Typography>
              <Typography>
                Total Budget: {formatCurrency(budgetSummary.totalBudget)}
              </Typography>
              <Typography>
                Total Spent: {formatCurrency(budgetSummary.totalSpent)}
              </Typography>
              <Typography>
                Remaining: {formatCurrency(budgetSummary.remaining)}
              </Typography>
            </Paper>
          </Grid>
        )}

        {/* Recent Transactions */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Transactions
            </Typography>
            <List>
              {recentTransactions.map((transaction, index) => (
                <ListItem
                  key={index}
                  sx={{ flexDirection: 'column', alignItems: 'flex-start' }}
                >
                  <Typography variant="subtitle1">
                    {transaction.name} - {formatCurrency(transaction.amount)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Date: {new Date(transaction.date).toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Category: {transaction.category}
                  </Typography>
                  {transaction.description && (
                    <Typography variant="body2" color="text.secondary">
                      Description: {transaction.description}
                    </Typography>
                  )}
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Accounts */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Top 5 Linked Accounts
            </Typography>
            <List>
              {accounts.map((account, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={account.name}
                    secondary={formatCurrency(account.balance)}
                  />
                </ListItem>
              ))}
            </List>
            <Button
              component={Link}
              to="/accounts"
              variant="outlined"
              sx={{ mt: 2 }}
            >
              View All Accounts
            </Button>
          </Paper>
        </Grid>

        {/* Top Spending Categories */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Top Spending Categories
            </Typography>
            {spendingTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={spendingTrends}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) =>
                      `${entry.category}: ${formatCurrency(entry.amount)}`
                    }
                  >
                    {spendingTrends.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={theme.palette.primary[`A${(index + 1) * 100}`]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={(value) => `${value}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Typography variant="body2">
                No spending data available
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;
