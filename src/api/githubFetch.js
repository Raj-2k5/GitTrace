/**
 * Centralised GitHub API fetch utility.
 * - Injects the active token (OAuth or PAT).
 * - Appends the standard GitHub v3 Accept header.
 * - Automatically tracks rate limit headers via events.
 * - Handles 401 (expired token) and 403 (rate limited).
 */

let _rateLimitCallback = null;

export function setRateLimitCallback(cb) {
  _rateLimitCallback = cb;
}

export default function githubFetch(url, options = {}) {
  const token = localStorage.getItem('github_token') || 
                (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GITHUB_TOKEN : null);
  
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/vnd.github.v3+json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, { ...options, headers }).then((res) => {
    // Notify rate limit via callback and event
    if (res.headers) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      const limit = res.headers.get('x-ratelimit-limit');
      const reset = res.headers.get('x-ratelimit-reset');
      
      if (remaining !== null) {
        if (_rateLimitCallback) {
          _rateLimitCallback(
            parseInt(remaining, 10),
            parseInt(limit, 10),
            parseInt(reset, 10)
          );
        }
        window.dispatchEvent(new CustomEvent('github-rate-limit', {
          detail: {
            remaining: parseInt(remaining, 10),
            limit: parseInt(limit, 10),
            reset: parseInt(reset, 10)
          }
        }));
      }
    }

    if (res.status === 401) {
      localStorage.removeItem('github_token');
      localStorage.removeItem('github_user');
      window.dispatchEvent(new CustomEvent('github-auth-expired'));
      return res;
    }

    if (res.status === 403) {
      console.warn('[GitTrace] Rate limited by GitHub API.');
      return res;
    }

    return res;
  });
}
