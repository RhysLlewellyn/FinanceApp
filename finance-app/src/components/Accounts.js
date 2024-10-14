import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Box,
  Container,
  Paper,
  CircularProgress,
} from '@mui/material';
import api from '../services/api';
import { formatCurrency } from '../utils/currencyFormatter';

function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({
    key: 'name',
    direction: 'ascending',
  });

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        const response = await api.get('/accounts');
        setAccounts(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching accounts:', error);
        setError('Failed to fetch accounts');
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  const sortAccounts = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });

    const sortedAccounts = [...accounts].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'ascending' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'ascending' ? 1 : -1;
      return 0;
    });

    setAccounts(sortedAccounts);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ p: 3, mt: 4 }}>
          <Typography color="error" variant="h6">
            Error: {error}
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Accounts
        </Typography>
        <Box sx={{ mb: 2 }}>
          <Button
            onClick={() => sortAccounts('name')}
            variant="outlined"
            sx={{ mr: 1 }}
          >
            Sort by Name
          </Button>
          <Button
            onClick={() => sortAccounts('type')}
            variant="outlined"
            sx={{ mr: 1 }}
          >
            Sort by Type
          </Button>
          <Button onClick={() => sortAccounts('balance')} variant="outlined">
            Sort by Balance
          </Button>
        </Box>
        <Grid container spacing={3}>
          {accounts.map((account) => (
            <Grid item xs={12} sm={6} md={4} key={account.id}>
              <Card elevation={3}>
                <CardContent>
                  <Typography variant="h6" component="div" gutterBottom>
                    {account.name}
                  </Typography>
                  <Typography color="text.secondary" gutterBottom>
                    {account.type}
                  </Typography>
                  <Typography variant="h5" color="primary">
                    {formatCurrency(account.balance)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Container>
  );
}

export default Accounts;
