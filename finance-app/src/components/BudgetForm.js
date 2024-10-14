import React, { useState } from 'react';
import { TextField, Button, Box } from '@mui/material';
import api from '../services/api';

function BudgetForm({ onBudgetCreated, initialBudget }) {
  const [budget, setBudget] = useState(
    initialBudget || {
      category: '',
      limit: '',
      start_date: '',
      end_date: '',
      is_recurring: false,
      recurrence_period: 'monthly',
    }
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/budgets', budget);
      onBudgetCreated(response.data);
    } catch (error) {
      console.error('Error creating budget:', error);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <TextField
        label="Category"
        value={budget.category}
        onChange={(e) => setBudget({ ...budget, category: e.target.value })}
        fullWidth
        margin="normal"
      />
      <TextField
        label="Limit"
        type="number"
        value={budget.limit}
        onChange={(e) => setBudget({ ...budget, limit: e.target.value })}
        fullWidth
        margin="normal"
      />
      <TextField
        label="Start Date"
        type="date"
        value={budget.start_date}
        onChange={(e) => setBudget({ ...budget, start_date: e.target.value })}
        fullWidth
        margin="normal"
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        label="End Date"
        type="date"
        value={budget.end_date}
        onChange={(e) => setBudget({ ...budget, end_date: e.target.value })}
        fullWidth
        margin="normal"
        InputLabelProps={{ shrink: true }}
      />
      <Button type="submit" variant="contained" color="primary">
        {initialBudget ? 'Update Budget' : 'Create Budget'}
      </Button>
    </Box>
  );
}

export default BudgetForm;
