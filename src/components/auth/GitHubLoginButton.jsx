/* ============================================================
 * GitTrace — GitHub Login Button + Device Flow Modals
 * ------------------------------------------------------------
 * When unauthenticated: shows "Sign in with GitHub" button.
 * When authenticated: shows [Avatar] [username ▾] dropdown.
 *
 * Modals:
 *  • Setup modal — when VITE_GITHUB_CLIENT_ID is not set
 *  • Device flow modal — shows user_code and polls for auth
 * ============================================================ */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

// ── Setup Modal (when client_id is missing) ──
function SetupModal({ onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('VITE_GITHUB_CLIENT_ID=paste_your_client_id_here');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <div className="auth-modal__header">
          <GitHubIcon />
          <span className="auth-modal__title">Set up GitHub Sign-in</span>
        </div>
        <p className="auth-modal__sub">Follow these steps once to enable GitHub authentication:</p>

        <div className="setup-steps">
          {/* Step 1 */}
          <div className="setup-step">
            <span className="setup-step__num">1</span>
            <div>
              <div className="setup-step__text">Go to GitHub OAuth Apps</div>
              <a href="https://github.com/settings/developers" target="_blank" rel="noopener noreferrer" className="setup-step__link">
                Open github.com/settings/developers ↗
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="setup-step">
            <span className="setup-step__num">2</span>
            <div>
              <div className="setup-step__text">Click "New OAuth App" and fill in:</div>
              <pre className="setup-code">{`Application name:    GitTrace
Homepage URL:        http://localhost:5173
Callback URL:        http://localhost:5173/auth/callback`}</pre>
              <div className="setup-step__warn">⚠ Enable "Device Flow" in the app settings — required for browser-only auth</div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="setup-step">
            <span className="setup-step__num">3</span>
            <div>
              <div className="setup-step__text">Copy your Client ID from the app page</div>
              <div className="setup-step__hint">(It looks like: Ov23liXXXXXXXXXXXXXX)</div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="setup-step">
            <span className="setup-step__num">4</span>
            <div>
              <div className="setup-step__text">Create a file named <code>.env</code> in your project root</div>
              <div className="setup-step__hint">(Same folder as package.json)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <pre className="setup-code" style={{ flex: 1 }}>VITE_GITHUB_CLIENT_ID=paste_your_client_id_here</pre>
                <button className="setup-copy-btn" onClick={handleCopy}>
                  {copied ? '✓' : '⎘'}
                </button>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="setup-step">
            <span className="setup-step__num">5</span>
            <div>
              <div className="setup-step__text">Restart Vite</div>
              <pre className="setup-code">Ctrl+C  then  npm run dev</pre>
              <div className="setup-step__hint">(Vite must restart to read new .env values)</div>
            </div>
          </div>
        </div>

        <button className="auth-modal__close-btn" onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body
  );
}

// ── Device Flow Modal ──
function DeviceFlowModal({ onCancel }) {
  const {
    authState,
    userCode,
    verificationUri,
    expiresAt,
    authError,
    initiateDeviceFlow,
  } = useAuth();

  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState('');

  // Countdown timer
  useEffect(() => {
    if (authState !== 'awaiting_user' || !expiresAt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      setCountdown(`${m}:${s.toString().padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [authState, expiresAt]);

  const handleCopy = () => {
    navigator.clipboard.writeText(userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isExpiringSoon = expiresAt && (expiresAt - Date.now()) < 120000;

  return createPortal(
    <div className="auth-overlay" onClick={onCancel}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>

        {/* ── Requesting state ── */}
        {authState === 'requesting' && (
          <div className="auth-modal__center">
            <div className="auth-spinner" />
            <div className="auth-modal__status-text">Connecting to GitHub...</div>
          </div>
        )}

        {/* ── Awaiting user authorization ── */}
        {authState === 'awaiting_user' && (
          <>
            <div className="auth-modal__header">
              <GitHubIcon />
              <span className="auth-modal__title">Authorize GitTrace on GitHub</span>
            </div>
            <p className="auth-modal__sub">Step 1: Copy this code</p>

            <div className="device-code">{userCode}</div>

            <button className="device-copy-btn" onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy code'}
            </button>

            <p className="auth-modal__sub" style={{ marginTop: '16px' }}>Step 2: Open GitHub and paste it there</p>

            <a
              href={verificationUri}
              target="_blank"
              rel="noopener noreferrer"
              className="device-open-github-btn"
            >
              Open GitHub to authorize ↗
            </a>

            <div className="auth-divider" />

            <div className="auth-modal__center">
              <div className="auth-spinner" />
              <div className="auth-modal__status-text">Waiting for authorization...</div>
              <div className={`auth-modal__countdown${isExpiringSoon ? ' auth-modal__countdown--warn' : ''}`}>
                Code expires in: {countdown}
              </div>
            </div>

            <button className="auth-modal__cancel-btn" onClick={onCancel}>Cancel</button>
          </>
        )}

        {/* ── Success ── */}
        {authState === 'success' && (
          <div className="auth-modal__center">
            <div className="auth-success-check">✓</div>
            <div className="auth-modal__success-text">Successfully signed in!</div>
          </div>
        )}

        {/* ── Error / Expired / Denied ── */}
        {(authState === 'expired' || authState === 'denied' || authState === 'error') && (
          <div className="auth-modal__center">
            <div className={`auth-error-icon${authState === 'denied' ? ' auth-error-icon--red' : ''}`}>
              {authState === 'denied' ? '✕' : '⚠'}
            </div>
            <div className="auth-modal__error-title">
              {authState === 'expired' ? 'Code expired' :
               authState === 'denied' ? 'Authorization cancelled' :
               'Connection issue'}
            </div>
            <div className="auth-modal__error-desc">{authError}</div>
            <button className="auth-modal__retry-btn" onClick={initiateDeviceFlow}>Try again</button>
            <button className="auth-modal__cancel-btn" onClick={onCancel}>Close</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Main Export ──
export default function GitHubLoginButton() {
  const {
    user,
    isAuthenticated,
    login,
    logout,
    showSetupModal,
    setShowSetupModal,
    showAuthModal,
    cancelAuth,
  } = useAuth();

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

  return (
    <>
      {/* Setup Modal */}
      {showSetupModal && (
        <SetupModal onClose={() => setShowSetupModal(false)} />
      )}

      {/* Device Flow Modal */}
      {showAuthModal && (
        <DeviceFlowModal onCancel={cancelAuth} />
      )}

      {/* Button / User Menu */}
      {!isAuthenticated ? (
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
      ) : (
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
      )}
    </>
  );
}
