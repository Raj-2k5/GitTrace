/* ============================================================
 * GitTrace — AIStoryCard Component
 * ------------------------------------------------------------
 * A visually distinct card that renders at the top of the
 * timeline, displaying an AI-generated "Progress Story" summary.
 *
 * FEATURES:
 *  • Gradient border + subtle glow to differentiate from normal
 *    CommitNode cards.
 *  • Sparkles icon from Lucide to denote AI generation.
 *  • Displays title, summary, and a vibe badge.
 *  • Skeleton loader state for when Gemini is still processing.
 *  • Framer Motion entrance animation (scale + fade).
 *
 * PROPS:
 *  story      — { title, summary, vibe } from Gemini, or null.
 *  isLoading  — Whether the AI call is in progress.
 *  error      — Optional error string from the AI service.
 * ============================================================ */

import { motion } from 'framer-motion';
import { Sparkles, Brain, AlertCircle } from 'lucide-react';

// ------------------------------------------------------------
// 1. Animation Variant
// ------------------------------------------------------------

const cardVariant = {
  hidden: { opacity: 0, scale: 0.95, y: -10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 16,
      delay: 0.05,
    },
  },
};

// ------------------------------------------------------------
// 2. Vibe → Color mapping
// ------------------------------------------------------------

const VIBE_COLORS = {
  'Feature Shipping': { bg: 'bg-emerald-900/40', text: 'text-emerald-300', border: 'border-emerald-700/50' },
  'Bug Squashing':    { bg: 'bg-red-900/40',     text: 'text-red-300',     border: 'border-red-700/50' },
  'Refactoring':      { bg: 'bg-blue-900/40',    text: 'text-blue-300',    border: 'border-blue-700/50' },
  'Performance':      { bg: 'bg-yellow-900/40',  text: 'text-yellow-300',  border: 'border-yellow-700/50' },
  'Testing':          { bg: 'bg-violet-900/40',   text: 'text-violet-300',  border: 'border-violet-700/50' },
  'Documentation':    { bg: 'bg-cyan-900/40',    text: 'text-cyan-300',    border: 'border-cyan-700/50' },
  'Maintenance':      { bg: 'bg-orange-900/40',  text: 'text-orange-300',  border: 'border-orange-700/50' },
  'Infrastructure':   { bg: 'bg-pink-900/40',    text: 'text-pink-300',    border: 'border-pink-700/50' },
  'UI Polish':        { bg: 'bg-fuchsia-900/40', text: 'text-fuchsia-300', border: 'border-fuchsia-700/50' },
  'Security':         { bg: 'bg-amber-900/40',   text: 'text-amber-300',   border: 'border-amber-700/50' },
};

const getVibeStyle = (vibe) =>
  VIBE_COLORS[vibe] ?? { bg: 'bg-gray-800/40', text: 'text-gray-300', border: 'border-gray-700/50' };

// ------------------------------------------------------------
// 3. Skeleton Loader
// ------------------------------------------------------------

function AISkeletonLoader() {
  return (
    <div className="relative flex items-start gap-4">
      {/* Dot placeholder */}
      <div className="relative z-10 flex-shrink-0 mt-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-purple-500/30 bg-gray-900">
          <Sparkles className="h-4 w-4 text-purple-400 animate-pulse" />
        </div>
      </div>

      {/* Card skeleton */}
      <div className="flex-1 rounded-xl border border-purple-800/30 bg-gradient-to-br from-purple-950/30 via-gray-900/60 to-indigo-950/30 p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-4 rounded bg-purple-800/40 animate-pulse" />
          <div className="h-3 w-32 rounded bg-purple-800/30 animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-5 w-3/4 rounded bg-gray-800/60 animate-pulse" />
          <div className="h-4 w-full rounded bg-gray-800/40 animate-pulse" />
          <div className="h-4 w-5/6 rounded bg-gray-800/40 animate-pulse" />
        </div>
        <div className="mt-3 h-5 w-24 rounded-full bg-gray-800/40 animate-pulse" />
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// 4. Component
// ------------------------------------------------------------

export default function AIStoryCard({ story, isLoading, error }) {
  // ── Loading: show skeleton ──
  if (isLoading) return <AISkeletonLoader />;

  // ── Error: show subtle warning (non-blocking) ──
  if (error) {
    return (
      <div className="relative flex items-start gap-4 mb-4">
        <div className="relative z-10 flex-shrink-0 mt-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-gray-700 bg-gray-900">
            <AlertCircle className="h-4 w-4 text-gray-500" />
          </div>
        </div>
        <div className="flex-1 rounded-xl border border-gray-800 bg-gray-900/40 p-4 text-xs text-gray-500">
          <span className="font-medium text-gray-400">AI Story unavailable:</span>{' '}
          {error}
        </div>
      </div>
    );
  }

  // ── No story yet: render nothing ──
  if (!story) return null;

  const vibeStyle = getVibeStyle(story.vibe);

  return (
    <motion.div
      variants={cardVariant}
      initial="hidden"
      animate="visible"
      className="relative flex items-start gap-4 mb-4"
    >
      {/* ── AI dot (purple, distinct from commit green) ── */}
      <div className="relative z-10 flex-shrink-0 mt-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-purple-500/50 bg-gray-900 shadow-[0_0_16px_rgba(168,85,247,0.2)]">
          <Sparkles className="h-4 w-4 text-purple-400" />
        </div>
      </div>

      {/* ── Card with gradient border glow ── */}
      <div className="flex-1 rounded-xl border border-purple-800/40 bg-gradient-to-br from-purple-950/20 via-gray-900/70 to-indigo-950/20 p-5 shadow-[0_0_30px_rgba(168,85,247,0.08)] hover:shadow-[0_0_40px_rgba(168,85,247,0.14)] transition-shadow duration-300">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-purple-400">
            AI Progress Story
          </span>
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-gray-100 mb-1">
          {story.title}
        </h3>

        {/* Summary */}
        <p className="text-sm leading-relaxed text-gray-400">
          {story.summary}
        </p>

        {/* Vibe badge */}
        <div className="mt-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${vibeStyle.bg} ${vibeStyle.text} ${vibeStyle.border}`}
          >
            {story.vibe}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
