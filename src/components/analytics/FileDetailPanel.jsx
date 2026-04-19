/* ============================================================
 * GitTrace — File Detail Panel
 * ------------------------------------------------------------
 * Drill-down panel shown below heatmap when a tile is clicked.
 * Sections:
 *  1. File stats bar (5 metrics)
 *  2. Change frequency sparkline (bar chart)  
 *  3. Commit history for this file
 *  4. Author breakdown bar chart
 *  5. View on GitHub link
 * ============================================================ */

import { useState, useEffect, useMemo } from 'react';
import { formatNumber, stringToColor, getInitials, getHeatColor } from '../../utils/analytics';
import { githubFetch } from '../../utils/githubFetch';

// Compact date formatter
const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return iso; }
};

export default function FileDetailPanel({ filename, repoInfo, commits, onClose }) {
  const [fileCommits, setFileCommits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch commits that touched this file
  useEffect(() => {
    if (!repoInfo || !filename) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    githubFetch(
      `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/commits?path=${encodeURIComponent(filename)}&per_page=20`
    )
      .then(res => {
        if (!res || !res.ok) throw new Error(`GitHub API ${res?.status || 'Unknown'}`);
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        setFileCommits(data);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [filename, repoInfo]);

  // Compute stats from local commit data
  const stats = useMemo(() => {
    if (!commits || !filename) return null;

    let totalChanges = 0;
    let commitCount = 0;
    const authorSet = new Map();
    const dates = [];
    const perCommitChanges = [];

    for (const c of commits) {
      if (!c.files) continue;
      for (const f of c.files) {
        if (f.filename === filename) {
          const changes = (f.additions ?? 0) + (f.deletions ?? 0);
          totalChanges += changes;
          commitCount++;
          dates.push(c.author?.date);
          perCommitChanges.push({
            changes,
            date: c.author?.date,
            message: c.message?.split('\n')[0] || '',
            sha: c.sha,
          });

          const authorName = c.author?.name || 'Unknown';
          const existing = authorSet.get(authorName);
          if (existing) {
            existing.changes += changes;
            existing.commits++;
          } else {
            authorSet.set(authorName, {
              name: authorName,
              avatar_url: c.author?.avatar_url || '',
              changes,
              commits: 1,
            });
          }
        }
      }
    }

    const sortedDates = dates.filter(d => d).sort();
    const authors = Array.from(authorSet.values()).sort((a, b) => b.changes - a.changes);

    return {
      totalChanges,
      commitCount,
      authorCount: authors.length,
      firstModified: sortedDates[0] ? fmtDate(sortedDates[0]) : '—',
      lastModified: sortedDates.length > 0 ? fmtDate(sortedDates[sortedDates.length - 1]) : '—',
      perCommitChanges: perCommitChanges.reverse(), // chronological
      authors,
    };
  }, [commits, filename]);

  const baseName = filename.split('/').pop();
  const dirPath = filename.includes('/') ? filename.substring(0, filename.lastIndexOf('/')) : '';
  const blobUrl = repoInfo
    ? `https://github.com/${repoInfo.owner}/${repoInfo.repo}/blob/main/${filename}`
    : '#';

  // Max changes for sparkline scaling
  const maxBarChanges = stats?.perCommitChanges
    ? Math.max(...stats.perCommitChanges.map(c => c.changes), 1)
    : 1;

  // Max changes for author bar scaling
  const maxAuthorChanges = stats?.authors?.[0]?.changes || 1;

  return (
    <div className="file-detail" id="file-detail-panel">
      {/* Header */}
      <div className="file-detail__header">
        <div className="file-detail__title-wrap">
          <span className="file-detail__icon">📄</span>
          <span className="file-detail__filename">{baseName}</span>
        </div>
        <button className="file-detail__close" onClick={onClose} id="file-detail-close">
          ✕ Close
        </button>
      </div>
      {dirPath && <div className="file-detail__path">{dirPath}/</div>}

      {/* Section 1 — Stats */}
      {stats && (
        <div className="file-detail__stats">
          <div className="file-detail__stat-card">
            <span className="file-detail__stat-label">Total changes</span>
            <span className="file-detail__stat-value">{formatNumber(stats.totalChanges)}</span>
          </div>
          <div className="file-detail__stat-card">
            <span className="file-detail__stat-label">Commits</span>
            <span className="file-detail__stat-value">{stats.commitCount}</span>
          </div>
          <div className="file-detail__stat-card">
            <span className="file-detail__stat-label">Authors</span>
            <span className="file-detail__stat-value">{stats.authorCount}</span>
          </div>
          <div className="file-detail__stat-card">
            <span className="file-detail__stat-label">First modified</span>
            <span className="file-detail__stat-value file-detail__stat-value--sm">{stats.firstModified}</span>
          </div>
          <div className="file-detail__stat-card">
            <span className="file-detail__stat-label">Last modified</span>
            <span className="file-detail__stat-value file-detail__stat-value--sm">{stats.lastModified}</span>
          </div>
        </div>
      )}

      {/* Section 2 — Change frequency sparkline */}
      {stats?.perCommitChanges?.length > 0 && (
        <div className="file-detail__section">
          <span className="file-detail__section-label">CHANGE FREQUENCY OVER TIME</span>
          <div className="file-detail__sparkline">
            {stats.perCommitChanges.map((c, i) => (
              <div
                key={i}
                className="file-detail__spark-bar"
                style={{
                  height: `${Math.max(6, (c.changes / maxBarChanges) * 100)}%`,
                  background: getHeatColor(c.changes),
                }}
                title={`${fmtDate(c.date)}: ${c.message} (${c.changes} lines)`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Section 3 — Commit history */}
      <div className="file-detail__section">
        <span className="file-detail__section-label">COMMIT HISTORY FOR THIS FILE</span>
        {loading ? (
          <div className="file-detail__loading">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton skeleton-line" style={{ width: `${90 - i * 10}%`, height: '13px', marginBottom: '8px' }} />
            ))}
          </div>
        ) : error ? (
          <div className="file-detail__error">Could not load: {error}</div>
        ) : fileCommits && fileCommits.length > 0 ? (
          <div className="file-detail__commits">
            {fileCommits.map(fc => {
              const sha = fc.sha?.slice(0, 7);
              const commitUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/commit/${fc.sha}`;
              return (
                <div key={fc.sha} className="file-detail__commit-row">
                  <a href={commitUrl} target="_blank" rel="noopener noreferrer" className="pill-hash" onClick={e => e.stopPropagation()}>
                    {sha}
                  </a>
                  {fc.author?.avatar_url && (
                    <img src={fc.author.avatar_url} alt="" className="file-detail__commit-avatar" />
                  )}
                  <span className="file-detail__commit-msg">
                    {fc.commit?.message?.split('\n')[0] || ''}
                  </span>
                  <span className="file-detail__commit-date">
                    {fmtDate(fc.commit?.author?.date)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="file-detail__empty">No commit history found</div>
        )}
      </div>

      {/* Section 4 — Author breakdown */}
      {stats?.authors?.length > 0 && (
        <div className="file-detail__section">
          <span className="file-detail__section-label">AUTHOR BREAKDOWN</span>
          <div className="file-detail__authors">
            {stats.authors.map((a, i) => {
              const pct = Math.round((a.changes / stats.totalChanges) * 100);
              const barColor = i === 0 ? 'var(--accent-mint)' : 'var(--accent-violet)';
              return (
                <div key={a.name} className="file-detail__author-row">
                  {a.avatar_url ? (
                    <img src={a.avatar_url} alt={a.name} className="file-detail__author-avatar" />
                  ) : (
                    <div className="file-detail__author-initials" style={{ background: stringToColor(a.name) }}>
                      {getInitials(a.name)}
                    </div>
                  )}
                  <span className="file-detail__author-name">{a.name}</span>
                  <div className="file-detail__author-bar-wrap">
                    <div
                      className="file-detail__author-bar"
                      style={{ width: `${(a.changes / maxAuthorChanges) * 100}%`, background: barColor }}
                    />
                  </div>
                  <span className="file-detail__author-pct">{pct}% ({formatNumber(a.changes)})</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 5 — View on GitHub */}
      <a
        href={blobUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="file-detail__view-btn"
        onClick={e => e.stopPropagation()}
      >
        View {baseName} on GitHub ↗
      </a>
    </div>
  );
}
