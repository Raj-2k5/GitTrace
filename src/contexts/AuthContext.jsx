/* ============================================================
 * GitTrace — Auth Context
 * ------------------------------------------------------------
 * Provides GitHub OAuth state, token management, and
 * rate-limit tracking to the entire app tree.
 *
 * Token priority:
 *   1. localStorage 'github_token' (from OAuth flow)
 *   2. import.meta.env.VITE_GITHUB_TOKEN (PAT fallback)
 *
 * Rate-limit info is updated by API calls via updateRateLimit().
 * ============================================================ */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getStoredUser, getToken, signOut } from '../utils/githubFetch';

const AuthContext = createContext(null);

// Generate a random CSRF token for OAuth state param
function generateState() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => {
    return getToken() || import.meta.env.VITE_GITHUB_TOKEN || null;
  });
  const [rateLimitInfo, setRateLimitInfo] = useState({
    remaining: null,
    limit: null,
    resetAt: null,
  });

  useEffect(() => {
    // Update UI when signed out programmatically
    const onSignOut = () => {
      setUser(null);
      setToken(null);
    };
    
    // Token expired mid-session
    const onExpired = () => {
      setUser(null);
      setToken(null);
      // Show a toast: "Session expired — please sign in again"
    };

    // Rate limit hit
    const onRateLimited = (e) => {
      const { resetDate } = e.detail;
      // Show amber warning: "Rate limited — resets at {time}"
    };

    // Update rate limit display
    const onRateLimit = (e) => {
      const { remaining, limit } = e.detail;
      setRateLimitInfo(prev => ({ ...prev, remaining, limit }));
    };

    window.addEventListener('github-signed-out', onSignOut);
    window.addEventListener('github-auth-expired', onExpired);
    window.addEventListener('github-rate-limited', onRateLimited);
    window.addEventListener('github-rate-limit', onRateLimit);

    return () => {
      window.removeEventListener('github-signed-out', onSignOut);
      window.removeEventListener('github-auth-expired', onExpired);
      window.removeEventListener('github-rate-limited', onRateLimited);
      window.removeEventListener('github-rate-limit', onRateLimit);
    };
  }, []);

  const login = useCallback(() => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    if (!clientId || clientId.includes('your_') || clientId.includes('_here')) {
      alert(
        'GitHub sign-in is not configured.\n\n' +
        'Add VITE_GITHUB_CLIENT_ID to your .env file and restart Vite.'
      );
      return;
    }

    // Save where user currently is to return after auth
    sessionStorage.setItem('return_to', window.location.pathname);

    // Generate CSRF state token
    let state;
    try {
      state = crypto.randomUUID();
    } catch {
      state = Math.random().toString(36).substring(2) + Date.now();
    }
    sessionStorage.setItem('oauth_state', state);

    // Build GitHub authorization URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: import.meta.env.VITE_REDIRECT_URI,
      scope: 'read:user repo',
      state: state
    });

    // Redirect to GitHub
    window.location.href = 
      `https://github.com/login/oauth/authorize?${params.toString()}`;
  }, []);

  const logout = useCallback(() => {
    signOut();
  }, []);

  const updateRateLimit = useCallback((remaining, limit, resetTimestamp) => {
    setRateLimitInfo({
      remaining,
      limit,
      resetAt: resetTimestamp ? new Date(resetTimestamp * 1000) : null,
    });
  }, []);

  const isAuthenticated = !!user;

  const value = {
    user,
    token,
    isAuthenticated,
    rateLimitInfo,
    login,
    logout,
    updateRateLimit,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
