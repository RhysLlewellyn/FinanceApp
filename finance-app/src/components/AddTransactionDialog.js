import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import api from '../services/api';

function AddTransactionDialog({ open, onClose, onSuccess, accounts }) {
  const [transaction, setTransaction] = useState({
    amount: '',
    name: '',
    type: 'expense',
    account_id: '',
    date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!transaction.amount || !transaction.name || !transaction.account_id) {
      console.error('Missing required fields');
      return;
    }

    try {
      const transactionData = {
        amount:
          transaction.type === 'expense'
            ? -Math.abs(Number(transaction.amount))
            : Math.abs(Number(transaction.amount)),
        name: transaction.name,
        account_id: transaction.account_id,
        date: transaction.date,
      };

      console.log('Sending transaction data:', transactionData);

      const response = await api.post('/stored_transactions', transactionData);

      console.log('Transaction response:', response.data);

      onSuccess();
      setTransaction({
        amount: '',
        name: '',
        type: 'expense',
        account_id: '',
        date: new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      console.error('Error details:', error.response?.data);
      console.error('Error adding transaction:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 'bold' }}>Add Transaction</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth required>
              <InputLabel>Account</InputLabel>
              <Select
                value={transaction.account_id}
                label="Account"
                onChange={(e) =>
                  setTransaction({ ...transaction, account_id: e.target.value })
                }
              >
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel>Type</InputLabel>
              <Select
                value={transaction.type}
                label="Type"
                onChange={(e) =>
                  setTransaction({ ...transaction, type: e.target.value })
                }
              >
                <MenuItem value="expense">Expense</MenuItem>
                <MenuItem value="income">Income</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Amount"
              type="number"
              value={transaction.amount}
              onChange={(e) =>
                setTransaction({ ...transaction, amount: e.target.value })
              }
              required
              inputProps={{
                step: '0.01',
                min: '0.01',
              }}
            />

            <TextField
              label="Transaction Name"
              value={transaction.name}
              onChange={(e) =>
                setTransaction({ ...transaction, name: e.target.value })
              }
              required
            />

            <TextField
              type="date"
              label="Date"
              value={transaction.date}
              onChange={(e) =>
                setTransaction({ ...transaction, date: e.target.value })
              }
              required
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            sx={{
              bgcolor: '#4318FF',
              '&:hover': { bgcolor: alpha('#4318FF', 0.9) },
            }}
          >
            Add Transaction
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default AddTransactionDialog;
