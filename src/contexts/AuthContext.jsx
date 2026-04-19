/* ============================================================
 * GitTrace — Auth Context (Device Flow)
 * ------------------------------------------------------------
 * Provides GitHub OAuth state via the Device Flow — no backend
 * server or client_secret required. The entire flow runs in the
 * browser using only the public client_id.
 *
 * Token priority:
 *   1. localStorage 'github_token' (from device flow)
 *   2. import.meta.env.VITE_GITHUB_TOKEN (PAT fallback)
 *
 * Rate-limit info is updated by API calls via events.
 * ============================================================ */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getStoredUser, getToken, signOut } from '../utils/githubFetch';

const AuthContext = createContext(null);

const CORS_PROXY = 'https://corsproxy.io/?';

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

  // Device flow state
  const [authState, setAuthState] = useState('idle');
  // idle | requesting | awaiting_user | success | expired | denied | error
  const [userCode, setUserCode] = useState('');
  const [verificationUri, setVerificationUri] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const pollIntervalRef = useRef(null);

  // Listen for global auth events
  useEffect(() => {
    const onSignOut = () => {
      setUser(null);
      setToken(null);
    };
    const onExpired = () => {
      setUser(null);
      setToken(null);
    };
    const onRateLimit = (e) => {
      const { remaining, limit } = e.detail;
      setRateLimitInfo(prev => ({ ...prev, remaining, limit }));
    };

    window.addEventListener('github-signed-out', onSignOut);
    window.addEventListener('github-auth-expired', onExpired);
    window.addEventListener('github-rate-limit', onRateLimit);

    return () => {
      window.removeEventListener('github-signed-out', onSignOut);
      window.removeEventListener('github-auth-expired', onExpired);
      window.removeEventListener('github-rate-limit', onRateLimit);
    };
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // ── Handle successful auth ──
  const handleSuccessfulAuth = useCallback(async (accessToken) => {
    if (!accessToken.startsWith('gho_') && !accessToken.startsWith('ghp_')) {
      setAuthError('Received invalid token from GitHub.');
      setAuthState('error');
      return;
    }

    localStorage.setItem('github_token', accessToken);
    setToken(accessToken);

    try {
      const userRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!userRes.ok) throw new Error('Failed to fetch profile');
      const userData = await userRes.json();
      if (!userData.login) throw new Error('Invalid user response');

      localStorage.setItem('github_user', JSON.stringify(userData));
      setUser(userData);
    } catch {
      // Token worked but profile fetch failed — still signed in
    }

    setAuthState('success');
    setTimeout(() => {
      setShowAuthModal(false);
      setAuthState('idle');
    }, 1200);
  }, []);

  // ── Poll for token ──
  const startPolling = useCallback((deviceCode, intervalSeconds) => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          CORS_PROXY + encodeURIComponent('https://github.com/login/oauth/access_token'),
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              client_id: clientId,
              device_code: deviceCode,
              grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
            })
          }
        );

        const data = await res.json();

        if (data.access_token) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          await handleSuccessfulAuth(data.access_token);
          return;
        }

        if (data.error === 'authorization_pending') return;

        if (data.error === 'slow_down') {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          startPolling(deviceCode, intervalSeconds + 5);
          return;
        }

        if (data.error === 'expired_token') {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setAuthState('expired');
          setAuthError('Code expired. Please try again.');
          return;
        }

        if (data.error === 'access_denied') {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setAuthState('denied');
          setAuthError('Authorization was cancelled on GitHub.');
          return;
        }
      } catch (err) {
        console.warn('Poll attempt failed:', err.message);
      }
    }, intervalSeconds * 1000);
  }, [handleSuccessfulAuth]);

  // ── Initiate device flow ──
  const initiateDeviceFlow = useCallback(async () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    setAuthState('requesting');
    setAuthError(null);
    setShowAuthModal(true);

    try {
      const res = await fetch(
        CORS_PROXY + encodeURIComponent('https://github.com/login/device/code'),
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            client_id: clientId,
            scope: 'read:user repo'
          })
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `GitHub responded with ${res.status}`);
      }

      const data = await res.json();

      if (!data.user_code || !data.device_code) {
        throw new Error('Invalid response from GitHub device flow. Ensure Device Flow is enabled on your OAuth App.');
      }

      setUserCode(data.user_code);
      setVerificationUri(data.verification_uri || 'https://github.com/login/device');
      setExpiresAt(Date.now() + (data.expires_in || 900) * 1000);
      setAuthState('awaiting_user');

      window.open(data.verification_uri || 'https://github.com/login/device', '_blank');
      startPolling(data.device_code, data.interval || 5);

    } catch (err) {
      setAuthState('error');
      setAuthError(err.message || 'Failed to start device flow.');
    }
  }, [startPolling]);

  // ── Login entry point ──
  const login = useCallback(() => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    if (!clientId || clientId.includes('your_') || clientId === 'undefined' || clientId === '') {
      setShowSetupModal(true);
      return;
    }
    initiateDeviceFlow();
  }, [initiateDeviceFlow]);

  // ── Cancel auth ──
  const cancelAuth = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setShowAuthModal(false);
    setAuthState('idle');
    setUserCode('');
    setAuthError(null);
  }, []);

  // ── Logout ──
  const logout = useCallback(() => {
    signOut();
    setUser(null);
    setToken(null);
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
    // Device flow state
    authState,
    userCode,
    verificationUri,
    expiresAt,
    authError,
    showSetupModal,
    setShowSetupModal,
    showAuthModal,
    setShowAuthModal,
    cancelAuth,
    initiateDeviceFlow,
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
