/* ============================================================
 * GitTrace — App Entry Point (v3)
 * ------------------------------------------------------------
 * Two-panel layout with:
 *  • Sticky 56px header (brand, search, auth, watched, status)
 *  • Repo Metadata Bar with BreadcrumbNav + Share/Watch/Compare
 *  • Left panel (58%): Repo Analysis + commit timeline
 *  • Right panel (42%): heatmap + contributors
 *  • Empty state with example repo pills
 *  • Loading skeletons in both panels
 *  • Deep shareable URLs via React Router
 *  • Compare mode with two-column layout
 *  • Rate limit indicator
 *  • Notification toasts
 * ============================================================ */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import useRepoData from './hooks/useRepoData';
import { useAuth } from './contexts/AuthContext';
import Timeline from './components/timeline/Timeline';
import RepoAnalysisCard from './components/analytics/RepoAnalysisCard';
import HotspotMap from './components/analytics/HotspotMap';
import ContributorCard from './components/analytics/ContributorCard';
import BreadcrumbNav from './components/nav/BreadcrumbNav';
import ShareButton from './components/nav/ShareButton';
import GitHubLoginButton from './components/auth/GitHubLoginButton';
import RateLimitIndicator from './components/auth/RateLimitIndicator';
import WatchButton from './components/watch/WatchButton';
import WatchedPanel from './components/watch/WatchedPanel';
import NotificationToast from './components/watch/NotificationToast';
import CompareBar from './components/compare/CompareBar';
import CompareView from './components/compare/CompareView';
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

import GlobalTooltip from './components/ui/Tooltip';

// Example repos for empty state
const EXAMPLE_REPOS = [
  'facebook/react',
  'vercel/next.js',
  'tailwindlabs/tailwindcss',
];

function App() {
  const [url, setUrl] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const compareRepo = useRepoData();

  const {
    isLoading,
    data,
    error,
    repoInfo,
    loadRepo,
  } = useRepoData();

  // Auth & Rate Limit
  const { updateRateLimit, isAuthenticated } = useAuth();



  // Derived data (memoised)
  const hotspotData = useMemo(() => processHotspotData(data), [data]);
  const contributorData = useMemo(() => processContributorData(data), [data]);
  const primaryLang = useMemo(() => detectPrimaryLanguage(data), [data]);
  const dateRange = useMemo(() => computeDateRange(data), [data]);
  const totalStats = useMemo(() => computeTotalStats(data), [data]);

  // Handle URL-based routing: /trace/:owner/:repo
  useEffect(() => {
    const pathMatch = location.pathname.match(/^\/trace\/([^/]+)\/([^/]+)\/?$/);
    if (pathMatch) {
      const [, owner, repo] = pathMatch;
      const fullUrl = `https://github.com/${owner}/${repo}`;
      if (!repoInfo || repoInfo.owner !== owner || repoInfo.repo !== repo) {
        setUrl(fullUrl);
        loadRepo(fullUrl);
      }
    }
  }, [location.pathname]);

  // Handle ?compare= param
  useEffect(() => {
    const compareParam = searchParams.get('compare');
    if (compareParam && !compareMode) {
      setCompareMode(true);
      compareRepo.loadRepo(`https://github.com/${compareParam}`);
    }
  }, [searchParams]);

  // Handle form submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) {
      loadRepo(url);
    }
  };

  // Update URL when repo loads successfully
  useEffect(() => {
    if (repoInfo && data && data.length > 0 && !isLoading) {
      const targetPath = `/trace/${repoInfo.owner}/${repoInfo.repo}`;
      if (location.pathname !== targetPath) {
        navigate(targetPath, { replace: false });
      }
      // Update document title
      document.title = `${repoInfo.repo} — GitTrace`;
    }
  }, [repoInfo, data, isLoading]);

  // Handle popstate (back/forward)
  useEffect(() => {
    const handler = () => {
      const pathMatch = window.location.pathname.match(/^\/trace\/([^/]+)\/([^/]+)\/?$/);
      if (pathMatch) {
        const fullUrl = `https://github.com/${pathMatch[1]}/${pathMatch[2]}`;
        setUrl(fullUrl);
        loadRepo(fullUrl);
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [loadRepo]);

  // Handle repo selection (from breadcrumb, related repos, example pills, or watch)
  const handleTraceRepo = useCallback((repoUrl) => {
    setUrl(repoUrl);
    loadRepo(repoUrl);
    // Exit compare mode if active
    if (compareMode) {
      setCompareMode(false);
    }
  }, [loadRepo, compareMode]);

  // Compare handlers
  const handleCompare = useCallback((repoUrl) => {
    compareRepo.loadRepo(repoUrl);
    // Update URL param
    const parsed = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (parsed) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('compare', `${parsed[1]}/${parsed[2]}`);
      navigate(`${location.pathname}?${newParams.toString()}`, { replace: true });
    }
  }, [compareRepo, searchParams, location.pathname, navigate]);

  const handleExitCompare = useCallback(() => {
    setCompareMode(false);
    // Remove compare param from URL
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('compare');
    const qs = newParams.toString();
    navigate(qs ? `${location.pathname}?${qs}` : location.pathname, { replace: true });
  }, [searchParams, location.pathname, navigate]);

  const hasData = data && data.length > 0 && !isLoading;

  // OG metadata
  const ogTitle = repoInfo ? `${repoInfo.owner}/${repoInfo.repo} — GitTrace` : 'GitTrace — GitHub Repository Analyzer';
  const ogDescription = hasData
    ? `${data.length} commits · ${contributorData.length} contributors · Hottest file: ${hotspotData[0]?.name?.split('/').pop() || 'N/A'}`
    : 'Visualize commit history, code hotspots, and contributor activity for any public GitHub repository.';

  return (
    <>
      <Helmet>
        <title>{ogTitle}</title>
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
        <meta name="description" content={ogDescription} />
      </Helmet>
      
      <GlobalTooltip />

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
              placeholder={isAuthenticated ? "Paste any GitHub repo URL — including your private repos" : "Paste a GitHub URL or owner/repo…"}
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

        {/* Right side: Rate limit + Watched + Status/Login */}
        <div className="app-header__right">
          <RateLimitIndicator />
          <WatchedPanel onNavigate={handleTraceRepo} />

          {/* Status pill — only when data is loaded */}
          {hasData && (
            <div className="app-header__status">
              <div className="app-header__status-dot" />
              <span>LIVE</span>
              <span>{data.length} commit{data.length !== 1 ? 's' : ''}</span>
            </div>
          )}

          <GitHubLoginButton />
        </div>
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
                {repoInfo.private && (
                  <span style={{ 
                    background: '#1C1A0E', 
                    border: '1px solid #FBBF2440', 
                    color: '#FBBF24', 
                    borderRadius: '6px', 
                    padding: '3px 8px', 
                    fontSize: '11px', 
                    marginLeft: '12px',
                    fontWeight: 500
                  }}>🔒 Private</span>
                )}
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

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Action buttons: Watch, Share, Compare */}
              <div className="metadata-bar__actions">
                <WatchButton owner={repoInfo.owner} repo={repoInfo.repo} />
                <ShareButton repoInfo={repoInfo} />
                <button
                  className={`compare-btn${compareMode ? ' compare-btn--active' : ''}`}
                  onClick={() => compareMode ? handleExitCompare() : document.getElementById('compare-repo-input')?.focus()}
                  id="compare-toggle-btn"
                  data-tooltip={compareMode ? "Exit Compare Mode" : "Compare repositories"}
                  data-tooltip-desc={compareMode ? null : "Analyze two repos side-by-side."}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="8" height="8" rx="1" />
                    <rect x="14" y="13" width="8" height="8" rx="1" />
                    <path d="m7 11 3 3" />
                    <path d="m17 3-3 3" />
                  </svg>
                  <span>{compareMode ? 'Exit Compare' : '+ Compare'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════ COMPARE BAR ═══════════ */}
      {!compareMode && hasData && (
        <CompareBar
          onCompare={handleCompare}
          currentOwner={repoInfo.owner}
          currentRepo={repoInfo.repo}
          currentLanguage={primaryLang?.name}
        />
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
      ) : compareMode && compareRepo.data && compareRepo.data.length > 0 ? (
        /* ── COMPARE VIEW ── */
        <CompareView
          leftData={data}
          leftRepoInfo={repoInfo}
          leftLoading={isLoading}
          rightData={compareRepo.data}
          rightRepoInfo={compareRepo.repoInfo}
          rightLoading={compareRepo.isLoading}
        />
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

          {/* RIGHT PANEL — Heatmap + Contributors */}
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
                <HotspotMap data={hotspotData} commits={data} repoInfo={repoInfo} />
                <ContributorCard contributors={contributorData} />
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ NOTIFICATION TOASTS ═══════════ */}
      <NotificationToast onNavigate={handleTraceRepo} />
    </>
  );
}

export default App;
