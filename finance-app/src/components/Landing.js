import React from 'react';
import { Typography, Button, Grid, Paper, Box, Container } from '@mui/material';
import { Link } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import { Navigate } from 'react-router-dom';

function Landing() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h3" gutterBottom>
            Welcome to Your Personal Finance Manager
          </Typography>
          <Typography variant="h5" gutterBottom>
            Take control of your finances with our powerful tools
          </Typography>
          <Grid
            container
            spacing={2}
            justifyContent="center"
            sx={{ mt: 4, mb: 4 }}
          >
            <Grid item>
              <Button
                component={Link}
                to="/login"
                variant="contained"
                color="primary"
                size="large"
              >
                Login
              </Button>
            </Grid>
            <Grid item>
              <Button
                component={Link}
                to="/register"
                variant="outlined"
                color="primary"
                size="large"
              >
                Register
              </Button>
            </Grid>
          </Grid>
          <Typography variant="body1" gutterBottom>
            Our app helps you:
          </Typography>
          <Box component="ul" sx={{ listStyleType: 'none', p: 0 }}>
            <Typography component="li">Track your spending</Typography>
            <Typography component="li">Set and manage budgets</Typography>
            <Typography component="li">
              Connect all your accounts in one place
            </Typography>
            <Typography component="li">
              Visualize your financial health
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}

export default Landing;
