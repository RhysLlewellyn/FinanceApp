import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/authContext';
import api from '../services/api';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Grid,
  useTheme,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '../utils/currencyFormatter';

function SpendingTrends() {
  const [spendingData, setSpendingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isAuthenticated } = useAuth();
  const theme = useTheme();

  useEffect(() => {
    const fetchSpendingTrends = async () => {
      if (isAuthenticated) {
        try {
          setLoading(true);
          const response = await api.get('/spending_trends');
          setSpendingData(response.data);
          setLoading(false);
        } catch (error) {
          console.error('Error fetching spending trends:', error);
          setError('Failed to fetch spending trends');
          setLoading(false);
        }
      }
    };

    fetchSpendingTrends();
  }, [isAuthenticated]);

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

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error" variant="h6">
          {error}
        </Typography>
      </Box>
    );
  }

  if (!spendingData) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6">No spending data available</Typography>
      </Box>
    );
  }

  const categoryData = Object.entries(spendingData).map(
    ([category, amount]) => ({
      category,
      amount: parseFloat(amount.toFixed(2)),
    })
  );

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Spending Trends
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Spending by Category
            </Typography>
            <Box sx={{ height: 400, width: '100%' }}>
              <ResponsiveContainer>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="amount" fill={theme.palette.primary.main} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default SpendingTrends;
