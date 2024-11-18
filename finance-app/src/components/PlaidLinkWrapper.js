import React from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { usePlaidLinkContext } from '../services/PlaidLinkProvider';
import api from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import { Button } from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';

function PlaidLinkWrapper() {
  const { linkToken } = usePlaidLinkContext();
  const { showNotification } = useNotification();

  const onSuccess = async (public_token, metadata) => {
    try {
      console.log('Plaid Link success, exchanging public token');
      const response = await api.post('/set_access_token', { public_token });
      console.log('Set access token response:', response);

      if (response.data.success) {
        try {
          const accountsResponse = await api.post('/fetch_account_info');
          console.log('Fetched accounts:', accountsResponse.data);
          showNotification('Bank account connected successfully!', 'success');
        } catch (accountError) {
          console.error('Error fetching accounts:', accountError);
          showNotification(
            'Account connected, but error fetching details. Please refresh.',
            'warning'
          );
        }
      } else {
        throw new Error(response.data.error || 'Failed to set access token');
      }
    } catch (error) {
      console.error('Error in handleOnSuccess:', error);
      showNotification(
        error.message || 'Failed to connect bank account',
        'error'
      );
    }
  };

  const onExit = (err, metadata) => {
    if (err != null) {
      console.error('Plaid Link error:', err);
      showNotification(err.message || 'Error connecting bank account', 'error');
    }
  };

  const config = {
    token: linkToken,
    onSuccess,
    onExit,
    onEvent: (eventName, metadata) => {
      // Optional: track events
      console.log('Plaid Event:', eventName, metadata);
    },
  };

  const { open, ready } = usePlaidLink(config);

  return (
    <Button
      variant="contained"
      startIcon={<AccountBalanceIcon />}
      onClick={() => open()}
      disabled={!ready}
      sx={{
        bgcolor: '#4318FF',
        color: 'white',
        '&:hover': { bgcolor: '#3311CC' },
      }}
    >
      Connect a bank account
    </Button>
  );
}

export default PlaidLinkWrapper;
