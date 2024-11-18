import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Button,
  Grid,
  Paper,
  Box,
  CircularProgress,
  Alert,
  LinearProgress,
  IconButton,
} from '@mui/material';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency } from '../utils/currencyFormatter';
import useNotification from '../hooks/useNotification';
import DeleteIcon from '@mui/icons-material/Delete';

function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessages, setErrorMessages] = useState({
    fetch: null,
    delete: null,
    create: null,
  });
  const { showNotification } = useNotification();

  const clearError = (errorType) => {
    setErrorMessages((prev) => ({ ...prev, [errorType]: null }));
  };

  const fetchBudgets = useCallback(async () => {
    try {
      setIsLoading(true);
      clearError('fetch');
      const response = await api.get('/budget_status');
      setBudgets(response.data);
    } catch (error) {
      const errorMessage =
        error.response?.data?.error ||
        'Failed to fetch budgets. Please try again.';
      setErrorMessages((prev) => ({ ...prev, fetch: errorMessage }));
      console.error('Error fetching budgets:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDeleteBudget = async (budgetId) => {
    try {
      setIsLoading(true);
      clearError('delete');
      await api.delete(`/delete_budget/${budgetId}`);
      setBudgets(budgets.filter((budget) => budget.id !== budgetId));
      showNotification('Budget deleted successfully');
    } catch (error) {
      const errorMessage =
        error.response?.data?.error ||
        'Failed to delete budget. Please try again.';
      setErrorMessages((prev) => ({ ...prev, delete: errorMessage }));
      console.error('Error deleting budget:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      {/* Display errors */}
      {Object.entries(errorMessages).map(
        ([key, message]) =>
          message && (
            <Alert
              key={key}
              severity="error"
              onClose={() => clearError(key)}
              sx={{ mb: 2 }}
            >
              {message}
            </Alert>
          )
      )}

      {/* Loading state */}
      {isLoading && (
        <Box sx={{ width: '100%', mt: 2, mb: 2 }}>
          <LinearProgress />
        </Box>
      )}

      <Typography variant="h4" gutterBottom>
        Budget Alerts
      </Typography>

      {/* No budgets message */}
      {!isLoading && budgets.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            No budgets set yet
          </Typography>
          <Button
            component={Link}
            to="/budgets/new"
            variant="contained"
            sx={{ mt: 2 }}
          >
            Create Your First Budget
          </Button>
        </Box>
      )}

      {/* Budget alerts */}
      {budgets
        .filter((budget) => budget.status === 'Over Budget')
        .map((budget) => (
          <Paper key={budget.id} elevation={3} sx={{ p: 2, mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="body1">
                {`${budget.category} is over budget by ${formatCurrency(
                  Math.abs(budget.remaining)
                )}`}
              </Typography>
              <Box>
                <IconButton
                  onClick={() => handleDeleteBudget(budget.id)}
                  disabled={isLoading}
                  size="small"
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            </Box>
          </Paper>
        ))}
    </Box>
  );
}

export default Budgets;
