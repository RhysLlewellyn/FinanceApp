import React, { useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {
  Home as HomeIcon,
  AccountBalance as TransactionsIcon,
  ShowChart as InvestmentsIcon,
  CreditCard as CreditCardsIcon,
  AccountBalanceWallet as BudgetsIcon,
  AccountCircle as ProfileIcon,
  Settings as SettingsIcon,
  ExitToApp as LogoutIcon,
} from '@mui/icons-material';
import { useAuth } from '../services/authContext';

function Sidebar() {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { logout } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleMouseEnter = () => setIsExpanded(true);
  const handleMouseLeave = () => setIsExpanded(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const menuItems = [
    { name: 'Dashboard', icon: <HomeIcon />, path: '/dashboard' },
    { name: 'Transactions', icon: <TransactionsIcon />, path: '/transactions' },
    {
      name: 'Spending Trends',
      icon: <InvestmentsIcon />,
      path: '/spending-trends',
    },
    { name: 'Accounts', icon: <CreditCardsIcon />, path: '/accounts' },
    { name: 'Budgets', icon: <BudgetsIcon />, path: '/budgets' },
    { name: 'Profile', icon: <ProfileIcon />, path: '/profile' },
    { name: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  const expandedWidth = 240;
  const shrunkWidth = 70;
  const drawerWidth = isExpanded ? expandedWidth : shrunkWidth;

  return (
    <Drawer
      variant="permanent"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      sx={{
        width: shrunkWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          position: 'absolute',
          height: '100%',
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: theme.palette.background.default,
          borderRight: 'none',
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.standard,
          }),
          overflowX: 'hidden',
          zIndex: theme.zIndex.drawer,
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Box sx={{ p: 2, mt: 2, textAlign: isExpanded ? 'left' : 'center' }}>
            <Typography
              variant="h6"
              sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}
            >
              {isExpanded ? 'Alpha Finance' : 'AF'}
            </Typography>
          </Box>
          <List sx={{ mt: 2 }}>
            {menuItems.map((item) => (
              <ListItem
                button="true"
                key={item.name}
                component={RouterLink}
                to={item.path}
                selected={location.pathname === item.path}
                sx={{
                  mb: 1,
                  borderRadius: '10px',
                  mx: 1,
                  justifyContent: isExpanded ? 'flex-start' : 'center',
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.common.white,
                    '& .MuiListItemIcon-root': {
                      color: theme.palette.common.white,
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: isExpanded ? 40 : 'auto',
                    color:
                      location.pathname === item.path
                        ? theme.palette.common.white
                        : theme.palette.text.secondary,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {isExpanded && <ListItemText primary={item.name} />}
              </ListItem>
            ))}
          </List>
        </Box>
        <Box sx={{ mb: 2, mx: 1 }}>
          <ListItem
            button="true"
            onClick={handleLogout}
            sx={{
              borderRadius: '10px',
              justifyContent: isExpanded ? 'flex-start' : 'center',
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: isExpanded ? 40 : 'auto',
                color: theme.palette.text.secondary,
              }}
            >
              <LogoutIcon />
            </ListItemIcon>
            {isExpanded && <ListItemText primary="Logout" />}
          </ListItem>
        </Box>
      </Box>
    </Drawer>
  );
}

export default Sidebar;
