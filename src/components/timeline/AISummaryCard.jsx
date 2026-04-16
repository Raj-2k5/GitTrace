/* ============================================================
 * GitTrace — AISummaryCard Component
 * ------------------------------------------------------------
 * A premium card rendered above the CommitTimeline that allows
 * users to generate an AI-powered sprint summary on demand.
 *
 * FEATURES:
 *  • "Generate AI Story" button triggers Gemini summarization.
 *  • Beautiful gradient border + glow effect distinguishing it
 *    from standard commit cards.
 *  • Skeleton loader while Gemini is processing.
 *  • Vibe-colored badge based on the AI classification.
 *  • Framer Motion entrance animations.
 *
 * PROPS:
 *  story             — { title, summary, vibe } from Gemini, or null.
 *  isLoading         — Whether the AI call is in progress.
 *  error             — Optional error string from the AI service.
 *  onGenerateStory   — Callback to trigger AI story generation.
 *  hasCommits        — Whether commits are available to summarize.
 * ============================================================ */

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Brain, AlertCircle, Wand2, Loader2 } from 'lucide-react';

// ------------------------------------------------------------
// 1. Animation Variants
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
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -10,
    transition: { duration: 0.2 },
  },
};

const buttonVariant = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 100, damping: 14, delay: 0.15 },
  },
};

// ------------------------------------------------------------
// 2. Vibe → Color mapping
// ------------------------------------------------------------

const VIBE_COLORS = {
  'Feature Shipping': { bg: 'bg-emerald-900/40', text: 'text-emerald-300', border: 'border-emerald-700/50', glow: 'rgba(16,185,129,0.12)' },
  'Bug Squashing':    { bg: 'bg-red-900/40',     text: 'text-red-300',     border: 'border-red-700/50',     glow: 'rgba(239,68,68,0.12)' },
  'Refactoring':      { bg: 'bg-blue-900/40',    text: 'text-blue-300',    border: 'border-blue-700/50',    glow: 'rgba(59,130,246,0.12)' },
  'Performance':      { bg: 'bg-yellow-900/40',  text: 'text-yellow-300',  border: 'border-yellow-700/50',  glow: 'rgba(234,179,8,0.12)' },
  'Testing':          { bg: 'bg-violet-900/40',   text: 'text-violet-300',  border: 'border-violet-700/50',  glow: 'rgba(139,92,246,0.12)' },
  'Documentation':    { bg: 'bg-cyan-900/40',    text: 'text-cyan-300',    border: 'border-cyan-700/50',    glow: 'rgba(6,182,212,0.12)' },
  'Maintenance':      { bg: 'bg-orange-900/40',  text: 'text-orange-300',  border: 'border-orange-700/50',  glow: 'rgba(249,115,22,0.12)' },
  'Infrastructure':   { bg: 'bg-pink-900/40',    text: 'text-pink-300',    border: 'border-pink-700/50',    glow: 'rgba(236,72,153,0.12)' },
  'UI Polish':        { bg: 'bg-fuchsia-900/40', text: 'text-fuchsia-300', border: 'border-fuchsia-700/50', glow: 'rgba(192,38,211,0.12)' },
  'Security':         { bg: 'bg-amber-900/40',   text: 'text-amber-300',   border: 'border-amber-700/50',   glow: 'rgba(245,158,11,0.12)' },
};

const getVibeStyle = (vibe) =>
  VIBE_COLORS[vibe] ?? { bg: 'bg-gray-800/40', text: 'text-gray-300', border: 'border-gray-700/50', glow: 'rgba(168,85,247,0.08)' };

// ------------------------------------------------------------
// 3. Skeleton Loader
// ------------------------------------------------------------

function AISkeletonLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative mb-6"
    >
      <div className="rounded-2xl border border-purple-800/30 bg-gradient-to-br from-purple-950/30 via-gray-900/60 to-indigo-950/30 p-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-800/30 animate-pulse">
            <Sparkles className="h-4 w-4 text-purple-500/50" />
          </div>
          <div className="h-3 w-36 rounded bg-purple-800/30 animate-pulse" />
        </div>

        {/* Title skeleton */}
        <div className="h-6 w-3/5 rounded bg-gray-800/60 animate-pulse mb-4" />

        {/* Paragraph skeletons */}
        <div className="space-y-2 mb-3">
          <div className="h-4 w-full rounded bg-gray-800/40 animate-pulse" />
          <div className="h-4 w-11/12 rounded bg-gray-800/40 animate-pulse" />
          <div className="h-4 w-4/5 rounded bg-gray-800/40 animate-pulse" />
        </div>
        <div className="space-y-2 mb-4">
          <div className="h-4 w-full rounded bg-gray-800/35 animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-gray-800/35 animate-pulse" />
        </div>

        {/* Badge skeleton */}
        <div className="h-6 w-28 rounded-full bg-gray-800/40 animate-pulse" />

        {/* Generating text */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-800/50">
          <Loader2 className="h-3.5 w-3.5 text-purple-400 animate-spin" />
          <span className="text-xs text-purple-400/80 font-medium">
            Gemini is crafting your sprint story…
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ------------------------------------------------------------
// 4. Generate Button (shown when no story exists yet)
// ------------------------------------------------------------

function GenerateButton({ onClick, disabled }) {
  return (
    <motion.div
      variants={buttonVariant}
      initial="hidden"
      animate="visible"
      className="mb-6"
    >
      <button
        id="generate-ai-story-btn"
        onClick={onClick}
        disabled={disabled}
        className="group relative w-full cursor-pointer rounded-2xl border border-purple-800/30 bg-gradient-to-br from-purple-950/20 via-gray-900/60 to-indigo-950/20 p-5 text-left transition-all duration-300 hover:border-purple-600/50 hover:shadow-[0_0_40px_rgba(168,85,247,0.12)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {/* Shimmer effect on hover */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="relative flex items-center gap-4">
          {/* Icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border border-purple-700/30 group-hover:from-purple-600/30 group-hover:to-indigo-600/30 transition-all duration-300">
            <Wand2 className="h-5 w-5 text-purple-400 group-hover:text-purple-300 transition-colors" />
          </div>

          {/* Text */}
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-200 group-hover:text-gray-100 transition-colors">
              Generate AI Story
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 group-hover:text-gray-400 transition-colors">
              Let Gemini craft a sprint summary from the commit history
            </p>
          </div>

          {/* Arrow */}
          <Sparkles className="h-5 w-5 text-purple-500/50 group-hover:text-purple-400 transition-all duration-300 group-hover:scale-110" />
        </div>
      </button>
    </motion.div>
  );
}

// ------------------------------------------------------------
// 5. Main Component
// ------------------------------------------------------------

export default function AISummaryCard({
  story,
  isLoading,
  error,
  onGenerateStory,
  hasCommits = false,
}) {
  // ── Loading: show skeleton ──
  if (isLoading) return <AISkeletonLoader />;

  // ── Error: show subtle warning (non-blocking) with retry ──
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="rounded-2xl border border-red-900/30 bg-red-950/20 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-900/30 flex-shrink-0 mt-0.5">
              <AlertCircle className="h-4 w-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-300">AI Story unavailable</p>
              <p className="text-xs text-red-400/70 mt-1">{error}</p>
            </div>
            {onGenerateStory && (
              <button
                onClick={onGenerateStory}
                className="flex-shrink-0 rounded-lg border border-red-800/40 bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/40 hover:border-red-700/50 transition-all cursor-pointer"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // ── No story yet: show the Generate button ──
  if (!story) {
    if (!hasCommits) return null;
    return <GenerateButton onClick={onGenerateStory} />;
  }

  // ── Story loaded: render the full card ──
  const vibeStyle = getVibeStyle(story.vibe);

  return (
    <AnimatePresence>
      <motion.div
        variants={cardVariant}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative mb-6"
      >
        <div
          className="rounded-2xl border border-purple-800/40 bg-gradient-to-br from-purple-950/20 via-gray-900/70 to-indigo-950/20 p-6 transition-shadow duration-300"
          style={{ boxShadow: `0 0 40px ${vibeStyle.glow}` }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600/20">
              <Brain className="h-3.5 w-3.5 text-purple-400" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-purple-400">
              AI Progress Story
            </span>
            <div className="flex-1" />
            {/* Regenerate button */}
            {onGenerateStory && (
              <button
                onClick={onGenerateStory}
                className="flex items-center gap-1.5 rounded-lg border border-purple-800/30 bg-purple-900/20 px-2.5 py-1 text-[10px] font-medium text-purple-400 hover:bg-purple-900/40 hover:border-purple-700/40 hover:text-purple-300 transition-all cursor-pointer"
              >
                <Wand2 className="h-3 w-3" />
                Regenerate
              </button>
            )}
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold text-gray-100 mb-3 leading-snug">
            {story.title}
          </h3>

          {/* Summary — rendered as paragraphs */}
          <div className="text-sm leading-relaxed text-gray-400 space-y-3">
            {story.summary.split('\n\n').map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>

          {/* Vibe badge */}
          <div className="mt-4 flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${vibeStyle.bg} ${vibeStyle.text} ${vibeStyle.border}`}
            >
              <Sparkles className="h-3 w-3" />
              {story.vibe}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
