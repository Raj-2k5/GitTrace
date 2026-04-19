/* ============================================================
 * GitTrace — App Entry Point (v2)
 * ------------------------------------------------------------
 * Two-panel layout with:
 *  • Sticky 56px header (brand, search, status pill)
 *  • Repo Metadata Bar with BreadcrumbNav
 *  • Left panel (58%): Repo Analysis + commit timeline
 *  • Right panel (42%): heatmap + contributors
 *  • Empty state with example repo pills
 *  • Loading skeletons in both panels
 * ============================================================ */

import { useState, useMemo, useCallback } from 'react';
import useRepoData from './hooks/useRepoData';
import Timeline from './components/timeline/Timeline';
import RepoAnalysisCard from './components/analytics/RepoAnalysisCard';
import HotspotMap from './components/analytics/HotspotMap';
import ContributorCard from './components/analytics/ContributorCard';
import BreadcrumbNav from './components/nav/BreadcrumbNav';
import {
  processHotspotData,
  processContributorData,
  detectPrimaryLanguage,
  computeDateRange,
  computeTotalStats,
  formatNumber,
  stringToColor,
  getInitials,
} from './utils/analytics';
import './index.css';

// Example repos for empty state
const EXAMPLE_REPOS = [
  'facebook/react',
  'vercel/next.js',
  'tailwindlabs/tailwindcss',
];

function App() {
  const [url, setUrl] = useState('');

  const {
    isLoading,
    data,
    error,
    repoInfo,
    loadRepo,
  } = useRepoData();

  // Derived data (memoised)
  const hotspotData = useMemo(() => processHotspotData(data), [data]);
  const contributorData = useMemo(() => processContributorData(data), [data]);
  const primaryLang = useMemo(() => detectPrimaryLanguage(data), [data]);
  const dateRange = useMemo(() => computeDateRange(data), [data]);
  const totalStats = useMemo(() => computeTotalStats(data), [data]);

  // Handle form submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) loadRepo(url);
  };

  // Handle repo selection (from breadcrumb, related repos, or example pills)
  const handleTraceRepo = useCallback((repoUrl) => {
    setUrl(repoUrl);
    loadRepo(repoUrl);
  }, [loadRepo]);

  const hasData = data && data.length > 0 && !isLoading;

  return (
    <>
      {/* ═══════════ STICKY HEADER ═══════════ */}
      <header className="app-header">
        <span className="app-header__brand">GitTrace</span>

        <div className="app-header__search-wrap">
          <form
            id="repo-search-form"
            className="app-header__search"
            onSubmit={handleSubmit}
          >
            {/* Search icon */}
            <svg className="app-header__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>

            <input
              id="repo-url-input"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a GitHub URL or owner/repo…"
              className={`app-header__input${isLoading ? ' app-header__input--loading' : ''}`}
            />

            {/* Loading sweep */}
            {isLoading && <div className="search-sweep" />}

            <button
              id="repo-submit-btn"
              type="submit"
              disabled={isLoading}
              className="app-header__trace-btn"
            >
              {isLoading ? 'Tracing…' : 'Trace'}
            </button>
          </form>
        </div>

        {/* Status pill */}
        {hasData && (
          <div className="app-header__status">
            <div className="app-header__status-dot" />
            <span>LIVE</span>
            <span>{data.length} commit{data.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </header>

      {/* ═══════════ ERROR ═══════════ */}
      {error && (
        <div className="error-banner">
          ⚠ {error}
        </div>
      )}

      {/* ═══════════ REPO METADATA BAR ═══════════ */}
      {(hasData || isLoading) && repoInfo && (
        <div className={`metadata-bar${isLoading ? ' metadata-bar--skeleton' : ''}`}>
          {isLoading ? (
            <>
              <div className="metadata-bar__item">
                <div className="skeleton skeleton-line" style={{ width: '140px', height: '14px' }} />
              </div>
              <div className="metadata-bar__item">
                <div className="skeleton skeleton-line" style={{ width: '80px', height: '14px' }} />
              </div>
              <div className="metadata-bar__item">
                <div className="skeleton skeleton-line" style={{ width: '120px', height: '14px' }} />
              </div>
              <div className="metadata-bar__item">
                <div className="skeleton skeleton-line" style={{ width: '100px', height: '14px' }} />
              </div>
            </>
          ) : (
            <>
              {/* Breadcrumb Navigator */}
              <div className="metadata-bar__item metadata-bar__item--breadcrumb">
                <BreadcrumbNav
                  owner={repoInfo.owner}
                  repo={repoInfo.repo}
                  onSelectRepo={handleTraceRepo}
                />
              </div>

              {/* Commits */}
              <div className="metadata-bar__item">
                {data.length} commit{data.length !== 1 ? 's' : ''}
              </div>

              {/* Date range */}
              {dateRange && (
                <div className="metadata-bar__item">
                  {dateRange}
                </div>
              )}

              {/* Contributors */}
              {contributorData.length > 0 && (
                <div className="metadata-bar__item">
                  <div className="avatar-stack">
                    {contributorData.slice(0, 4).map((c, i) => (
                      c.avatar_url ? (
                        <img
                          key={i}
                          src={c.avatar_url}
                          alt={c.name}
                          className="avatar-stack__img"
                        />
                      ) : (
                        <div
                          key={i}
                          className="avatar-stack__initials"
                          style={{ background: stringToColor(c.name) }}
                        >
                          {getInitials(c.name)}
                        </div>
                      )
                    ))}
                  </div>
                  {contributorData.length} contributor{contributorData.length !== 1 ? 's' : ''}
                </div>
              )}

              {/* Language */}
              {primaryLang && (
                <div className="metadata-bar__item">
                  <div className="lang-dot" style={{ background: primaryLang.color }} />
                  {primaryLang.name}
                </div>
              )}

              {/* Total additions/deletions */}
              {(totalStats.additions > 0 || totalStats.deletions > 0) && (
                <div className="metadata-bar__item">
                  {totalStats.additions > 0 && (
                    <span className="metadata-bar__additions">
                      +{formatNumber(totalStats.additions)}
                    </span>
                  )}
                  {totalStats.deletions > 0 && (
                    <span className="metadata-bar__deletions">
                      −{formatNumber(totalStats.deletions)}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════ MAIN BODY ═══════════ */}
      {!hasData && !isLoading ? (
        /* ── EMPTY STATE ── */
        <div className="empty-state">
          <svg className="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
          <h2 className="empty-state__heading">Trace any public repository</h2>
          <p className="empty-state__subtext">
            Paste a GitHub URL above to visualize commit history,
            code hotspots, and contributor activity.
          </p>
          <div className="empty-state__pills">
            {EXAMPLE_REPOS.map((repo) => (
              <button
                key={repo}
                className="empty-state__pill"
                onClick={() => handleTraceRepo(`https://github.com/${repo}`)}
              >
                {repo}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── TWO-PANEL LAYOUT ── */
        <div className="panels">
          {/* LEFT PANEL — Repo Analysis + Commit Timeline */}
          <div className="panel-left">
            {/* Repository Analysis Card */}
            {hasData && (
              <RepoAnalysisCard
                commits={data}
                repoInfo={repoInfo}
                hotspotData={hotspotData}
              />
            )}

            <Timeline
              commits={data ?? []}
              isLoading={isLoading}
              repoInfo={repoInfo}
            />
          </div>

          {/* RIGHT PANEL — Heatmap + Contributors + Related Repos */}
          <div className="panel-right">
            {isLoading ? (
              <>
                <div className="heatmap-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <div className="skeleton skeleton-line" style={{ width: '16px', height: '16px', borderRadius: '4px' }} />
                    <div className="skeleton skeleton-line" style={{ width: '120px', height: '14px' }} />
                  </div>
                  <div className="skeleton skeleton-treemap" />
                </div>
                <div className="contributor-card" style={{ marginTop: '16px' }}>
                  <div className="skeleton skeleton-line" style={{ width: '100px', height: '14px', marginBottom: '14px' }} />
                  {[1, 2].map(i => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                      <div className="skeleton skeleton-line" style={{ width: '80px', height: '12px' }} />
                      <div style={{ flex: 1 }} />
                      <div className="skeleton skeleton-line" style={{ width: '60px', height: '12px' }} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <HotspotMap data={hotspotData} />
                <ContributorCard contributors={contributorData} />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default App;
