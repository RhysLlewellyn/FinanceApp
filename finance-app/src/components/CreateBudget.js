import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextField,
  Button,
  Box,
  Typography,
  Switch,
  FormControlLabel,
} from '@mui/material';
import api from '../services/api';

function CreateBudget() {
  const [budget, setBudget] = useState({
    budget_category: '',
    budget_limit: '',
    start_date: '',
    end_date: '',
    is_recurring: false,
    recurrence_period: '',
  });
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setBudget((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/set_budget', budget);
      navigate('/budgets');
    } catch (error) {
      console.error('Error creating budget:', error);
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Create New Budget
      </Typography>
      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="Category"
          name="budget_category"
          value={budget.budget_category}
          onChange={handleChange}
          margin="normal"
          required
        />
        <TextField
          fullWidth
          label="Limit"
          name="budget_limit"
          type="number"
          value={budget.budget_limit}
          onChange={handleChange}
          margin="normal"
          required
        />
        <TextField
          fullWidth
          label="Start Date"
          name="start_date"
          type="date"
          value={budget.start_date}
          onChange={handleChange}
          margin="normal"
          InputLabelProps={{ shrink: true }}
          required
        />
        <TextField
          fullWidth
          label="End Date"
          name="end_date"
          type="date"
          value={budget.end_date}
          onChange={handleChange}
          margin="normal"
          InputLabelProps={{ shrink: true }}
          required
        />
        <FormControlLabel
          control={
            <Switch
              checked={budget.is_recurring}
              onChange={handleChange}
              name="is_recurring"
            />
          }
          label="Recurring"
        />
        {budget.is_recurring && (
          <TextField
            fullWidth
            label="Recurrence Period"
            name="recurrence_period"
            value={budget.recurrence_period}
            onChange={handleChange}
            margin="normal"
          />
        )}
        <Button
          type="submit"
          variant="contained"
          color="primary"
          sx={{ mt: 2 }}
        >
          Create Budget
        </Button>
      </form>
    </Box>
  );
}

export default CreateBudget;
