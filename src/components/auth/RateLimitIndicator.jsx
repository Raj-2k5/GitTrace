/* ============================================================
 * GitTrace — Rate Limit Indicator
 * ------------------------------------------------------------
 * Slim header indicator shown when API rate limit is low.
 * Amber when < 100 remaining, red countdown at 0.
 * ============================================================ */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function RateLimitIndicator() {
  const { rateLimitInfo, isAuthenticated, login } = useAuth();
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (rateLimitInfo.remaining !== 0 || !rateLimitInfo.resetAt) return;
    const tick = () => {
      const diff = rateLimitInfo.resetAt.getTime() - Date.now();
      if (diff <= 0) {
        setCountdown('');
        return;
      }
      const min = Math.floor(diff / 60000);
      const sec = Math.floor((diff % 60000) / 1000);
      setCountdown(`${min}m ${sec}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [rateLimitInfo.remaining, rateLimitInfo.resetAt]);

  const { remaining, limit } = rateLimitInfo;

  // Don't show if remaining is null or >= 200
  if (remaining === null || remaining >= 200) {
    return null;
  }

  if (isAuthenticated) {
    return (
      <div className="rate-limit-indicator" style={{ color: '#4FEFBC', background: 'rgba(79, 239, 188, 0.1)', cursor: 'default' }}>
        ⚡ {remaining.toLocaleString()} / {limit.toLocaleString()}
      </div>
    );
  }

  return (
    <button
      className="rate-limit-indicator rate-limit-indicator--warning"
      style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}
      onClick={login}
    >
        ⚠ {remaining} call{remaining !== 1 ? 's' : ''} left — sign in for 5,000/hr
    </button>
  );
}

