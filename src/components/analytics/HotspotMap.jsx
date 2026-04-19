/* ============================================================
 * GitTrace — HotspotMap Component (v3)
 * ------------------------------------------------------------
 * Custom DOM-based treemap with:
 *  • Squarified treemap algorithm (pure JS)
 *  • 40% max area cap per tile
 *  • 5-stop color scale (navy→green→amber→orange→crimson)
 *  • Gradient scrim labels with JetBrains Mono
 *  • Rich tooltip
 *  • Time-windowed analysis (All time / year / 90d / 30d / 7d)
 *  • Velocity indicator comparing windows
 *  • File drill-down panel on tile click
 * ============================================================ */

import { useState, useMemo, useRef, useCallback } from 'react';
import { formatNumber, processHotspotData } from '../../utils/analytics';
import FileDetailPanel from './FileDetailPanel';

// ── Color Scale (5 stops) ──
const COLOR_STOPS = ['#0F3460', '#16653A', '#7C4F00', '#8B2500', '#6B0000'];

function getTreemapColor(value, maxValue) {
  if (maxValue <= 0) return COLOR_STOPS[0];
  const t = Math.min(value / maxValue, 1);
  const idx = Math.min(Math.floor(t * (COLOR_STOPS.length - 1)), COLOR_STOPS.length - 2);
  const frac = (t * (COLOR_STOPS.length - 1)) - idx;

  const c1 = hexToRgb(COLOR_STOPS[idx]);
  const c2 = hexToRgb(COLOR_STOPS[idx + 1]);
  return `rgb(${lerp(c1.r, c2.r, frac)}, ${lerp(c1.g, c2.g, frac)}, ${lerp(c1.b, c2.b, frac)})`;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

// ── Time Window Constants ──
const TIME_WINDOWS = [
  { label: 'All time', days: null },
  { label: 'Last year', days: 365 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 7 days', days: 7 },
];

function filterCommitsByWindow(commits, days) {
  if (!days || !commits) return commits || [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return commits.filter(c => {
    const d = new Date(c.author?.date);
    return !isNaN(d) && d >= cutoff;
  });
}

function computeVelocity(commits, days) {
  if (!days || !commits || commits.length === 0) return null;

  const now = new Date();
  const currentStart = new Date();
  currentStart.setDate(now.getDate() - days);
  const prevStart = new Date();
  prevStart.setDate(now.getDate() - days * 2);

  let currentChanges = 0;
  let prevChanges = 0;

  for (const c of commits) {
    const d = new Date(c.author?.date);
    if (isNaN(d)) continue;

    const changes = (c.stats?.additions ?? 0) + (c.stats?.deletions ?? 0) ||
      (c.files || []).reduce((s, f) => s + (f.additions ?? 0) + (f.deletions ?? 0), 0);

    if (d >= currentStart) {
      currentChanges += changes;
    } else if (d >= prevStart && d < currentStart) {
      prevChanges += changes;
    }
  }

  if (prevChanges === 0 && currentChanges === 0) return null;
  if (prevChanges === 0) return { direction: 'up', pct: 100, label: 'New activity this period' };

  const pct = Math.round(((currentChanges - prevChanges) / prevChanges) * 100);
  if (Math.abs(pct) < 15) return { direction: 'same', pct: Math.abs(pct), label: `Similar activity to previous ${formatWindowLabel(days)}` };
  if (pct > 0) return { direction: 'up', pct, label: `${pct}% more changes than previous ${formatWindowLabel(days)}` };
  return { direction: 'down', pct: Math.abs(pct), label: `${Math.abs(pct)}% fewer changes than previous ${formatWindowLabel(days)}` };
}

function formatWindowLabel(days) {
  if (days === 7) return '7 days';
  if (days === 30) return '30 days';
  if (days === 90) return '90 days';
  if (days === 365) return 'year';
  return `${days} days`;
}

// ── Squarified Treemap Layout ──
function squarify(data, x, y, w, h) {
  if (data.length === 0 || w <= 0 || h <= 0) return [];

  const total = data.reduce((s, d) => s + d.cappedSize, 0);
  if (total <= 0) return [];

  const rects = [];
  let remaining = [...data];
  let cx = x, cy = y, cw = w, ch = h;

  while (remaining.length > 0) {
    const isHorizontal = cw >= ch;
    const sideLen = isHorizontal ? ch : cw;

    let row = [remaining[0]];
    let rowArea = remaining[0].cappedSize;
    let bestRatio = worstRatio(row, rowArea, total, sideLen, isHorizontal ? cw : ch);

    for (let i = 1; i < remaining.length; i++) {
      const testRow = [...row, remaining[i]];
      const testArea = rowArea + remaining[i].cappedSize;
      const testRatio = worstRatio(testRow, testArea, total, sideLen, isHorizontal ? cw : ch);

      if (testRatio <= bestRatio) {
        row = testRow;
        rowArea = testArea;
        bestRatio = testRatio;
      } else {
        break;
      }
    }

    const rowFrac = rowArea / total;
    const rowLen = isHorizontal ? cw * rowFrac : ch * rowFrac;

    let offset = 0;
    for (const item of row) {
      const itemFrac = item.cappedSize / rowArea;
      const itemLen = sideLen * itemFrac;

      if (isHorizontal) {
        rects.push({ ...item, x: cx, y: cy + offset, w: Math.max(0, rowLen - 2), h: Math.max(0, itemLen - 2) });
      } else {
        rects.push({ ...item, x: cx + offset, y: cy, w: Math.max(0, itemLen - 2), h: Math.max(0, rowLen - 2) });
      }
      offset += itemLen;
    }

    if (isHorizontal) { cx += rowLen; cw -= rowLen; }
    else { cy += rowLen; ch -= rowLen; }

    remaining = remaining.slice(row.length);
  }

  return rects;
}

function worstRatio(row, rowArea, totalArea, sideLen, fullLen) {
  if (rowArea <= 0 || totalArea <= 0 || sideLen <= 0 || fullLen <= 0) return Infinity;
  const rowLen = fullLen * (rowArea / totalArea);
  if (rowLen <= 0) return Infinity;

  let worst = 0;
  for (const item of row) {
    const frac = item.cappedSize / rowArea;
    const itemLen = sideLen * frac;
    if (itemLen <= 0 || rowLen <= 0) continue;
    const r = Math.max(rowLen / itemLen, itemLen / rowLen);
    if (r > worst) worst = r;
  }
  return worst;
}

// ── Tile Component ──
function TreemapTile({ rect, maxSize, totalChanges, onHover, onLeave, onClick, dimmed }) {
  const showLabel = rect.w >= 72 && rect.h >= 40;
  const color = getTreemapColor(rect.size, maxSize);

  return (
    <div
      className={`treemap__tile${dimmed ? ' treemap__tile--dimmed' : ''}`}
      style={{
        position: 'absolute',
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.w}px`,
        height: `${rect.h}px`,
        background: color,
        transition: 'width 0.3s ease, height 0.3s ease, left 0.3s ease, top 0.3s ease',
      }}
      onMouseEnter={(e) => onHover(e, rect)}
      onMouseLeave={onLeave}
      onClick={() => onClick?.(rect.name)}
    >
      {showLabel && (
        <>
          <div className="treemap__tile-scrim" />
          <div className="treemap__tile-label">
            <span className="treemap__tile-name">
              {rect.name.split('/').pop()}
            </span>
            <span className="treemap__tile-changes">
              {formatNumber(rect.size)} changes
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ──
export default function HotspotMap({ data, commits, repoInfo }) {
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [activeWindow, setActiveWindow] = useState(0); // index into TIME_WINDOWS
  const [selectedFile, setSelectedFile] = useState(null);

  // Observe container size
  const measuredRef = useCallback((node) => {
    if (node) {
      containerRef.current = node;
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          setContainerSize({
            width: entry.contentRect.width,
            height: Math.max(entry.contentRect.height, 220),
          });
        }
      });
      ro.observe(node);
      setContainerSize({
        width: node.offsetWidth,
        height: Math.max(node.offsetHeight, 220),
      });
    }
  }, []);

  // Filter commits by time window and recompute hotspot data
  const windowDays = TIME_WINDOWS[activeWindow].days;
  const windowedCommits = useMemo(
    () => filterCommitsByWindow(commits, windowDays),
    [commits, windowDays]
  );
  const windowedData = useMemo(
    () => windowDays ? processHotspotData(windowedCommits) : data,
    [windowedCommits, windowDays, data]
  );

  // Velocity indicator
  const velocity = useMemo(
    () => computeVelocity(commits, windowDays),
    [commits, windowDays]
  );

  // Process data with 40% area cap
  const { tiles, totalChanges, maxSize } = useMemo(() => {
    const d = windowedData;
    if (!d || d.length === 0) return { tiles: [], totalChanges: 0, maxSize: 0 };

    const total = d.reduce((s, item) => s + item.size, 0);
    const maxAllowed = total * 0.4;
    const maxRaw = d[0]?.size || 0;

    const processed = d.map(item => ({
      ...item,
      cappedSize: Math.min(item.size, maxAllowed),
      capped: item.size > maxAllowed,
    }));

    return { tiles: processed, totalChanges: total, maxSize: maxRaw };
  }, [windowedData]);

  // Compute layout
  const rects = useMemo(() => {
    if (tiles.length === 0 || containerSize.width <= 0) return [];
    return squarify(tiles, 0, 0, containerSize.width, containerSize.height);
  }, [tiles, containerSize]);

  // Tooltip handlers
  const calculateTooltipPosition = (e) => {
    let x = e.clientX + 12;
    let y = e.clientY - 10;
    const tooltipWidth = 200; // approximate width
    const container = e.currentTarget.closest('.heatmap-card')?.parentElement;
    
    if (container) {
      const colRect = container.getBoundingClientRect();
      if (e.clientX + 12 + tooltipWidth > colRect.right) {
        x = e.clientX - tooltipWidth - 12;
      }
    }
    return { x, y };
  };

  const handleHover = useCallback((e, rect) => {
    const pct = totalChanges > 0 ? ((rect.size / totalChanges) * 100).toFixed(1) : '0';
    const { x, y } = calculateTooltipPosition(e);
    
    setTooltip({
      x,
      y,
      name: rect.name,
      changes: rect.size,
      pct,
      lastSha: rect.lastSha,
      lastDate: rect.lastDate,
    });
  }, [totalChanges]);

  const handleMouseMove = useCallback((e) => {
    if (tooltip) {
      const { x, y } = calculateTooltipPosition(e);
      setTooltip(prev => prev ? { ...prev, x, y } : null);
    }
  }, [tooltip]);

  const handleLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // File click handler
  const handleFileClick = useCallback((filename) => {
    setSelectedFile(prev => prev === filename ? null : filename);
  }, []);

  // Dynamic subtitle
  const subtitle = useMemo(() => {
    if (!windowDays) return 'Technical debt radar';
    const count = windowedCommits.length;
    return `Last ${windowDays} days · ${count} commit${count !== 1 ? 's' : ''}`;
  }, [windowDays, windowedCommits]);

  // Dynamic footer
  const footerStats = useMemo(() => {
    const d = windowedData;
    if (!d || d.length === 0) return null;
    const filesLabel = windowDays
      ? `${d.length} files changed in last ${windowDays} days`
      : `${d.length} files tracked`;
    const hottestLabel = windowDays
      ? `${d[0]?.name?.split('/').pop()} (${formatNumber(d[0]?.size)} changes in last ${windowDays} days)`
      : `${d[0]?.name?.split('/').pop()} — ${formatNumber(d[0]?.size)} changes`;
    return { filesLabel, hottestLabel };
  }, [windowedData, windowDays]);

  // ── Empty state ──
  if ((!data || data.length === 0) && !windowDays) {
    return (
      <div className="heatmap-card">
        <div className="heatmap-card__header">
          <svg className="heatmap-card__flame" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
          </svg>
          <div className="heatmap-card__titles">
            <div className="heatmap-card__title">Code hotspots</div>
            <div className="heatmap-card__subtitle">Technical debt radar</div>
          </div>
        </div>
        <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          No hotspot data available
        </div>
      </div>
    );
  }

  // ── Treemap with data ──
  return (
    <div className="heatmap-card">
      {/* Header */}
      <div className="heatmap-card__header">
        <svg className="heatmap-card__flame" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
        </svg>
        <div className="heatmap-card__titles">
          <div className="heatmap-card__title">Code hotspots</div>
          <div className="heatmap-card__subtitle">{subtitle}</div>
        </div>
        <span className="heatmap-card__badge">
          Top {(windowedData || data || []).length} files by change volume
        </span>
      </div>

      {/* Time Window Selector */}
      <div className="time-window">
        <span className="time-window__label">Showing:</span>
        {TIME_WINDOWS.map((w, i) => (
          <button
            key={w.label}
            className={`time-window__pill${i === activeWindow ? ' time-window__pill--active' : ''}`}
            onClick={() => setActiveWindow(i)}
          >
            {w.label}
          </button>
        ))}
      </div>

      {/* Velocity Indicator */}
      {velocity && (
        <div className={`velocity-indicator velocity-indicator--${velocity.direction}`}>
          <span className="velocity-indicator__arrow">
            {velocity.direction === 'up' ? '▲' : velocity.direction === 'down' ? '▼' : '→'}
          </span>
          <span>{velocity.label}</span>
        </div>
      )}

      {/* Empty state for narrow windows */}
      {windowedData && windowedData.length === 0 && windowDays ? (
        <div className="heatmap-card__empty-window">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
          <div>No commits in this period</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Try a broader window ↑</div>
        </div>
      ) : (
        <>
          {/* Treemap */}
          <div
            ref={measuredRef}
            className={`treemap${selectedFile ? ' treemap--dimmed' : ''}`}
            style={{ position: 'relative', height: '260px', flexWrap: 'initial', gap: 0 }}
            onMouseMove={handleMouseMove}
          >
            {rects.map((rect) => (
              <TreemapTile
                key={rect.name}
                rect={rect}
                maxSize={maxSize}
                totalChanges={totalChanges}
                onHover={handleHover}
                onLeave={handleLeave}
                onClick={handleFileClick}
                dimmed={selectedFile && selectedFile !== rect.name}
              />
            ))}
          </div>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="treemap-tooltip"
              style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
            >
              <div className="treemap-tooltip__filename">{tooltip.name}</div>
              <div className="treemap-tooltip__row">
                <span>Total changes</span>
                <span className="treemap-tooltip__value">{formatNumber(tooltip.changes)}</span>
              </div>
              <div className="treemap-tooltip__row">
                <span>% of all changes</span>
                <span className="treemap-tooltip__value">{tooltip.pct}%</span>
              </div>
              {tooltip.lastSha && (
                <div className="treemap-tooltip__row">
                  <span>Last modified</span>
                  <span className="treemap-tooltip__value" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                    {tooltip.lastSha.slice(0, 7)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="heatmap-legend">
            <div className="heatmap-legend__bar" />
            <div className="heatmap-legend__labels">
              <span>Fewer changes</span>
              <span>More changes</span>
            </div>
          </div>

          {/* Footer */}
          {footerStats && (
            <div className="heatmap-footer">
              <span>📁 {footerStats.filesLabel}</span>
              <div className="heatmap-footer__divider" />
              <span>
                🔥 Hottest:{' '}
                <span className="heatmap-footer__hottest">
                  {footerStats.hottestLabel}
                </span>
              </span>
            </div>
          )}
        </>
      )}

      {/* File Detail Panel — drill-down */}
      {selectedFile && repoInfo && (
        <FileDetailPanel
          filename={selectedFile}
          repoInfo={repoInfo}
          commits={commits}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}
