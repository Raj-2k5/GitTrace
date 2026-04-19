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
          <div key={contributor.name + idx} style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              {/* Avatar — clickable if login exists */}
              {contributor.login ? (
                <a
                  href={`https://github.com/${contributor.login}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    borderRadius: '50%',
                    flexShrink: 0,
                    textDecoration: 'none',
                    outline: 'none',
                    transition: 'box-shadow 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = '0 0 0 2px #4FEFBC';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  title={`View ${contributor.login} on GitHub\nView all public repositories and activity`}
                >
                  <img
                    src={contributor.avatar_url}
                    alt={contributor.login}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'block',
                      cursor: 'pointer',
                      objectFit: 'cover'
                    }}
                  />
                </a>
              ) : (
                // Non-clickable avatar for unknown contributors
                <div style={{
                  width: '32px', height: '32px',
                  borderRadius: '50%',
                  background: contributor.avatar_url ? `url(${contributor.avatar_url}) center/cover` : avatarColor,
                  display: 'flex', alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '13px', color: '#fff',
                  flexShrink: 0
                }}>
                  {contributor.avatar_url ? '' : initial}
                </div>
              )}

              {/* Spacer */}
              <div style={{ width: '10px', flexShrink: 0 }} />

              {/* Name — clickable if login exists */}
              {contributor.login ? (
                <a
                  href={`https://github.com/${contributor.login}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#D1D5DB',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                    // Prevent name from pushing stats off screen:
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    flex: '1 1 auto'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#4FEFBC';
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = '#D1D5DB';
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                  title={contributor.login ? `${contributor.login}'s GitHub profile\nView all public repositories and activity` : null}
                >
                  {displayName}
                </a>
              ) : (
                <span style={{
                  fontSize: '13px',
                  color: '#6B7280',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: '1 1 auto'
                }} title="No GitHub account linked to this commit author">
                  {displayName}
                </span>
              )}

              {/* Stats — NOT clickable, right-aligned */}
              <div style={{
                flex: '0 0 auto',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                marginLeft: '8px'
              }}>
                <span style={{ color: '#9CA3AF' }}>
                  {contributor.commits} commit{contributor.commits !== 1 ? 's' : ''}
                </span>
                {contributor.additions > 0 && (
                  <span style={{ color: '#34D399' }}>
                    +{formatNumber(contributor.additions)}
                  </span>
                )}
                {contributor.deletions > 0 && (
                  <span style={{ color: '#F87171' }}>
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
