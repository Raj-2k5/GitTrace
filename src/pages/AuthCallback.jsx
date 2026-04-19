import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Completing sign in...');
  const [error, setError] = useState(null);

  useEffect(() => {
    // Safety check — should only run at /auth/callback
    if (!window.location.pathname.includes('/auth/callback')) {
      navigate('/');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const savedState = sessionStorage.getItem('oauth_state');

    // CSRF check
    if (!state || state !== savedState) {
      setError('Authentication failed: state mismatch. Please try again.');
      return;
    }
    sessionStorage.removeItem('oauth_state');

    if (!code) {
      setError('No authorization code received from GitHub.');
      return;
    }

    async function exchangeToken() {
      try {
        setStatus('Exchanging token with GitHub...');
        
        const res = await fetch('/api/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.description || data.error || 'Token exchange failed');
        }

        // Store token
        localStorage.setItem('github_token', data.access_token);
        setStatus('Fetching your GitHub profile...');

        // Fetch user profile
        const userRes = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${data.access_token}` }
        });
        const user = await userRes.json();
        localStorage.setItem('github_user', JSON.stringify(user));

        setStatus('Signed in! Redirecting...');
        
        // Return to where user was before sign in
        const returnTo = sessionStorage.getItem('return_to') || '/';
        sessionStorage.removeItem('return_to');
        
        setTimeout(() => navigate(returnTo), 500);

      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err.message);
      }
    }

    exchangeToken();
  }, [navigate]);

  // Minimal loading/error UI — matches existing dark theme
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0E17',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {error ? (
        <>
          <div style={{ color: '#F87171', fontSize: '15px', fontWeight: 500 }}>
            ✕ {error}
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              background: '#1E293B',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              color: '#D1D5DB',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            ← Back to GitTrace
          </button>
        </>
      ) : (
        <>
          <div style={{
            width: '32px', height: '32px',
            border: '2px solid #1E293B',
            borderTop: '2px solid #4FEFBC',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <div style={{ color: '#9CA3AF', fontSize: '13px' }}>
            {status}
          </div>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
        </>
      )}
    </div>
  );
}
