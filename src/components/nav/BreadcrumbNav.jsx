/* ============================================================
 * GitTrace — BreadcrumbNav Component
 * ------------------------------------------------------------
 * Filesystem-style breadcrumb: [👤 owner] / [📁 repo]
 * Each segment opens a dropdown on click.
 * ============================================================ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchUserRepos, fetchBranches, fetchTags } from '../../api/githubExtra';

// Language colors for repo list
const LANG_COLORS = {
  JavaScript: '#F7DF1E', TypeScript: '#3178C6', Python: '#3572A5',
  Java: '#B07219', Go: '#00ADD8', Rust: '#DEA584', Ruby: '#CC342D',
  'C++': '#F34B7D', C: '#555555', 'C#': '#239120', PHP: '#4F5D95',
  Swift: '#FA7343', Kotlin: '#A97BFF', Vue: '#41B883', HTML: '#E34C26',
  CSS: '#1572B6', Shell: '#89E051',
};

function formatStars(n) {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Owner Dropdown ──
function OwnerDropdown({ owner, onSelectRepo, onClose }) {
  const [repos, setRepos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchUserRepos(owner)
      .then(data => { if (!cancelled) setRepos(data); })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [owner]);

  return (
    <div className="bc-dropdown bc-dropdown--owner">
      {/* Header */}
      <div className="bc-dropdown__header">
        <div className="bc-dropdown__avatar-wrap">
          <img
            src={`https://github.com/${owner}.png?size=72`}
            alt={owner}
            className="bc-dropdown__avatar"
          />
          <span className="bc-dropdown__username">{owner}</span>
        </div>
        <a
          href={`https://github.com/${owner}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bc-dropdown__gh-link"
        >
          View on GitHub ↗
        </a>
      </div>

      {/* Section title */}
      <div className="bc-dropdown__section-title">Public Repositories</div>

      {/* Content */}
      {error ? (
        <div className="bc-dropdown__error">
          <span>Could not load repositories</span>
          <a
            href={`https://github.com/${owner}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bc-dropdown__gh-link"
          >
            Open GitHub profile ↗
          </a>
        </div>
      ) : !repos ? (
        <div className="bc-dropdown__loading">
          {[1, 2, 3].map(i => (
            <div key={i} className="bc-dropdown__skeleton-row">
              <div className="skeleton skeleton-line" style={{ width: '60%', height: '13px' }} />
              <div className="skeleton skeleton-line" style={{ width: '20%', height: '13px' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="bc-dropdown__list">
          {repos.map(repo => (
            <button
              key={repo.name}
              className="bc-dropdown__repo-row"
              onClick={() => {
                onSelectRepo(`https://github.com/${owner}/${repo.name}`);
                onClose();
              }}
            >
              <span className="bc-dropdown__repo-name">📁 {repo.name}</span>
              <span className="bc-dropdown__repo-meta">
                {repo.language && (
                  <span className="bc-dropdown__repo-lang">
                    <span
                      className="bc-dropdown__lang-dot"
                      style={{ background: LANG_COLORS[repo.language] || '#6B7280' }}
                    />
                    {repo.language}
                  </span>
                )}
                <span className="bc-dropdown__repo-stars">★ {formatStars(repo.stargazers_count)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <a
        href={`https://github.com/${owner}?tab=repositories`}
        target="_blank"
        rel="noopener noreferrer"
        className="bc-dropdown__footer-link"
      >
        View all repositories on GitHub ↗
      </a>
    </div>
  );
}

// ── Repo Dropdown (Branches / Tags) ──
function RepoDropdown({ owner, repo, onClose }) {
  const [activeTab, setActiveTab] = useState('branches');
  const [branches, setBranches] = useState(null);
  const [tags, setTags] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchBranches(owner, repo).catch(() => []),
      fetchTags(owner, repo).catch(() => []),
    ]).then(([b, t]) => {
      if (!cancelled) {
        setBranches(b);
        setTags(t);
      }
    }).catch(err => {
      if (!cancelled) setError(err.message);
    });
    return () => { cancelled = true; };
  }, [owner, repo]);

  const items = activeTab === 'branches' ? branches : tags;

  return (
    <div className="bc-dropdown bc-dropdown--repo">
      <div className="bc-dropdown__section-title">Jump to branch / tag</div>

      {/* Tab pills */}
      <div className="bc-dropdown__tabs">
        <button
          className={`bc-dropdown__tab${activeTab === 'branches' ? ' bc-dropdown__tab--active' : ''}`}
          onClick={() => setActiveTab('branches')}
        >
          Branches
        </button>
        <button
          className={`bc-dropdown__tab${activeTab === 'tags' ? ' bc-dropdown__tab--active' : ''}`}
          onClick={() => setActiveTab('tags')}
        >
          Tags
        </button>
      </div>

      {/* Content */}
      {error ? (
        <div className="bc-dropdown__error">
          <span>Could not load {activeTab}</span>
        </div>
      ) : !items ? (
        <div className="bc-dropdown__loading">
          {[1, 2, 3].map(i => (
            <div key={i} className="bc-dropdown__skeleton-row">
              <div className="skeleton skeleton-line" style={{ width: '50%', height: '13px' }} />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bc-dropdown__empty">No {activeTab} found</div>
      ) : (
        <div className="bc-dropdown__list">
          {items.map(item => {
            const name = item.name;
            const icon = activeTab === 'branches' ? '⎇' : '🏷';
            const isDefault = activeTab === 'branches' && (name === 'main' || name === 'master');
            return (
              <div key={name} className="bc-dropdown__branch-row">
                <span className="bc-dropdown__branch-icon">{icon}</span>
                <span className="bc-dropdown__branch-name">{name}</span>
                {isDefault && <span className="bc-dropdown__branch-current">(default)</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <a
        href={`https://github.com/${owner}/${repo}`}
        target="_blank"
        rel="noopener noreferrer"
        className="bc-dropdown__footer-link"
      >
        View repo on GitHub ↗
      </a>
    </div>
  );
}

// ── Main BreadcrumbNav ──
export default function BreadcrumbNav({ owner, repo, onSelectRepo }) {
  const [openDropdown, setOpenDropdown] = useState(null);
  const wrapRef = useRef(null);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleClose = useCallback(() => setOpenDropdown(null), []);

  return (
    <div className="breadcrumb" ref={wrapRef}>
      {/* Owner chip */}
      <div className="breadcrumb__segment-wrap">
        <button
          className={`breadcrumb__chip${openDropdown === 'owner' ? ' breadcrumb__chip--active' : ''}`}
          onClick={() => setOpenDropdown(openDropdown === 'owner' ? null : 'owner')}
        >
          <span className="breadcrumb__chip-icon">👤</span>
          {owner}
        </button>
        {openDropdown === 'owner' && (
          <OwnerDropdown
            owner={owner}
            onSelectRepo={onSelectRepo}
            onClose={handleClose}
          />
        )}
      </div>

      {/* Separator */}
      <span className="breadcrumb__sep">/</span>

      {/* Repo chip */}
      <div className="breadcrumb__segment-wrap">
        <button
          className={`breadcrumb__chip${openDropdown === 'repo' ? ' breadcrumb__chip--active' : ''}`}
          onClick={() => setOpenDropdown(openDropdown === 'repo' ? null : 'repo')}
        >
          <span className="breadcrumb__chip-icon">📁</span>
          {repo}
        </button>
        {openDropdown === 'repo' && (
          <RepoDropdown
            owner={owner}
            repo={repo}
            onClose={handleClose}
          />
        )}
      </div>
    </div>
  );
}
