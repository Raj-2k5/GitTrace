/* ============================================================
 * GitTrace — ContributorCard Component
 * ------------------------------------------------------------
 * Compact contributor breakdown card for the right panel.
 * Shows per-author: avatar, name, commit count, +/- lines,
 * and a proportional progress bar.
 * ============================================================ */

import { formatNumber, stringToColor, getInitials } from '../../utils/analytics';

export default function ContributorCard({ contributors = [] }) {
  if (contributors.length === 0) return null;

  const maxCommits = contributors[0]?.commits || 1;

  return (
    <div className="contributor-card">
      <h3 className="contributor-card__title">Contributors</h3>

      {contributors.map((contributor, idx) => {
        const pct = (contributor.commits / maxCommits) * 100;
        const barColor = idx === 0 ? 'var(--accent-mint)' : 'var(--accent-violet)';
        const avatarColor = stringToColor(contributor.name);
        const initial = getInitials(contributor.name);
        const displayName = contributor.name === 'Unknown' ? 'Unknown author' : contributor.name;

        return (
          <div key={contributor.name + idx}>
            <div className="contributor-row">
              {contributor.avatar_url ? (
                <img
                  src={contributor.avatar_url}
                  alt={displayName}
                  className="contributor-row__avatar"
                />
              ) : (
                <div
                  className="contributor-row__initials"
                  style={{ background: avatarColor }}
                >
                  {initial}
                </div>
              )}
              <span className="contributor-row__name">{displayName}</span>
              <div className="contributor-row__stats">
                <span>{contributor.commits} commit{contributor.commits !== 1 ? 's' : ''}</span>
                {contributor.additions > 0 && (
                  <span style={{ color: 'var(--color-success)' }}>
                    +{formatNumber(contributor.additions)}
                  </span>
                )}
                {contributor.deletions > 0 && (
                  <span style={{ color: 'var(--color-danger)' }}>
                    −{formatNumber(contributor.deletions)}
                  </span>
                )}
              </div>
            </div>
            {/* Progress bar */}
            <div className="contributor-row__bar-wrap">
              <div
                className="contributor-row__bar"
                style={{ width: `${pct}%`, background: barColor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
