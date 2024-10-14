import React, { useState, useEffect } from 'react';
import { Typography, Paper, Box, TextField, Button } from '@mui/material';
import { useAuth } from '../services/authContext';
import api from '../services/api';

function Profile() {
  const [profile, setProfile] = useState({ username: '', email: '' });
  const [isEditing, setIsEditing] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchProfile = async () => {
      if (isAuthenticated) {
        try {
          const response = await api.get('/profile');
          setProfile(response.data);
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      }
    };

    fetchProfile();
  }, [isAuthenticated]);

  const handleSave = async () => {
    try {
      await api.put('/profile', profile);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Profile
        </Typography>
        <Box component="form" sx={{ mt: 3 }}>
          <TextField
            fullWidth
            label="Username"
            value={profile.username}
            onChange={(e) =>
              setProfile({ ...profile, username: e.target.value })
            }
            disabled={!isEditing}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Email"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            disabled={!isEditing}
            sx={{ mb: 2 }}
          />
          {isEditing ? (
            <Button variant="contained" onClick={handleSave}>
              Save
            </Button>
          ) : (
            <Button variant="contained" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

export default Profile;
