import React from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { usePlaidLinkContext } from '../services/PlaidLinkProvider';

function PlaidLinkWrapper() {
  const { linkToken } = usePlaidLinkContext();
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token, metadata) => {
      // handle success
    },
  });

  return (
    <button onClick={() => open()} disabled={!ready}>
      Connect a bank account
    </button>
  );
}

export default PlaidLinkWrapper;
