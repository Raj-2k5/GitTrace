/* ============================================================
 * GitTrace — Watched Panel (Dropdown)
 * ------------------------------------------------------------
 * Dropdown listing all watched repos with status indicators.
 * Accessible via "Watched (N)" link in header.
 * ============================================================ */

import { useState, useRef, useEffect } from 'react';
import { useWatch } from '../../contexts/WatchContext';

export default function WatchedPanel({ onNavigate }) {
  const { watchedRepos, removeWatch, markSeen } = useWatch();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (watchedRepos.length === 0) return null;

  const totalNew = watchedRepos.reduce((s, r) => s + (r.newCommits || 0), 0);

  const handleRepoClick = (r) => {
    markSeen(r.owner, r.repo);
    onNavigate(`https://github.com/${r.owner}/${r.repo}`);
    setOpen(false);
  };

  // Days since added
  const daysSince = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (diff === 0) return 'today';
    if (diff === 1) return '1 day ago';
    return `${diff} days ago`;
  };

  return (
    <div className="watched-panel-wrap" ref={wrapRef}>
      <button
        className="watched-panel__trigger"
        onClick={() => setOpen(!open)}
        id="watched-trigger"
      >
        Watched ({watchedRepos.length})
        {totalNew > 0 && <span className="watched-panel__badge">{totalNew}</span>}
      </button>

      {open && (
        <div className="watched-panel">
          <div className="watched-panel__title">Watched repositories</div>
          <div className="watched-panel__list">
            {watchedRepos.map(r => (
              <div key={`${r.owner}/${r.repo}`} className="watched-panel__row">
                <button
                  className="watched-panel__repo"
                  onClick={() => handleRepoClick(r)}
                >
                  <span className="watched-panel__name">{r.owner}/{r.repo}</span>
                  <span className="watched-panel__meta">
                    Added {daysSince(r.addedAt)}
                  </span>
                </button>
                <div className="watched-panel__status">
                  {r.newCommits > 0 ? (
                    <span className="watched-panel__new">● {r.newCommits} new</span>
                  ) : (
                    <span className="watched-panel__uptodate">✓ Up to date</span>
                  )}
                </div>
                <button
                  className="watched-panel__remove"
                  onClick={(e) => { e.stopPropagation(); removeWatch(r.owner, r.repo); }}
                  title="Remove from watched"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
