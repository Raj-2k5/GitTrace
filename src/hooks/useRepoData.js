/* ============================================================
 * GitTrace — useRepoData Custom Hook
 * ------------------------------------------------------------
 * Central state-management hook for fetching and storing GitHub
 * repository commit data AND AI-generated progress stories.
 *
 * STATE:
 *   isLoading   — true while commits are being fetched.
 *   data        — array of commit objects (or null).
 *   error       — error string (or null).
 *   aiStory     — { title, summary, vibe } from Gemini (or null).
 *   isAILoading — true while Gemini is generating a story.
 *   aiError     — error string from Gemini (or null).
 *
 * EXPOSED ACTION:
 *   loadRepo(url) — accepts a GitHub URL (or owner/repo string),
 *                    parses it, fetches commits, then triggers
 *                    AI story generation in parallel.
 *
 * DATA SOURCE TOGGLE:
 *   • VITE_USE_LIVE_API=true  → calls the real GitHub API.
 *   • VITE_USE_LIVE_API=false → returns local mock data.
 * ============================================================ */

import { useState, useCallback } from 'react';
import { fetchRepoCommits } from '../api/github';
import { generateCommitSummary } from '../api/gemini';
import MOCK_COMMITS from '../utils/mockData';

// ------------------------------------------------------------
// 1. URL Parsing Utility
// ------------------------------------------------------------

/**
 * Extract `owner` and `repo` from a wide variety of GitHub input
 * formats.  The regex handles:
 *
 *   • Full URLs:     https://github.com/facebook/react
 *   • Trailing slash: https://github.com/facebook/react/
 *   • Deep links:    https://github.com/facebook/react/tree/main/packages
 *   • SSH URLs:      git@github.com:facebook/react.git
 *   • Short strings: facebook/react
 *
 * @param {string} input - Raw user input (URL or owner/repo).
 * @returns {{ owner: string, repo: string } | null}
 *          Parsed result, or null if the input is unrecognisable.
 */
export function parseGitHubInput(input) {
  if (!input || typeof input !== 'string') return null;

  // Trim whitespace and remove a trailing `.git` if present
  const cleaned = input.trim().replace(/\.git$/, '');

  // --- Pattern A: Full github.com HTTP(S) URL ---
  const httpPattern =
    /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\/.*)?$/;
  const httpMatch = cleaned.match(httpPattern);
  if (httpMatch) {
    return { owner: httpMatch[1], repo: httpMatch[2] };
  }

  // --- Pattern B: SSH URL (git@github.com:owner/repo) ---
  const sshPattern =
    /^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)$/;
  const sshMatch = cleaned.match(sshPattern);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  // --- Pattern C: Simple "owner/repo" string ---
  const simplePattern = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;
  const simpleMatch = cleaned.match(simplePattern);
  if (simpleMatch) {
    return { owner: simpleMatch[1], repo: simpleMatch[2] };
  }

  // Nothing matched
  return null;
}

// ------------------------------------------------------------
// 2. Live-API Toggle
// ------------------------------------------------------------

/** Whether to hit the real GitHub API or use mock data. */
const USE_LIVE_API = import.meta.env.VITE_USE_LIVE_API === 'true';

// ------------------------------------------------------------
// 3. Hook Definition
// ------------------------------------------------------------

/**
 * Custom React hook that manages repo-commit state and triggers
 * AI story generation after commits are loaded.
 */
export default function useRepoData() {
  // Commit data state
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // AI story state
  const [aiStory, setAiStory] = useState(null);
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  /**
   * Fire-and-forget AI story generation.
   * This runs independently from the commit fetch so the timeline
   * can render immediately while the AI card shows a skeleton.
   *
   * @param {Array} commits - The commit array to summarise.
   */
  const triggerAISummary = useCallback(async (commits) => {
    setIsAILoading(true);
    setAiStory(null);
    setAiError(null);

    try {
      // Send the latest batch (first 10 commits) to Gemini
      const batch = commits.slice(0, 10);
      const result = await generateCommitSummary(batch);

      if (result?.error) {
        setAiError(result.message);
      } else {
        setAiStory(result);
      }
    } catch (err) {
      setAiError(err.message || 'Failed to generate AI summary.');
    } finally {
      setIsAILoading(false);
    }
  }, []);

  /**
   * Parse a GitHub URL, fetch (or mock) commits, then kick off
   * AI story generation.
   *
   * @param {string} url - Any supported GitHub input format.
   */
  const loadRepo = useCallback(async (url) => {
    // Reset all state
    setIsLoading(true);
    setData(null);
    setError(null);
    setAiStory(null);
    setAiError(null);

    // --- Step 1: Parse input ---
    const parsed = parseGitHubInput(url);
    if (!parsed) {
      setError(
        'Invalid GitHub URL or owner/repo format. ' +
        'Try something like "https://github.com/facebook/react" or "facebook/react".',
      );
      setIsLoading(false);
      return;
    }

    const { owner, repo } = parsed;

    // --- Step 2: Fetch commits ---
    let commits = null;

    if (!USE_LIVE_API) {
      // Simulate a small network delay for realistic UX
      await new Promise((r) => setTimeout(r, 400));
      console.info(
        `[GitTrace] Mock mode — returning ${MOCK_COMMITS.length} mock commits ` +
        `(requested: ${owner}/${repo})`,
      );
      commits = MOCK_COMMITS;
    } else {
      try {
        const result = await fetchRepoCommits(owner, repo);
        if (result?.error) {
          setError(result.message);
          setIsLoading(false);
          return;
        }
        commits = result;
      } catch (err) {
        setError(err.message || 'An unexpected error occurred.');
        setIsLoading(false);
        return;
      }
    }

    // --- Step 3: Update commit state ---
    setData(commits);
    setIsLoading(false);

    // --- Step 4: Trigger AI story in background ---
    // This runs independently — the timeline renders immediately
    // while the AI card shows a skeleton loader.
    triggerAISummary(commits);
  }, [triggerAISummary]);

  return {
    isLoading,
    data,
    error,
    aiStory,
    isAILoading,
    aiError,
    loadRepo,
  };
}
