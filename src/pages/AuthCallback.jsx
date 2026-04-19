/* ============================================================
 * GitTrace — Auth Callback (Legacy redirect)
 * ------------------------------------------------------------
 * This page is no longer used since GitTrace now uses the
 * GitHub Device Flow (no callback needed). If a user lands
 * here, redirect them home.
 * ============================================================ */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Device flow doesn't use callbacks — redirect home
    navigate('/', { replace: true });
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0E17',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#9CA3AF',
      fontSize: '13px'
    }}>
      Redirecting to GitTrace...
    </div>
  );
}
