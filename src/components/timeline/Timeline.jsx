/* ============================================================
 * GitTrace — Timeline Component
 * ------------------------------------------------------------
 * Vertical commit timeline that orchestrates staggered entrance
 * animations for its child CommitNode components, with an
 * on-demand AI Summary card at the top.
 *
 * PROPS:
 *  commits           — Array of commit objects (from GitHub API).
 *  isLoading         — Whether commit data is being fetched.
 *  aiStory           — { title, summary, vibe } from Gemini (or null).
 *  isAILoading       — Whether Gemini is generating the story.
 *  aiError           — Error string from Gemini (or null).
 *  onGenerateStory   — Callback to trigger AI story generation.
 * ============================================================ */

import { motion } from 'framer-motion';
import { GitBranch, Loader2 } from 'lucide-react';
import CommitNode from './CommitNode';
import AISummaryCard from './AISummaryCard';

// ------------------------------------------------------------
// 1. Container Animation Variants
// ------------------------------------------------------------

const containerVariant = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

// ------------------------------------------------------------
// 2. Component
// ------------------------------------------------------------

export default function Timeline({
  commits = [],
  isLoading = false,
  aiStory = null,
  isAILoading = false,
  aiError = null,
  onGenerateStory,
}) {
  // ── Loading state (commit fetch) ──
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-4" />
        <p className="text-sm">Fetching commits…</p>
      </div>
    );
  }

  // ── Empty state ──
  if (!commits || commits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-gray-800 bg-gray-900/60 mb-4">
          <GitBranch className="h-7 w-7 text-gray-600" />
        </div>
        <p className="text-sm font-medium text-gray-400">No commits found</p>
        <p className="text-xs text-gray-600 mt-1">
          Search for a repository above to see its history
        </p>
      </div>
    );
  }

  // ── Timeline with AI Summary Card at top ──
  return (
    <motion.div
      variants={containerVariant}
      initial="hidden"
      animate="visible"
      className="relative"
    >
      {/* AI Summary Card — rendered above all commits */}
      <AISummaryCard
        story={aiStory}
        isLoading={isAILoading}
        error={aiError}
        onGenerateStory={onGenerateStory}
        hasCommits={commits.length > 0}
      />

      {/* Vertical tracking line */}
      <div
        aria-hidden="true"
        className="absolute left-[19px] top-0 bottom-0 w-px bg-gradient-to-b from-purple-500/30 via-emerald-500/20 to-transparent"
      />

      {/* Commit nodes */}
      <div className="flex flex-col gap-2">
        {commits.map((commit, index) => (
          <CommitNode key={commit.sha} commit={commit} index={index} />
        ))}
      </div>

      {/* Bottom cap */}
      <div className="flex items-center gap-3 mt-2 ml-[11px]">
        <div className="h-4 w-4 rounded-full border-2 border-gray-700 bg-gray-900" />
        <span className="text-xs text-gray-600">
          End of timeline · {commits.length} commit{commits.length !== 1 ? 's' : ''}
        </span>
      </div>
    </motion.div>
  );
}
