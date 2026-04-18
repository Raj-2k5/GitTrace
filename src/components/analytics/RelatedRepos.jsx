/* ============================================================
 * GitTrace — RelatedRepos Component
 * ------------------------------------------------------------
 * Shows related repositories below the Contributors card.
 * Fetches from GitHub API based on topics and language.
 * ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import { fetchRelatedRepos } from '../../api/githubExtra';

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

export default function RelatedRepos({ owner, repo, language, onTraceRepo }) {
  const [repos, setRepos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const doFetch = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchRelatedRepos(owner, repo, language)
      .then(data => {
        setRepos(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [owner, repo, language]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  return (
    <div className="related-card">
      {/* Header */}
      <div className="related-card__header">
        <div>
          <h3 className="related-card__title">Related Repositories</h3>
          <span className="related-card__subtitle">Based on topics and language</span>
        </div>
        <button
          className="related-card__refresh"
          onClick={doFetch}
          title="Refresh suggestions"
        >
          ↺
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="related-card__loading">
          {[1, 2, 3].map(i => (
            <div key={i} className="related-card__skeleton">
              <div className="skeleton skeleton-line" style={{ width: '70%', height: '14px', marginBottom: '6px' }} />
              <div className="skeleton skeleton-line" style={{ width: '90%', height: '12px', marginBottom: '6px' }} />
              <div style={{ display: 'flex', gap: '6px' }}>
                <div className="skeleton skeleton-line" style={{ width: '50px', height: '16px' }} />
                <div className="skeleton skeleton-line" style={{ width: '40px', height: '16px' }} />
              </div>
            </div>
          ))}
        </div>
      ) : error || !repos || repos.length === 0 ? (
        <div className="related-card__empty">
          <span>No related repositories found</span>
          <a
            href={`https://github.com/${owner}?tab=repositories`}
            target="_blank"
            rel="noopener noreferrer"
            className="related-card__fallback-link"
          >
            Browse {owner}'s other repos ↗
          </a>
        </div>
      ) : (
        <div className="related-card__list">
          {repos.map(r => {
            const fullName = r.full_name || `${r.owner?.login}/${r.name}`;
            const ownerLogin = r.owner?.login || owner;
            return (
              <button
                key={fullName}
                className="related-repo"
                onClick={() => onTraceRepo(`https://github.com/${fullName}`)}
              >
                {/* Row 1: Name + Stars */}
                <div className="related-repo__row1">
                  <span className="related-repo__name">
                    <span className="related-repo__owner">{ownerLogin}/</span>
                    {r.name}
                  </span>
                  <span className="related-repo__stars">
                    <span style={{ color: '#FBBF24' }}>★</span> {formatStars(r.stargazers_count)}
                  </span>
                </div>

                {/* Row 2: Description */}
                {r.description && (
                  <div className="related-repo__desc">{r.description}</div>
                )}

                {/* Row 3: Language + Topics */}
                <div className="related-repo__tags">
                  {r.language && (
                    <span className="related-repo__lang-pill">
                      <span
                        className="related-repo__lang-dot"
                        style={{ background: LANG_COLORS[r.language] || '#6B7280' }}
                      />
                      {r.language}
                    </span>
                  )}
                  {(r.topics || []).slice(0, 2).map(t => (
                    <span key={t} className="related-repo__topic-pill">{t}</span>
                  ))}
                </div>

                {/* Hover CTA */}
                <span className="related-repo__cta">Trace this repo →</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
