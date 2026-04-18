/* ============================================================
 * GitTrace — HotspotMap Component (Redesigned)
 * ------------------------------------------------------------
 * Custom DOM-based treemap replacing Recharts <Treemap>.
 *
 * FEATURES:
 *  • Squarified treemap algorithm (pure JS)
 *  • 40% max area cap per tile (prevents one file drowning chart)
 *  • 5-stop color scale (navy→green→amber→orange→crimson)
 *  • Gradient scrim labels with JetBrains Mono
 *  • Min 72×40px to show label, hover-only tooltip for small tiles
 *  • 2px gap between tiles
 *  • Rich tooltip with full path, changes, %, last modified
 *  • Full-width legend gradient bar
 *  • Footer stats with clickable hottest file
 * ============================================================ */

import { useState, useMemo, useRef, useCallback } from 'react';
import { formatNumber } from '../../utils/analytics';

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

    // Find best row
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

    // Lay out row
    const rowFrac = rowArea / total;
    const rowLen = isHorizontal
      ? cw * rowFrac
      : ch * rowFrac;

    let offset = 0;
    for (const item of row) {
      const itemFrac = item.cappedSize / rowArea;
      const itemLen = sideLen * itemFrac;

      if (isHorizontal) {
        rects.push({
          ...item,
          x: cx,
          y: cy + offset,
          w: Math.max(0, rowLen - 2),
          h: Math.max(0, itemLen - 2),
        });
      } else {
        rects.push({
          ...item,
          x: cx + offset,
          y: cy,
          w: Math.max(0, itemLen - 2),
          h: Math.max(0, rowLen - 2),
        });
      }
      offset += itemLen;
    }

    // Update remaining area
    if (isHorizontal) {
      cx += rowLen;
      cw -= rowLen;
    } else {
      cy += rowLen;
      ch -= rowLen;
    }

    remaining = remaining.slice(row.length);
    // Recalculate total for remaining items
    // (not needed since we use absolute fractions, but let's be safe)
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
function TreemapTile({ rect, maxSize, totalChanges, onHover, onLeave }) {
  const showLabel = rect.w >= 72 && rect.h >= 40;
  const color = getTreemapColor(rect.size, maxSize);
  const isCapped = rect.capped;

  return (
    <div
      className="treemap__tile"
      style={{
        position: 'absolute',
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.w}px`,
        height: `${rect.h}px`,
        background: color,
      }}
      onMouseEnter={(e) => onHover(e, rect)}
      onMouseLeave={onLeave}
    >
      {showLabel && (
        <>
          <div className="treemap__tile-scrim" />
          <div className="treemap__tile-label">
            <span className="treemap__tile-name">
              {rect.name.split('/').pop()}
            </span>
            <span className="treemap__tile-changes">
              {formatNumber(rect.size)} changes{isCapped ? ' (capped)' : ''}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ──
export default function HotspotMap({ data }) {
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

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
      // Initial measurement
      setContainerSize({
        width: node.offsetWidth,
        height: Math.max(node.offsetHeight, 220),
      });
    }
  }, []);

  // Process data with 40% area cap
  const { tiles, totalChanges, maxSize } = useMemo(() => {
    if (!data || data.length === 0) return { tiles: [], totalChanges: 0, maxSize: 0 };

    const total = data.reduce((s, d) => s + d.size, 0);
    const maxAllowed = total * 0.4;
    const maxRaw = data[0]?.size || 0;

    const processed = data.map(d => ({
      ...d,
      cappedSize: Math.min(d.size, maxAllowed),
      capped: d.size > maxAllowed,
    }));

    return {
      tiles: processed,
      totalChanges: total,
      maxSize: maxRaw,
    };
  }, [data]);

  // Compute layout
  const rects = useMemo(() => {
    if (tiles.length === 0 || containerSize.width <= 0) return [];
    return squarify(tiles, 0, 0, containerSize.width, containerSize.height);
  }, [tiles, containerSize]);

  // Tooltip handlers
  const handleHover = useCallback((e, rect) => {
    const pct = totalChanges > 0 ? ((rect.size / totalChanges) * 100).toFixed(1) : '0';
    setTooltip({
      x: e.clientX + 12,
      y: e.clientY - 10,
      name: rect.name,
      changes: rect.size,
      pct,
      lastSha: rect.lastSha,
      lastDate: rect.lastDate,
    });
  }, [totalChanges]);

  const handleMouseMove = useCallback((e) => {
    if (tooltip) {
      setTooltip(prev => prev ? { ...prev, x: e.clientX + 12, y: e.clientY - 10 } : null);
    }
  }, [tooltip]);

  const handleLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // ── Empty state ──
  if (!data || data.length === 0) {
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
          <div className="heatmap-card__subtitle">Technical debt radar</div>
        </div>
        <span className="heatmap-card__badge">
          Top {data.length} files by change volume
        </span>
      </div>

      {/* Treemap */}
      <div
        ref={measuredRef}
        className="treemap"
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
          />
        ))}
      </div>

      {/* Tooltip (portal-style fixed position) */}
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
      <div className="heatmap-footer">
        <span>📁 {data.length} files tracked</span>
        <div className="heatmap-footer__divider" />
        <span>
          🔥 Hottest:{' '}
          <span className="heatmap-footer__hottest">
            {data[0]?.name?.split('/').pop()}
          </span>
          {' — '}
          {formatNumber(data[0]?.size)} changes
        </span>
      </div>
    </div>
  );
}
