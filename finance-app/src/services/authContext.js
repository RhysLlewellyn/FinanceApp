import React, { createContext, useContext, useState } from 'react';
import { refreshToken } from './auth';

const AuthContext = createContext();

export const AuthProvider = ({ children, onLogout }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem('jwtToken')
  );

  const login = (token) => {
    localStorage.setItem('jwtToken', token);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('jwtToken');
    setIsAuthenticated(false);
    if (onLogout) {
      onLogout(); // Call the callback function to handle navigation
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
