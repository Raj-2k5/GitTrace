export async function githubFetch(url, options = {}) {
  const token = localStorage.getItem('github_token');

  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  const res = await fetch(url, { ...options, headers });

  // Update rate limit state
  const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') ?? '-1');
  const limit = parseInt(res.headers.get('X-RateLimit-Limit') ?? '-1');
  const reset = parseInt(res.headers.get('X-RateLimit-Reset') ?? '0');

  if (remaining !== -1) {
    window.dispatchEvent(new CustomEvent('github-rate-limit', {
      detail: { remaining, limit, reset }
    }));
  }

  if (res.status === 401) {
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_user');
    window.dispatchEvent(new CustomEvent('github-auth-expired'));
    return null;
  }

  if (res.status === 403 && remaining === 0) {
    const resetDate = new Date(reset * 1000);
    window.dispatchEvent(new CustomEvent('github-rate-limited', {
      detail: { resetDate }
    }));
    return null;
  }

  return res;
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('github_user');
    if (!raw || raw === 'undefined' || raw === 'null') return null;
    const parsed = JSON.parse(raw);
    // Validate it looks like a GitHub user object
    if (!parsed || typeof parsed !== 'object' || !parsed.login) {
      localStorage.removeItem('github_user');
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem('github_user');
    return null;
  }
}

export function getToken() {
  const token = localStorage.getItem('github_token');
  // GitHub OAuth tokens start with "gho_" or "ghp_"
  if (!token || (!token.startsWith('gho_') && !token.startsWith('ghp_'))) {
    if (token) localStorage.removeItem('github_token');
    return null;
  }
  return token;
}

export function signOut() {
  localStorage.removeItem('github_token');
  localStorage.removeItem('github_user');
  window.dispatchEvent(new CustomEvent('github-signed-out'));
}
