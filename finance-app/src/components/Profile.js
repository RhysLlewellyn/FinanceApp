import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Avatar,
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import { useAuth } from '../services/authContext';
import api from '../services/api';
import { useNotification } from '../contexts/NotificationContext';

function Profile() {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
    photoURL: user?.photoURL || '',
    newPassword: '',
    confirmPassword: '',
    currentPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setError('');
    setSuccess('');
  };

  const handleUpdateProfile = async () => {
    try {
      setError('');

      // Validate passwords if changing
      if (profileData.newPassword) {
        if (profileData.newPassword !== profileData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (profileData.newPassword.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
      }

      // Update profile through backend API
      const response = await api.put('/update-profile', {
        displayName: profileData.displayName,
        email: profileData.email,
        photoURL: profileData.photoURL,
        currentPassword: profileData.currentPassword,
        newPassword: profileData.newPassword || undefined,
      });

      showNotification('Profile updated successfully', 'success');
      setSuccess('Profile updated successfully');
      setIsEditing(false);

      // Clear sensitive fields
      setProfileData((prev) => ({
        ...prev,
        newPassword: '',
        confirmPassword: '',
        currentPassword: '',
      }));
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      setError(errorMessage);
      showNotification(errorMessage, 'error');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Card sx={{ maxWidth: 800, margin: 'auto' }}>
        <CardContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={activeTab} onChange={handleTabChange}>
              <Tab label="Edit Profile" value="profile" />
              <Tab label="Security" value="security" />
              <Tab label="Preferences" value="preferences" />
            </Tabs>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          {activeTab === 'profile' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}
              >
                <Avatar
                  src={profileData.photoURL}
                  sx={{ width: 100, height: 100 }}
                />
                {isEditing && (
                  <Button variant="outlined" component="label">
                    Upload Photo
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={(e) => {
                        // Handle file upload logic here
                        // You might want to add image upload functionality later
                      }}
                    />
                  </Button>
                )}
              </Box>

              <TextField
                label="Display Name"
                value={profileData.displayName}
                disabled={!isEditing}
                onChange={(e) =>
                  setProfileData({
                    ...profileData,
                    displayName: e.target.value,
                  })
                }
              />

              <TextField
                label="Email"
                value={profileData.email}
                disabled={!isEditing}
                onChange={(e) =>
                  setProfileData({ ...profileData, email: e.target.value })
                }
              />

              {isEditing && (
                <>
                  <TextField
                    label="Current Password"
                    type="password"
                    value={profileData.currentPassword}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        currentPassword: e.target.value,
                      })
                    }
                  />
                  <TextField
                    label="New Password"
                    type="password"
                    value={profileData.newPassword}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        newPassword: e.target.value,
                      })
                    }
                  />
                  <TextField
                    label="Confirm New Password"
                    type="password"
                    value={profileData.confirmPassword}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        confirmPassword: e.target.value,
                      })
                    }
                  />
                </>
              )}

              {!isEditing ? (
                <Button
                  variant="contained"
                  onClick={() => setIsEditing(true)}
                  sx={{ bgcolor: '#4318FF' }}
                >
                  Edit Profile
                </Button>
              ) : (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleUpdateProfile}
                    sx={{ bgcolor: '#4318FF' }}
                  >
                    Save Changes
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {activeTab === 'security' && (
            <Typography>Security settings coming soon...</Typography>
          )}

          {activeTab === 'preferences' && (
            <Typography>Preferences settings coming soon...</Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default Profile;
