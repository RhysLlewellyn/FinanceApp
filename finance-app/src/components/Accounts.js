import React, { useState, useEffect, useCallback } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  LinearProgress,
  IconButton,
  ButtonGroup,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../services/api';
import { formatCurrency } from '../utils/currencyFormatter';
import PlaidLink from './PlaidLink';
import useNotification from '../hooks/useNotification';

function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [plaidLinking, setPlaidLinking] = useState(false);
  const [showPlaidLink, setShowPlaidLink] = useState(false);
  const [errorMessages, setErrorMessages] = useState({
    fetch: null,
    link: null,
    delete: null,
  });
  const { showNotification } = useNotification();

  const clearError = (errorType) => {
    setErrorMessages((prev) => ({ ...prev, [errorType]: null }));
  };

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      clearError('fetch');
      const response = await api.get('/accounts');
      setAccounts(response.data);
    } catch (error) {
      const errorMessage =
        error.response?.data?.error ||
        'Failed to fetch accounts. Please try again.';
      setErrorMessages((prev) => ({ ...prev, fetch: errorMessage }));
      console.error('Error fetching accounts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePlaidSuccess = useCallback(
    async (accounts, metadata) => {
      try {
        setPlaidLinking(true);
        clearError('link');
        await fetchAccounts();
        showNotification('Bank account linked successfully');
      } catch (error) {
        const errorMessage =
          error.response?.data?.error ||
          'Failed to link bank account. Please try again.';
        setErrorMessages((prev) => ({ ...prev, link: errorMessage }));
        console.error('Error linking account:', error);
      } finally {
        setPlaidLinking(false);
        setShowPlaidLink(false);
      }
    },
    [fetchAccounts]
  );

  const handleDeleteAccount = async (accountId) => {
    try {
      setIsLoading(true);
      clearError('delete');
      await api.delete(`/accounts/${accountId}`);
      await fetchAccounts();
      showNotification('Account deleted successfully');
    } catch (error) {
      const errorMessage =
        error.response?.data?.error ||
        'Failed to delete account. Please try again.';
      setErrorMessages((prev) => ({ ...prev, delete: errorMessage }));
      console.error('Error deleting account:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sortAccounts = (field) => {
    const sortedAccounts = [...accounts].sort((a, b) => {
      if (field === 'balance') {
        return b[field] - a[field];
      }
      return a[field].localeCompare(b[field]);
    });
    setAccounts(sortedAccounts);
  };

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

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

      <Typography variant="h4" gutterBottom>
        Linked Accounts
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Button
          onClick={() => setShowPlaidLink(true)}
          variant="contained"
          color="primary"
          disabled={plaidLinking || isLoading}
          sx={{ mr: 2 }}
        >
          Link New Bank Account
        </Button>
        <ButtonGroup variant="outlined" sx={{ mr: 2 }}>
          <Button onClick={() => sortAccounts('name')}>Sort by Name</Button>
          <Button onClick={() => sortAccounts('type')}>Sort by Type</Button>
          <Button onClick={() => sortAccounts('balance')}>
            Sort by Balance
          </Button>
        </ButtonGroup>
      </Box>

      {/* Loading state */}
      {(isLoading || plaidLinking) && (
        <Box sx={{ width: '100%', mt: 2, mb: 2 }}>
          <LinearProgress />
        </Box>
      )}

      {/* No accounts message */}
      {!isLoading && !plaidLinking && accounts.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            No accounts linked yet
          </Typography>
          <Button
            onClick={() => setShowPlaidLink(true)}
            variant="contained"
            sx={{ mt: 2 }}
          >
            Link Your First Account
          </Button>
        </Box>
      )}

      {/* Accounts grid */}
      <Grid container spacing={3}>
        {accounts.map((account) => (
          <Grid item xs={12} sm={6} md={4} key={account.id}>
            <Card>
              <CardContent>
                <Typography variant="h6">{account.name}</Typography>
                <Typography color="text.secondary" gutterBottom>
                  {account.type}
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(account.balance)}
                </Typography>
                <Box
                  sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}
                >
                  <IconButton
                    onClick={() =>
                      handleDeleteAccount(account.plaid_account_id)
                    }
                    disabled={isLoading}
                    color="error"
                    size="small"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Plaid Link */}
      {showPlaidLink && (
        <PlaidLink
          onSuccess={handlePlaidSuccess}
          onExit={() => {
            setPlaidLinking(false);
            setShowPlaidLink(false);
          }}
          onError={(error) => {
            console.error('Plaid Link error:', error);
            setErrorMessages((prev) => ({
              ...prev,
              link: 'Error connecting to bank. Please try again.',
            }));
            setPlaidLinking(false);
            setShowPlaidLink(false);
          }}
        />
      )}
    </Box>
  );
}

export default Accounts;
