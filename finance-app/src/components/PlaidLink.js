import React, { useState, useCallback, useEffect } from 'react';
import { Button, CircularProgress, Snackbar, Dialog } from '@mui/material';
import { usePlaidLink } from 'react-plaid-link';
import { usePlaidLinkContext } from '../services/PlaidLinkProvider';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

function PlaidLink({ onSuccess, onError, onExit }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { linkToken } = usePlaidLinkContext();
  const navigate = useNavigate();

  const handleOnSuccess = async (public_token, metadata) => {
    setLoading(true);
    try {
      const response = await api.post('/set_access_token', {
        public_token: public_token,
      });

      if (response.status === 201) {
        const accountResponse = await api.post('/fetch_account_info');

        if (accountResponse.data.accounts) {
          onSuccess(accountResponse.data.accounts, metadata);
        } else {
          throw new Error('No accounts returned from server');
        }
      }
    } catch (error) {
      console.error('Error in handleOnSuccess:', error);
      const errorMessage =
        error.response?.data?.error || 'Failed to link account';
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const config = {
    token: linkToken,
    onSuccess: handleOnSuccess,
    onExit: onExit,
  };

  const { open, ready } = usePlaidLink(config);

  useEffect(() => {
    if (ready) {
      open();
    }
  }, [ready, open]);

  return (
    <Dialog open={ready} onClose={onExit}>
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        message={error}
      />
    </Dialog>
  );
}

export default PlaidLink;
