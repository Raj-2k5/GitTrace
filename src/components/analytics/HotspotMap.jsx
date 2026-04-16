/* ============================================================
 * GitTrace — HotspotMap Component
 * ------------------------------------------------------------
 * A Recharts Treemap visualization showing the most frequently
 * modified files across the commit history — a "Code Hotspot"
 * or "Technical Debt Radar".
 *
 * FEATURES:
 *  • Dynamic heat-scale coloring: hot files → rose/orange,
 *    cold files → teal/slate.
 *  • Custom tooltip with filename, total changes, and commit count.
 *  • Custom treemap cells with truncated filenames + change count.
 *  • Responsive via ResponsiveContainer with strict parent height.
 *  • Graceful empty state when no file data is available.
 *  • Framer Motion entrance animation.
 *
 * PROPS:
 *  data — Flat array from processHotspotData():
 *         [{ name, size, commits }, ...]
 * ============================================================ */

import { useMemo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import { Flame, FileCode2, FolderOpen } from 'lucide-react';

// ------------------------------------------------------------
// 1. Color Scale
// ------------------------------------------------------------

function lerpColor(color1, color2, t) {
  const c1 = parseInt(color1.slice(1), 16);
  const c2 = parseInt(color2.slice(1), 16);

  const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

const COLD_COLOR = '#134e4a';
const MID_COLOR  = '#c2410c';
const HOT_COLOR  = '#e11d48';

function heatColor(t) {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped <= 0.5) return lerpColor(COLD_COLOR, MID_COLOR, clamped * 2);
  return lerpColor(MID_COLOR, HOT_COLOR, (clamped - 0.5) * 2);
}

// ------------------------------------------------------------
// 2. Custom Treemap Cell
// ------------------------------------------------------------

/**
 * Custom <content> renderer for each treemap cell.
 *
 * NOTE: Recharts renders this as a render-element, NOT a standard
 * React component — React hooks MUST NOT be used here.
 */
function CustomCell(props) {
  const { x, y, width, height, name, size, maxSize } = props;

  // Safety: coerce every numeric prop through Number.isFinite
  const px = Number.isFinite(x)      ? x      : 0;
  const py = Number.isFinite(y)      ? y      : 0;
  const w  = Number.isFinite(width)  ? width  : 0;
  const h  = Number.isFinite(height) ? height : 0;
  const s  = Number.isFinite(size)   ? size   : 0;

  if (w <= 0 || h <= 0) return null;

  const showLabel = w > 50 && h > 30;
  const showSize  = w > 60 && h > 44;

  const t = maxSize > 0 ? s / maxSize : 0;
  const fill = heatColor(t);

  // Truncate filenames (plain computation — no hooks)
  let displayName = '';
  if (name) {
    if (w < 90) {
      const parts = name.split('/');
      displayName = parts[parts.length - 1];
    } else {
      const maxChars = Math.floor(w / 7);
      displayName = name.length > maxChars ? '…' + name.slice(-(maxChars - 1)) : name;
    }
  }

  return (
    <g>
      <rect
        x={px}
        y={py}
        width={w}
        height={h}
        rx={4}
        ry={4}
        fill={fill}
        stroke="#111827"
        strokeWidth={2}
        style={{
          transition: 'fill 0.3s ease, opacity 0.2s ease',
          cursor: 'pointer',
        }}
        opacity={0.9}
        onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; }}
        onMouseOut={(e) => { e.currentTarget.style.opacity = '0.9'; }}
      />
      {showLabel && (
        <text
          x={px + w / 2}
          y={py + h / 2 - (showSize ? 6 : 0)}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#f9fafb"
          fontSize={w < 100 ? 10 : 11}
          fontFamily="'Inter', system-ui, sans-serif"
          fontWeight={500}
          style={{ pointerEvents: 'none' }}
        >
          {displayName}
        </text>
      )}
      {showSize && (
        <text
          x={px + w / 2}
          y={py + h / 2 + 12}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#d1d5db"
          fontSize={9}
          fontFamily="'Inter', system-ui, sans-serif"
          fontWeight={400}
          style={{ pointerEvents: 'none', opacity: 0.75 }}
        >
          {s.toLocaleString()} changes
        </text>
      )}
    </g>
  );
}

// ------------------------------------------------------------
// 3. Custom Tooltip
// ------------------------------------------------------------

function HotspotTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/95 backdrop-blur-lg px-4 py-3 shadow-2xl max-w-xs">
      <div className="flex items-center gap-2 mb-1.5">
        <FileCode2 className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-gray-100 break-all leading-tight">
          {item.name}
        </span>
      </div>
      <div className="flex items-center gap-4 text-[11px] text-gray-400">
        <span>
          <span className="font-semibold text-orange-300">{item.size?.toLocaleString()}</span> total changes
        </span>
        <span>
          <span className="font-semibold text-emerald-300">{item.commits}</span> commit{item.commits !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// 4. Container Animation
// ------------------------------------------------------------

const cardVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 80, damping: 16, delay: 0.2 },
  },
};

// ------------------------------------------------------------
// 5. Main Component
// ------------------------------------------------------------

export default function HotspotMap({ data }) {
  // Find the max size for color normalization
  const maxSize = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return data[0].size; // already sorted descending
  }, [data]);

  // Inject maxSize into each data item so CustomCell can access it
  const enrichedData = useMemo(() => {
    if (!data) return [];
    return data.map((d) => ({ ...d, maxSize }));
  }, [data, maxSize]);

  // ── Guard: empty / no data ──
  if (!data || data.length === 0) {
    return (
      <motion.div
        variants={cardVariant}
        initial="hidden"
        animate="visible"
        className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600/15 border border-orange-800/30">
            <Flame className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Code Hotspots</h2>
            <p className="text-[11px] text-gray-500">Technical Debt Radar</p>
          </div>
        </div>
        <div className="flex h-80 flex-col items-center justify-center text-gray-500">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-800 bg-gray-900/60 mb-3">
            <FolderOpen className="h-6 w-6 text-gray-600" />
          </div>
          <p className="text-sm font-medium text-gray-400">No hotspot data available</p>
          <p className="text-xs text-gray-600 mt-1 text-center max-w-[280px]">
            File-level change details are not available for these commits.
            This typically happens with the list-commits endpoint.
          </p>
        </div>
      </motion.div>
    );
  }

  // ── Treemap with data ──
  return (
    <motion.div
      variants={cardVariant}
      initial="hidden"
      animate="visible"
      className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6"
    >
      {/* Card Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600/15 border border-orange-800/30">
          <Flame className="h-4 w-4 text-orange-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-200">Code Hotspots</h2>
          <p className="text-[11px] text-gray-500">Technical Debt Radar</p>
        </div>
        <div className="flex-1" />
        <span className="text-[10px] text-gray-600 font-medium">
          Top {data.length} files by change volume
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mb-4 mt-3 ml-12">
        <span className="text-[10px] text-gray-500">Cool</span>
        <div className="h-2 w-24 rounded-full" style={{
          background: `linear-gradient(to right, ${COLD_COLOR}, ${MID_COLOR}, ${HOT_COLOR})`,
        }} />
        <span className="text-[10px] text-gray-500">Hot</span>
      </div>

      {/* Treemap — strict h-80 on parent prevents ResponsiveContainer collapse → NaN */}
      <div className="w-full h-80 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={enrichedData}
            dataKey="size"
            nameKey="name"
            stroke="#111827"
            animationDuration={600}
            animationEasing="ease-out"
            content={<CustomCell />}
            isAnimationActive={false}
          >
            <Tooltip
              content={<HotspotTooltip />}
              cursor={false}
              wrapperStyle={{ outline: 'none' }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>

      {/* Footer stats */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-800/60">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <FileCode2 className="h-3 w-3" />
          <span><span className="font-semibold text-gray-400">{data.length}</span> files tracked</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <Flame className="h-3 w-3 text-orange-500/60" />
          <span>
            Hottest: <span className="font-semibold text-orange-300">{data[0]?.name?.split('/').pop()}</span>
            <span className="text-gray-600"> ({data[0]?.size?.toLocaleString()} changes)</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}
