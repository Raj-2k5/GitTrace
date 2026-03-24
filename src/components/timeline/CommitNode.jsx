/* ============================================================
 * GitTrace — CommitNode Component
 * ------------------------------------------------------------
 * Renders a single commit card on the vertical timeline.
 *
 * FEATURES:
 *  • Author avatar with fallback (User icon from Lucide).
 *  • Commit message truncated to 2 lines with CSS line-clamp.
 *  • Abbreviated SHA (first 7 chars) + human-readable date.
 *  • File-change summary: additions (green) / deletions (red).
 *  • Framer Motion slide-in animation with spring physics,
 *    triggered by viewport intersection (whileInView).
 *
 * PROPS:
 *  commit — A commit object from the GitHub API (or mock data).
 *  index  — Position in the list (used for alternating sides
 *           on wider screens, not used right now but future-ready).
 * ============================================================ */

import { motion } from 'framer-motion';
import { GitCommit, User, FileDiff, Plus, Minus } from 'lucide-react';

// ------------------------------------------------------------
// 1. Animation Variant (child — driven by Timeline container)
// ------------------------------------------------------------

/** Slide in from left with spring physics. */
const nodeVariant = {
  hidden: { x: -30, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 14,
    },
  },
};

// ------------------------------------------------------------
// 2. Helpers
// ------------------------------------------------------------

/**
 * Format an ISO date string into a short, human-readable form.
 * e.g. "2026-03-25T18:30:00Z" → "Mar 25, 2026"
 */
const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

/**
 * Aggregate file-level stats into a single summary.
 * @returns {{ totalFiles: number, totalAdditions: number, totalDeletions: number }}
 */
const aggregateFileStats = (files = []) =>
  files.reduce(
    (acc, f) => ({
      totalFiles: acc.totalFiles + 1,
      totalAdditions: acc.totalAdditions + (f.additions ?? 0),
      totalDeletions: acc.totalDeletions + (f.deletions ?? 0),
    }),
    { totalFiles: 0, totalAdditions: 0, totalDeletions: 0 },
  );

// ------------------------------------------------------------
// 3. Component
// ------------------------------------------------------------

export default function CommitNode({ commit }) {
  const stats = aggregateFileStats(commit.files);

  return (
    <motion.div
      variants={nodeVariant}
      whileInView="visible"
      initial="hidden"
      viewport={{ once: true, margin: '-50px' }}
      className="relative flex items-start gap-4 group"
    >
      {/* ── Timeline dot ── */}
      <div className="relative z-10 flex-shrink-0 mt-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-500/40 bg-gray-900 shadow-[0_0_12px_rgba(16,185,129,0.15)] group-hover:border-emerald-400 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all duration-300">
          <GitCommit className="h-4 w-4 text-emerald-400" />
        </div>
      </div>

      {/* ── Card ── */}
      <div className="flex-1 rounded-xl border border-gray-800 bg-gray-900/60 backdrop-blur-sm p-4 hover:border-emerald-800/60 hover:bg-gray-900/80 transition-all duration-300 mb-2">
        {/* Header row: avatar + author + date */}
        <div className="flex items-center gap-3 mb-2">
          {commit.author?.avatar_url ? (
            <img
              src={commit.author.avatar_url}
              alt={commit.author.name}
              className="h-7 w-7 rounded-full ring-2 ring-gray-700"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-800 ring-2 ring-gray-700">
              <User className="h-4 w-4 text-gray-500" />
            </div>
          )}
          <span className="text-sm font-medium text-gray-300">
            {commit.author?.name ?? 'Unknown'}
          </span>
          <span className="ml-auto text-xs text-gray-500">
            {formatDate(commit.author?.date)}
          </span>
        </div>

        {/* Commit message — 2-line clamp */}
        <a
          href={commit.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm font-medium text-gray-100 line-clamp-2 hover:text-emerald-400 transition-colors"
        >
          {commit.message}
        </a>

        {/* Footer: SHA + file stats */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
          {/* SHA */}
          <code className="rounded bg-gray-800 px-2 py-0.5 font-mono text-gray-400">
            {commit.sha?.slice(0, 7)}
          </code>

          {/* File stats (only if files exist) */}
          {stats.totalFiles > 0 && (
            <>
              <span className="flex items-center gap-1">
                <FileDiff className="h-3.5 w-3.5" />
                {stats.totalFiles} file{stats.totalFiles !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-0.5 text-emerald-400">
                <Plus className="h-3 w-3" />
                {stats.totalAdditions}
              </span>
              <span className="flex items-center gap-0.5 text-red-400">
                <Minus className="h-3 w-3" />
                {stats.totalDeletions}
              </span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
