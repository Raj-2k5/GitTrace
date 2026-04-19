/* ============================================================
 * GitTrace — useRepoData Custom Hook
 * ------------------------------------------------------------
 * Central state-management hook for fetching GitHub repository
 * commit data AND AI-generated progress stories.
 *
 * STATE:
 *   isLoading   — true while commits are being fetched.
 *   data        — array of commit objects (or null).
 *   error       — error string (or null).
 *   aiStory     — { title, summary, vibe } from Gemini (or null).
 *   isAILoading — true while Gemini is generating a story.
 *   aiError     — error string from Gemini (or null).
 *   repoInfo    — { owner, repo } parsed from URL (or null).
 *
 * EXPOSED ACTIONS:
 *   loadRepo(url)    — accepts a GitHub URL (or owner/repo string),
 *                       parses it, fetches live commits.
 *   generateStory()  — triggers Gemini AI story generation using
 *                       the currently loaded commits (on demand).
 *
 * NO MOCK DATA — always hits the live GitHub API.
 * ============================================================ */

import { useState, useCallback } from 'react';
import { fetchRepoCommits, fetchRepoInfoObj } from '../api/github';
import { generateCommitSummary } from '../api/gemini';

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
// 2. Hook Definition
// ------------------------------------------------------------

/**
 * Custom React hook that manages repo-commit state and exposes
 * an on-demand AI story generation action.
 */
export default function useRepoData() {
  // Commit data state
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Parsed repo info — { owner, repo }
  const [repoInfo, setRepoInfo] = useState(null);

  // AI story state
  const [aiStory, setAiStory] = useState(null);
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  /**
   * On-demand AI story generation.
   * Triggered when the user clicks "Generate AI Story".
   * Uses the currently loaded commits (the latest 10).
   */
  const generateStory = useCallback(async () => {
    if (!data || data.length === 0) return;

    setIsAILoading(true);
    setAiStory(null);
    setAiError(null);

    try {
      // Send the latest batch (first 10 commits) to Gemini
      const batch = data.slice(0, 10);
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
  }, [data]);

  const loadRepo = useCallback(async (url) => {
    // Reset all state
    setIsLoading(true);
    setData(null);
    setError(null);
    setRepoInfo(null);
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

    // --- Step 2: Fetch live commits and metadata ---
    try {
      const [commitsResult, infoResult] = await Promise.all([
        fetchRepoCommits(owner, repo),
        fetchRepoInfoObj(owner, repo)
      ]);

      if (commitsResult?.error) {
        setError(commitsResult.message);
        setIsLoading(false);
        return;
      }
      
      // Update repoInfo with fetched details, e.g. private true/false flag
      setRepoInfo({ 
        owner, 
        repo, 
        private: infoResult?.private || false 
      });
      
      setData(commitsResult);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    // AI story is NOT auto-triggered — user clicks the button.
  }, []);

  /**
   * Reset all state to initial values — used by logo click.
   */
  const resetRepo = useCallback(() => {
    setIsLoading(false);
    setData(null);
    setError(null);
    setRepoInfo(null);
    setAiStory(null);
    setAiError(null);
  }, []);

  return {
    isLoading,
    data,
    error,
    repoInfo,
    aiStory,
    isAILoading,
    aiError,
    loadRepo,
    generateStory,
    resetRepo,
  };
}
