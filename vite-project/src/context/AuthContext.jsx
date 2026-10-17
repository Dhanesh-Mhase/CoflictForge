import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient, { setAccessToken } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize session on page refresh via HttpOnly refresh cookie
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const { data } = await apiClient.post('/auth/refresh');
        if (isMounted && data?.data) {
          setAccessToken(data.data.accessToken);
          setUser(data.data.user);
        }
      } catch (err) {
        // No active refresh session or expired
        setAccessToken(null);
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const loginWithGoogle = useCallback(async (idToken) => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.post('/auth/signin', { idToken });
      if (data?.data) {
        setAccessToken(data.data.accessToken);
        setUser(data.data.user);
        return { success: true, user: data.data.user };
      }
      throw new Error('Invalid authentication response');
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Sign in failed. Please try again.';
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await apiClient.post('/auth/signout');
    } catch (err) {
      console.warn('Signout request failed, clearing local state anyway');
    } finally {
      setAccessToken(null);
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    loginWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
