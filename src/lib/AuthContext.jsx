import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44, supabase } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings] = useState(null);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Not logged in: ProtectedRoute redirects to /login. This is not an error.
        setUser(null);
        setIsAuthenticated(false);
        return;
      }
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      if (error.status === 403) {
        setAuthError({ type: 'user_not_registered', message: 'User not registered for this app' });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  const checkAppState = checkUserAuth;

  useEffect(() => {
    checkUserAuth();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // defer: do not call supabase inside the auth callback synchronously
        setTimeout(checkUserAuth, 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [checkUserAuth]);

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    base44.auth.logout(shouldRedirect ? window.location.href : undefined);
  };

  const navigateToLogin = () => base44.auth.redirectToLogin();

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError,
      appPublicSettings, authChecked, logout, navigateToLogin, checkUserAuth, checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
