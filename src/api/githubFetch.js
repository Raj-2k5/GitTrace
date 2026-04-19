import { getActiveToken } from '../contexts/AuthContext';

let _rateLimitCallback = null;

/**
 * Set a generic callback to receive rate-limit updates after each API response.
 * Tied to AuthContext in App.jsx.
 */
export function setRateLimitCallback(cb) {
  _rateLimitCallback = cb;
}

/**
 * Centralised GitHub API fetch utility.
 * - Injects the active token (OAuth or PAT).
 * - Appends the standard GitHub v3 Accept header.
 * - Automatically tracks rate limit headers via callback.
 * - Handles 401 (expired token) and 403 (rate limited).
 */
export default function githubFetch(url, options = {}) {
  const token = getActiveToken();
  const headers = new Headers(options.headers || {});
  
  headers.set('Accept', 'application/vnd.github.v3+json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, { ...options, headers }).then((res) => {
    // Notify rate limit via callback
    if (_rateLimitCallback && res.headers) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      const limit = res.headers.get('x-ratelimit-limit');
      const reset = res.headers.get('x-ratelimit-reset');
      
      if (remaining !== null) {
        _rateLimitCallback(
          parseInt(remaining, 10),
          parseInt(limit, 10),
          parseInt(reset, 10)
        );
      }
    }

    if (res.status === 401) {
      // Unauthorised / Expired
      console.warn('[GitTrace] GitHub session expired or invalid token.');
      localStorage.removeItem('github_token');
      localStorage.removeItem('github_user');
      // For a real app, you might dispatch a global toast event here
      return res; // let the caller handle the 401 too if needed
    }

    if (res.status === 403) {
      console.warn('[GitTrace] Rate limited by GitHub API.');
      // Caller can handle 403 appropriately
      return res;
    }

    return res;
  });
}
