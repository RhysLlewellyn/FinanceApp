import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Grid,
  Paper,
  Box,
  CircularProgress,
} from '@mui/material';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency } from '../utils/currencyFormatter';

function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBudgets = async () => {
      try {
        setLoading(true);
        const response = await api.get('/budget_status');
        setBudgets(response.data);
      } catch (error) {
        console.error('Error fetching budgets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBudgets();
  }, []);

  const handleDeleteBudget = async (budgetId) => {
    try {
      await api.delete(`/delete_budget/${budgetId}`);
      setBudgets(budgets.filter((budget) => budget.id !== budgetId));
    } catch (error) {
      console.error('Error deleting budget:', error);
    }
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
        Budget Alerts
      </Typography>
      {budgets
        .filter((budget) => budget.status === 'Over Budget')
        .map((budget) => (
          <Paper key={budget.id} elevation={3} sx={{ p: 2, mb: 2 }}>
            <Typography variant="body1">
              {`${budget.category} is over budget by ${formatCurrency(
                Math.abs(budget.remaining)
              )}`}
            </Typography>
          </Paper>
        ))}
      <Button
        variant="contained"
        color="primary"
        component={Link}
        to="/budgets/new"
        sx={{ mt: 2, mb: 4 }}
      >
        CREATE NEW BUDGET
      </Button>
      <Grid container spacing={3}>
        {budgets.map((budget) => (
          <Grid item xs={12} sm={6} md={4} key={budget.id}>
            <Paper elevation={3} sx={{ p: 2 }}>
              <Typography variant="h6">{budget.category}</Typography>
              <Typography>Limit: {formatCurrency(budget.limit)}</Typography>
              <Typography>Spent: {formatCurrency(budget.spent)}</Typography>
              <Typography>
                Remaining: {formatCurrency(budget.remaining)}
              </Typography>
              {budget.is_recurring && (
                <Typography variant="body2">
                  Recurring: {budget.recurrence_period}
                </Typography>
              )}
              <Box sx={{ mt: 2 }}>
                <Button
                  component={Link}
                  to={`/budgets/edit/${budget.id}`}
                  sx={{ mr: 1 }}
                >
                  EDIT
                </Button>
                <Button onClick={() => handleDeleteBudget(budget.id)}>
                  DELETE
                </Button>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default Budgets;
