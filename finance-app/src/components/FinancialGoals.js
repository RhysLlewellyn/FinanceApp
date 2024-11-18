import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  IconButton,
  Alert,
} from '@mui/material';
import { Link } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../services/api';
import { formatCurrency } from '../utils/currencyFormatter';
import useNotification from '../hooks/useNotification';

function FinancialGoals() {
  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessages, setErrorMessages] = useState({
    fetch: null,
    delete: null,
  });
  const { showNotification } = useNotification();

  const clearError = (errorType) => {
    setErrorMessages((prev) => ({ ...prev, [errorType]: null }));
  };

  const fetchGoals = useCallback(async () => {
    try {
      setIsLoading(true);
      clearError('fetch');
      const response = await api.get('/financial_goals');
      setGoals(response.data);
    } catch (error) {
      const errorMessage =
        error.response?.data?.error ||
        'Failed to fetch financial goals. Please try again.';
      setErrorMessages((prev) => ({ ...prev, fetch: errorMessage }));
      console.error('Error fetching goals:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDeleteGoal = async (goalId) => {
    try {
      setIsLoading(true);
      clearError('delete');
      await api.delete(`/financial_goals/${goalId}`);
      setGoals(goals.filter((goal) => goal.id !== goalId));
      showNotification('Goal deleted successfully');
    } catch (error) {
      const errorMessage =
        error.response?.data?.error ||
        'Failed to delete goal. Please try again.';
      setErrorMessages((prev) => ({ ...prev, delete: errorMessage }));
      console.error('Error deleting goal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  return (
    <Box sx={{ p: 3 }}>
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

      {/* No goals message */}
      {!isLoading && goals.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            No financial goals set yet
          </Typography>
          <Button
            component={Link}
            to="/goals/new"
            variant="contained"
            sx={{ mt: 2 }}
          >
            Create Your First Goal
          </Button>
        </Box>
      )}

      {/* Goals grid */}
      <Grid container spacing={3}>
        {goals.map((goal) => (
          <Grid item xs={12} sm={6} md={4} key={goal.id}>
            <Card>
              <CardContent>
                <Typography variant="h6">{goal.name}</Typography>
                <Box sx={{ my: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={(goal.current_amount / goal.target_amount) * 100}
                  />
                </Box>
                <Typography>
                  {formatCurrency(goal.current_amount)} of{' '}
                  {formatCurrency(goal.target_amount)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Target Date: {new Date(goal.target_date).toLocaleDateString()}
                </Typography>
                <Box
                  sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}
                >
                  <IconButton
                    component={Link}
                    to={`/goals/edit/${goal.id}`}
                    size="small"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleDeleteGoal(goal.id)}
                    size="small"
                    color="error"
                    disabled={isLoading}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default FinancialGoals;
