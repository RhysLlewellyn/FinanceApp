import React from 'react';
import Sidebar from './Sidebar';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import { useLocation } from 'react-router-dom';

function Layout({ children }) {
  const location = useLocation();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const hideSidebarRoutes = ['/', '/login', '/register'];
  const shouldHideSidebar = hideSidebarRoutes.includes(location.pathname);

  const sidebarWidth = isSmallScreen ? 70 : 240;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {!shouldHideSidebar && <Sidebar />}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${sidebarWidth}px)` },
          ml: shouldHideSidebar ? 0 : `${sidebarWidth}px`,
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default Layout;
