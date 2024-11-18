import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import api from '../services/api';

function CreateFinancialGoal() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [goal, setGoal] = useState({
    name: '',
    target_amount: '',
    current_amount: '',
    target_date: new Date(),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/financial_goals', {
        ...goal,
        target_date: goal.target_date.toISOString(),
      });
      navigate('/goals');
    } catch (error) {
      console.error('Error creating goal:', error);
      setError('Failed to create goal. Please try again.');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setGoal((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={3} sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
        <Typography variant="h4" gutterBottom>
          Create New Financial Goal
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Goal Name"
            name="name"
            value={goal.name}
            onChange={handleChange}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="Target Amount"
            name="target_amount"
            type="number"
            value={goal.target_amount}
            onChange={handleChange}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="Current Amount"
            name="current_amount"
            type="number"
            value={goal.current_amount}
            onChange={handleChange}
            margin="normal"
          />

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Target Date"
              value={goal.target_date}
              onChange={(newValue) => {
                setGoal((prev) => ({
                  ...prev,
                  target_date: newValue,
                }));
              }}
              renderInput={(params) => (
                <TextField {...params} fullWidth margin="normal" required />
              )}
            />
          </LocalizationProvider>

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button type="submit" variant="contained" color="primary" fullWidth>
              Create Goal
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/goals')}
              fullWidth
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

export default CreateFinancialGoal;
