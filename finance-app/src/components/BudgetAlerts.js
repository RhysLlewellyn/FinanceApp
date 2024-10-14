import React, { useState, useEffect } from 'react';
import { Alert, Box } from '@mui/material';
import api from '../services/api';

function BudgetAlerts() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await api.get('/budget_alerts');
        setAlerts(response.data);
      } catch (error) {
        console.error('Error fetching budget alerts:', error);
      }
    };

    fetchAlerts();
  }, []);

  return (
    <Box sx={{ mb: 3 }}>
      {alerts.map((alert, index) => (
        <Alert key={index} severity="warning" sx={{ mb: 1 }}>
          {alert.message}
        </Alert>
      ))}
    </Box>
  );
}

export default BudgetAlerts;
