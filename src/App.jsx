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

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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

const MIN_LEFT_PERCENT = 35;
const MAX_LEFT_PERCENT = 70;
const DEFAULT_LEFT_PERCENT = 58;

function DividerHandle({ onDrag, isDragging, setIsDragging }) {
  const handleRef = useRef(null);

  function onMouseDown(e) {
    e.preventDefault();
    setIsDragging(true);
    const container = handleRef.current.closest('[data-panel-container]');

    function onMouseMove(moveEvent) {
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const newLeftPercent = ((moveEvent.clientX - containerRect.left) / containerRect.width) * 100;
      const clamped = Math.min(MAX_LEFT_PERCENT, Math.max(MIN_LEFT_PERCENT, newLeftPercent));
      onDrag(Math.round(clamped * 10) / 10);
    }

    function onMouseUp() {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onTouchStart(e) {
    setIsDragging(true);
    const container = handleRef.current.closest('[data-panel-container]');

    function onTouchMove(moveEvent) {
      if (!moveEvent.cancelable) return;
      moveEvent.preventDefault();
      if (!container) return;
      const touch = moveEvent.touches[0];
      const containerRect = container.getBoundingClientRect();
      const newLeftPercent = ((touch.clientX - containerRect.left) / containerRect.width) * 100;
      const clamped = Math.min(MAX_LEFT_PERCENT, Math.max(MIN_LEFT_PERCENT, newLeftPercent));
      onDrag(Math.round(clamped * 10) / 10);
    }

    function onTouchEnd() {
      setIsDragging(false);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.body.style.userSelect = '';
    }

    document.body.style.userSelect = 'none';
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  }

  function handleDoubleClick() {
    onDrag(DEFAULT_LEFT_PERCENT);
    localStorage.removeItem('gittrace_panel_split');
  }

  return (
    <div
      ref={handleRef}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onDoubleClick={handleDoubleClick}
      title="Drag to resize panels&#10;Double-click to reset to default split"
      className="divider-handle-wrap"
      style={{
        width: '12px',
        flexShrink: 0,
        position: 'relative',
        cursor: 'col-resize',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        margin: '0 -2px',
        zIndex: 10
      }}
    >
      <div style={{
        width: '2px',
        background: isDragging ? '#4FEFBC' : 'rgba(255,255,255,0.08)',
        borderRadius: '1px',
        transition: 'background 0.15s ease',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          opacity: isDragging ? 1 : 0,
          transition: 'opacity 0.15s ease'
        }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#4FEFBC' }} />
          ))}
        </div>
      </div>
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: '-4px',
        right: '-4px'
      }}
        onMouseEnter={e => {
          const line = e.currentTarget.previousSibling;
          const grip = line?.querySelector('div[style*="flex-direction: column"]');
          if (line && grip && !isDragging) {
            line.style.background = 'rgba(255,255,255,0.20)';
            grip.style.opacity = '0.5';
          }
        }}
        onMouseLeave={e => {
          const line = e.currentTarget.previousSibling;
          const grip = line?.querySelector('div[style*="flex-direction: column"]');
          if (line && grip && !isDragging) {
            line.style.background = 'rgba(255,255,255,0.08)';
            grip.style.opacity = '0';
          }
        }}
      />
    </div>
  );
}

function App() {
  const [url, setUrl] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Panel resizing state
  const [leftPercent, setLeftPercent] = useState(() => {
    const saved = localStorage.getItem('gittrace_panel_split');
    if (saved) {
      const parsed = parseFloat(saved);
      if (parsed >= MIN_LEFT_PERCENT && parsed <= MAX_LEFT_PERCENT) {
        return parsed;
      }
    }
    return DEFAULT_LEFT_PERCENT;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(1000);
  const leftPanelRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('gittrace_panel_split', leftPercent.toString());
  }, [leftPercent]);

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setLeftPanelWidth(entry.contentRect.width);
      }
    });
    if (leftPanelRef.current) {
      observer.observe(leftPanelRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const compareRepo = useRepoData();

  const {
    isLoading,
    data,
    error,
    repoInfo,
    loadRepo,
    resetRepo,
  } = useRepoData();

  // Auth & Rate Limit
  const { isAuthenticated } = useAuth();



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

  // Handle logo click — reset everything and go home
  const handleLogoClick = useCallback(() => {
    resetRepo();
    setUrl('');
    setCompareMode(false);
    navigate('/');
    window.history.replaceState({}, '', '/');
    document.title = 'GitTrace — GitHub Repository Analyzer';
  }, [resetRepo, navigate]);

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
        <button
          className="app-header__brand"
          onClick={handleLogoClick}
          aria-label="GitTrace home — clear and start over"
        >
          GitTrace
        </button>

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
        <div 
          className="panels"
          data-panel-container="true"
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
            width: '100%',
            position: 'relative'
          }}
        >
          {/* LEFT PANEL — Repo Analysis + Commit Timeline */}
          <div 
            className={`panel-left ${leftPanelWidth < 380 ? 'panel-compact' : ''}`}
            ref={leftPanelRef}
            style={{
              width: `${leftPercent}%`,
              flexBasis: `${leftPercent}%`,
              maxWidth: `${leftPercent}%`,
              minWidth: 0,
              flexShrink: 0,
              transition: isDragging ? 'none' : 'width 0.1s ease, max-width 0.1s ease, flex-basis 0.1s ease'
            }}
          >
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

          <DividerHandle onDrag={setLeftPercent} isDragging={isDragging} setIsDragging={setIsDragging} />

          {/* RIGHT PANEL — Heatmap + Contributors */}
          <div 
            className="panel-right"
            style={{
              flex: 1,
              minWidth: 0,
              maxWidth: 'none',
              width: 'auto'
            }}
          >
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
