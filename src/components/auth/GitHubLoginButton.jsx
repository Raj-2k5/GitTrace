/* ============================================================
 * GitTrace — GitHub Login Button
 * ------------------------------------------------------------
 * Shows "Sign in with GitHub" when unauthenticated.
 * Shows [Avatar] [username ▾] with dropdown when authenticated.
 * ============================================================ */

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

// GitHub SVG mark (simplified, white)
function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export default function GitHubLoginButton() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const wrapRef = useRef(null);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!isAuthenticated) {
    return (
      <button 
        className="gh-login-btn" 
        onClick={login} 
        id="github-login-btn"
        data-tooltip="Sign in with GitHub"
        data-tooltip-desc="Enable 5,000 requests/hr ceiling."
      >
        <GitHubIcon />
        <span>Sign in with GitHub</span>
      </button>
    );
  }

  return (
    <div className="user-menu" ref={wrapRef}>
      <button
        className="user-menu__trigger"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        id="user-menu-btn"
      >
        <img
          src={user.avatar_url}
          alt={user.login}
          className="user-menu__avatar"
        />
        <span className="user-menu__name">{user.login}</span>
        <span className="user-menu__caret">▾</span>
      </button>

      {dropdownOpen && (
        <div className="user-dropdown">
          <div className="user-dropdown__header">
            <img src={user.avatar_url} alt={user.login} className="user-dropdown__avatar" />
            <div>
              <div className="user-dropdown__login">{user.login}</div>
              {user.name && <div className="user-dropdown__name">{user.name}</div>}
            </div>
          </div>
          <div className="user-dropdown__divider" />
          <a
            href={`https://github.com/${user.login}?tab=repositories`}
            target="_blank"
            rel="noopener noreferrer"
            className="user-dropdown__item"
            onClick={() => setDropdownOpen(false)}
          >
            📁 Your repositories
          </a>
          <a
            href={`https://github.com/${user.login}?tab=repositories&q=&type=private`}
            target="_blank"
            rel="noopener noreferrer"
            className="user-dropdown__item"
            onClick={() => setDropdownOpen(false)}
          >
            🔒 Your private repos
          </a>
          <a
            href="https://github.com/settings/developers"
            target="_blank"
            rel="noopener noreferrer"
            className="user-dropdown__item"
            onClick={() => setDropdownOpen(false)}
          >
            ⚙ OAuth App settings ↗
          </a>
          <div className="user-dropdown__divider" />
          <button
            className="user-dropdown__item user-dropdown__item--danger"
            onClick={() => { logout(); setDropdownOpen(false); }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
