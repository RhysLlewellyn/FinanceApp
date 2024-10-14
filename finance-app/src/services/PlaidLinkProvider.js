import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import api from './api';

const PlaidLinkContext = createContext();

export function usePlaidLinkContext() {
  return useContext(PlaidLinkContext);
}

export function PlaidLinkProvider({ children }) {
  const [linkToken, setLinkToken] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const createLinkToken = async () => {
      try {
        const response = await api.post('/create_link_token');
        setLinkToken(response.data.link_token);
      } catch (error) {
        console.error('Error creating link token:', error);
        // You might want to set an error state here and handle it in your UI
      }
    };
    createLinkToken();
  }, []);

  const config = {
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      try {
        await api.post('/set_access_token', { public_token });
        // Handle successful link
      } catch (error) {
        console.error('Error setting access token:', error);
      }
    },
  };

  const { open, ready: plaidReady } = usePlaidLink(config);

  useEffect(() => {
    if (plaidReady) {
      setReady(true);
    }
  }, [plaidReady]);

  return (
    <PlaidLinkContext.Provider value={{ open, ready }}>
      {children}
    </PlaidLinkContext.Provider>
  );
}
