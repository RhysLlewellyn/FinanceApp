import React, { useState } from 'react';
import { Button, Typography, CircularProgress, Snackbar } from '@mui/material';
import { usePlaidLinkContext } from '../services/PlaidLinkProvider';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

function PlaidLink() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { open, ready } = usePlaidLinkContext();
  const navigate = useNavigate();

  const handleOpen = () => {
    setLoading(true);
    open();
  };

  const onSuccess = async (public_token, metadata) => {
    try {
      // Exchange public token for access token
      await api.post('/set_access_token', { public_token });

      // Fetch account info
      await api.post('/fetch_account_info');

      setLoading(false);
      navigate('/dashboard'); // Redirect to dashboard after successful link
    } catch (error) {
      console.error('Error linking account:', error);
      setError('Failed to link account. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div>
      <Typography variant="h4" gutterBottom>
        Link Your Bank Account
      </Typography>
      <Button
        variant="contained"
        onClick={handleOpen}
        disabled={!ready || loading}
      >
        {loading ? <CircularProgress size={24} /> : 'Link Account'}
      </Button>
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        message={error}
      />
    </div>
  );
}

export default PlaidLink;
