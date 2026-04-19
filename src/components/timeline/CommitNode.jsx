/* ============================================================
 * GitTrace — CommitNode Component (v3)
 * ------------------------------------------------------------
 * Features:
 *  • Heat-encoded 3px left border
 *  • Initials avatar with name-hashed color
 *  • Hash pill as anchor → opens GitHub commit in new tab
 *  • Ghost "↗ GitHub" button on card hover
 *  • Copy-to-clipboard on hash pill (secondary click)
 *  • Zero-value hiding, comma formatting, message clamp
 *  • Inline diff viewer (accordion expand/collapse)
 *  • Chevron rotation indicator for expanded state
 *  • Dimmed state for non-matching filter results
 * ============================================================ */

import { formatNumber, stringToColor, getInitials, getHeatColor } from '../../utils/analytics';
import DiffViewer from './DiffViewer';

// ── Date formatter ──
const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

// ── Aggregate file stats ──
const aggregateFileStats = (files = []) =>
  files.reduce(
    (acc, f) => ({
      totalFiles: acc.totalFiles + 1,
      totalAdditions: acc.totalAdditions + (f.additions ?? 0),
      totalDeletions: acc.totalDeletions + (f.deletions ?? 0),
    }),
    { totalFiles: 0, totalAdditions: 0, totalDeletions: 0 },
  );

export default function CommitNode({ commit, repoInfo, isExpanded, onToggleDiff, dimmed }) {
  const stats = aggregateFileStats(commit.files);
  const totalChanges = stats.totalAdditions + stats.totalDeletions;
  const heatColor = getHeatColor(totalChanges);
  const isLargeCommit = totalChanges > 1000;

  // Build GitHub commit URL
  const commitUrl = repoInfo
    ? `https://github.com/${repoInfo.owner}/${repoInfo.repo}/commit/${commit.sha}`
    : commit.url || '#';

  // ── Avatar ──
  const authorName = commit.author?.name ?? 'Unknown';
  const avatarUrl = commit.author?.avatar_url;
  const avatarColor = stringToColor(authorName);
  const initial = getInitials(authorName);

  // Handle card body click (expand diff)
  const handleCardClick = (e) => {
    // Don't expand if clicking links/buttons
    if (e.target.closest('a') || e.target.closest('.pill-hash') || e.target.closest('.commit-card__gh-btn')) {
      return;
    }
    onToggleDiff?.(commit.sha);
  };

  return (
    <div className={`commit-row${dimmed ? ' commit-row--dimmed' : ''}`}>
      {/* Timeline dot */}
      <div className={`commit-dot${isLargeCommit ? ' commit-dot--large' : ''}`} />

      {/* Card */}
      <div
        className={`commit-card${isExpanded ? ' commit-card--expanded' : ''}`}
        style={{ borderLeftColor: heatColor }}
        onClick={handleCardClick}
      >
        {/* Ghost "↗ GitHub" button — appears on card hover */}
        <a
          href={commitUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="commit-card__gh-btn"
          onClick={(e) => e.stopPropagation()}
        >
          ↗ GitHub
        </a>

        {/* Expand chevron */}
        <span className={`commit-card__chevron${isExpanded ? ' commit-card__chevron--open' : ''}`}>
          ▸
        </span>

        {/* Row 1: Avatar + Author + Date */}
        <div className="commit-card__header">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={authorName}
              className="commit-card__avatar"
            />
          ) : (
            <div
              className="commit-card__initials"
              style={{ background: avatarColor }}
            >
              {initial}
            </div>
          )}
          <span className="commit-card__author">{authorName}</span>
          <span className="commit-card__date">
            {formatDate(commit.author?.date)}
          </span>
        </div>

        {/* Row 2: Commit message */}
        <div className="commit-card__message">
          {commit.message?.split('\n')[0]}
        </div>

        {/* Row 3: Pills */}
        <div className="commit-card__footer">
          {/* Hash pill — proper anchor */}
          <a
            href={commitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pill-hash"
            title="View commit on GitHub"
            onClick={(e) => e.stopPropagation()}
          >
            {commit.sha?.slice(0, 7)}
            <span className="pill-hash__arrow">↗</span>
          </a>

          {/* File count */}
          {stats.totalFiles > 0 && (
            <span className="pill-files">
              <svg className="pill-files__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
              </svg>
              {stats.totalFiles} file{stats.totalFiles !== 1 ? 's' : ''}
            </span>
          )}

          {/* Additions — hide if zero */}
          {stats.totalAdditions > 0 && (
            <span className="stat-additions">
              +{formatNumber(stats.totalAdditions)}
            </span>
          )}

          {/* Deletions — hide if zero */}
          {stats.totalDeletions > 0 && (
            <span className="stat-deletions">
              −{formatNumber(stats.totalDeletions)}
            </span>
          )}
        </div>
      </div>

      {/* Inline Diff Viewer — accordion below card */}
      {isExpanded && (
        <div className="commit-row__diff-wrap">
          <DiffViewer commit={commit} repoInfo={repoInfo} />
        </div>
      )}
    </div>
  );
}
