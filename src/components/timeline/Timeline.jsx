/* ============================================================
 * GitTrace — Timeline Component (v3)
 * ------------------------------------------------------------
 * Vertical commit timeline with:
 *  • Activity sparkline (daily commit bars)
 *  • Filter bar (search, author, date, size)
 *  • Month grouping with collapsible headers
 *  • Gradient vertical line (mint→violet)
 *  • Inline diff viewer (accordion, one at a time)
 *  • Pagination (max 20 commits per page)
 *  • Internal scrolling (panel-level, not page-level)
 * ============================================================ */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import CommitNode from './CommitNode';
import FilterBar from './FilterBar';
import {
  computeSparklineData,
  groupCommitsByMonth,
} from '../../utils/analytics';

const COMMITS_PER_PAGE = 20;

// ── Sparkline sub-component ──
function ActivitySparkline({ commits }) {
  const data = useMemo(() => computeSparklineData(commits), [commits]);

  if (data.length === 0) return null;

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="sparkline">
      <div className="sparkline__bars">
        {data.map((d) => (
          <div
            key={d.date}
            className="sparkline__bar"
            style={{ height: `${Math.max(4, (d.count / maxCount) * 100)}%` }}
          >
            {d.count > 0 && (
              <span className="sparkline__tooltip">
                {d.count} commit{d.count !== 1 ? 's' : ''} · {d.date}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Month Group sub-component ──
function MonthGroup({ group, repoInfo, expandedSha, onToggleDiff }) {
  const [collapsed, setCollapsed] = useState(false);
  const contentRef = useRef(null);

  return (
    <div className="month-group">
      <div
        className="month-group__header"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className={`month-group__chevron${collapsed ? ' month-group__chevron--collapsed' : ''}`}>
          ▸
        </span>
        <span className="month-group__label">{group.label}</span>
        <span className="month-group__count">
          · {group.commits.length} commit{group.commits.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div
        ref={contentRef}
        className="month-group__commits"
        style={{
          maxHeight: collapsed ? '0px' : 'none',
          overflow: collapsed ? 'hidden' : 'visible',
        }}
      >
        {group.commits.map((commit) => (
          <CommitNode
            key={commit.sha}
            commit={commit}
            repoInfo={repoInfo}
            isExpanded={expandedSha === commit.sha}
            onToggleDiff={onToggleDiff}
            dimmed={commit._dimmed}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Timeline Component ──
export default function Timeline({ commits = [], isLoading = false, repoInfo = null }) {
  const [page, setPage] = useState(0);
  const [expandedSha, setExpandedSha] = useState(null);
  const [filteredCommits, setFilteredCommits] = useState(null);
  const [isFiltered, setIsFiltered] = useState(false);
  const timelineRef = useRef(null);

  // Reset page when commits change
  useEffect(() => {
    setPage(0);
    setExpandedSha(null);
  }, [commits]);

  // Toggle diff — only one open at a time
  const handleToggleDiff = useCallback((sha) => {
    setExpandedSha(prev => prev === sha ? null : sha);
  }, []);

  // Filter callback
  const handleFilteredCommits = useCallback((filtered, active) => {
    setFilteredCommits(filtered);
    setIsFiltered(active);
    setPage(0);
  }, []);

  // Determine which commits to display
  const displayCommits = useMemo(() => {
    if (!isFiltered || !filteredCommits) return commits;

    // Mark non-matching as dimmed instead of hiding
    const filteredSet = new Set(filteredCommits.map(c => c.sha));
    return commits.map(c => ({
      ...c,
      _dimmed: !filteredSet.has(c.sha),
    }));
  }, [commits, filteredCommits, isFiltered]);

  // Pagination
  const totalCommits = displayCommits.length;
  const totalPages = Math.ceil(totalCommits / COMMITS_PER_PAGE);
  const startIdx = page * COMMITS_PER_PAGE;
  const endIdx = Math.min(startIdx + COMMITS_PER_PAGE, totalCommits);
  const pageCommits = displayCommits.slice(startIdx, endIdx);

  // Group by month
  const monthGroups = useMemo(
    () => groupCommitsByMonth(pageCommits),
    [pageCommits],
  );

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="panel-left" style={{ borderRight: 'none' }}>
        <div className="sparkline">
          <div className="skeleton" style={{ width: '100%', height: '48px' }} />
        </div>
        <div style={{ padding: '0 20px', flex: 1 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div className="skeleton skeleton-line" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                <div className="skeleton skeleton-line" style={{ width: '120px', height: '14px' }} />
                <div style={{ flex: 1 }} />
                <div className="skeleton skeleton-line" style={{ width: '80px', height: '12px' }} />
              </div>
              <div className="skeleton skeleton-line" style={{ width: '90%', height: '14px', marginBottom: '8px' }} />
              <div className="skeleton skeleton-line" style={{ width: '60%', height: '14px', marginBottom: '12px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <div className="skeleton skeleton-line" style={{ width: '60px', height: '20px' }} />
                <div className="skeleton skeleton-line" style={{ width: '50px', height: '20px' }} />
                <div className="skeleton skeleton-line" style={{ width: '45px', height: '20px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state (handled by App.jsx — Timeline only renders with data) ──
  if (!commits || commits.length === 0) return null;

  const matchCount = isFiltered ? filteredCommits?.length ?? 0 : null;

  return (
    <>
      {/* Sparkline — above the scroll area */}
      <ActivitySparkline commits={commits} />

      {/* Filter bar */}
      <FilterBar
        commits={commits}
        onFilteredCommits={handleFilteredCommits}
      />

      {/* Scrollable timeline area */}
      <div className="timeline" ref={timelineRef}>
        {/* Vertical gradient line */}
        <div
          className="timeline__line"
          style={{
            top: '24px',
            bottom: '24px',
          }}
        />

        {/* Month groups */}
        {monthGroups.map((group) => (
          <MonthGroup
            key={group.month}
            group={group}
            repoInfo={repoInfo}
            expandedSha={expandedSha}
            onToggleDiff={handleToggleDiff}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination__btn"
            disabled={page === 0}
            onClick={() => { setPage(p => p - 1); timelineRef.current?.scrollTo(0, 0); }}
          >
            ← Prev
          </button>
          <span>
            Showing {startIdx + 1}–{endIdx} of {totalCommits} commits
          </span>
          <button
            className="pagination__btn"
            disabled={page >= totalPages - 1}
            onClick={() => { setPage(p => p + 1); timelineRef.current?.scrollTo(0, 0); }}
          >
            Next →
          </button>
        </div>
      )}
    </>
  );
}
