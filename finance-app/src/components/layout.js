import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Menu,
  MenuItem,
  IconButton,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useAuth } from '../services/authContext';

function Layout({ children }) {
  const { isAuthenticated, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Alpha Finance
          </Typography>
          {isAuthenticated && (
            <>
              <Button color="inherit" component={RouterLink} to="/dashboard">
                Dashboard
              </Button>
              <IconButton
                size="large"
                edge="start"
                color="inherit"
                aria-label="menu"
                onClick={handleMenu}
              >
                <MenuIcon />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem
                  onClick={handleClose}
                  component={RouterLink}
                  to="/accounts"
                >
                  Accounts
                </MenuItem>
                <MenuItem
                  onClick={handleClose}
                  component={RouterLink}
                  to="/transactions"
                >
                  Transactions
                </MenuItem>
                <MenuItem
                  onClick={handleClose}
                  component={RouterLink}
                  to="/budgets"
                >
                  Budgets
                </MenuItem>
                <MenuItem
                  onClick={handleClose}
                  component={RouterLink}
                  to="/spending-trends"
                >
                  Spending Trends
                </MenuItem>
                <MenuItem
                  onClick={handleClose}
                  component={RouterLink}
                  to="/profile"
                >
                  Profile
                </MenuItem>
              </Menu>
              <Button color="inherit" onClick={logout}>
                Logout
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      <main>{children}</main>
    </>
  );
}

export default Layout;
