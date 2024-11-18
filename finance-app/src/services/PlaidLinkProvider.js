import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { usePlaidLink } from 'react-plaid-link';
import api from './api';
import { useAuth } from './authContext';

const PlaidLinkContext = createContext();

export function usePlaidLinkContext() {
  return useContext(PlaidLinkContext);
}

export function PlaidLinkProvider({ children }) {
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const onSuccess = useCallback((public_token, metadata) => {
    console.log('Plaid Link success:', metadata);
  }, []);

  const onExit = useCallback((err, metadata) => {
    console.log('Plaid Link exit:', err, metadata);
  }, []);

  const config = {
    token: linkToken,
    onSuccess,
    onExit,
  };

  const { open, ready, error: plaidError } = usePlaidLink(config);

  useEffect(() => {
    const createToken = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        console.log('Attempting to create link token...');
        const response = await api.post('/create_link_token');
        console.log('Link token response:', response);
        setLinkToken(response.data.link_token);
      } catch (err) {
        console.error('Error creating link token:', err);
        setError('Failed to initialize Plaid. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    createToken();
  }, [user]);

  console.log('PlaidLinkProvider state:', { linkToken, loading, error, ready });

  if (loading) {
    return <div>Loading Plaid integration...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <PlaidLinkContext.Provider
      value={{ linkToken, open, ready, error: plaidError }}
    >
      {children}
    </PlaidLinkContext.Provider>
  );
}
