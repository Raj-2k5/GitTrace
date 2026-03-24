/* ============================================================
 * GitTrace — GitHub API Service
 * ------------------------------------------------------------
 * Handles all GitHub REST API communication through Octokit.
 *
 * KEY FEATURES:
 *  1. Fetches the last 50 commits for any public repo.
 *  2. LocalStorage caching layer with a 1-hour TTL to respect
 *     GitHub's unauthenticated rate limit (60 requests / hour).
 *  3. Structured error objects for 404, 403 (rate-limit), and
 *     generic failures — no thrown exceptions leak to the UI.
 *
 * USAGE:
 *   import { fetchRepoCommits } from './api/github';
 *   const result = await fetchRepoCommits('facebook', 'react');
 *   if (result.error) { console.error(result.message); }
 *   else { console.log(result); }  // Array of commit objects
 * ============================================================ */

import { Octokit } from 'octokit';

// ------------------------------------------------------------
// 1. Octokit Instance
// ------------------------------------------------------------
// If the user provides a Personal Access Token via env var we
// use it for the 5 000 req/hr authenticated tier; otherwise we
// fall back to 60 req/hr unauthenticated access.
const octokit = new Octokit({
  auth: import.meta.env.VITE_GITHUB_TOKEN || undefined,
});

// ------------------------------------------------------------
// 2. Cache Configuration
// ------------------------------------------------------------
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Generate a deterministic LocalStorage key for a given repo.
 * @param {string} owner - Repository owner (e.g. "facebook")
 * @param {string} repo  - Repository name  (e.g. "react")
 * @returns {string}     - Cache key string
 */
const cacheKey = (owner, repo) =>
  `gittrace_commits_${owner.toLowerCase()}_${repo.toLowerCase()}`;

/**
 * Try to read a non-stale entry from LocalStorage.
 * @param {string} key - The cache key to look up.
 * @returns {Array|null} - Cached commit array, or null on miss / stale.
 */
const readCache = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const { timestamp, data } = JSON.parse(raw);

    // Check freshness — return null if older than TTL
    if (Date.now() - timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key); // evict stale entry
      return null;
    }

    return data;
  } catch {
    // Corrupted entry — nuke it and move on
    localStorage.removeItem(key);
    return null;
  }
};

/**
 * Persist commit data to LocalStorage with the current timestamp.
 * @param {string} key  - The cache key.
 * @param {Array}  data - The commit array to cache.
 */
const writeCache = (key, data) => {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ timestamp: Date.now(), data }),
    );
  } catch {
    // localStorage may be full — silently ignore
    console.warn('[GitTrace] Unable to write to LocalStorage cache.');
  }
};

// ------------------------------------------------------------
// 3. Public API
// ------------------------------------------------------------

/**
 * Fetch the last 50 commits for a public GitHub repository.
 *
 * Flow:
 *   1. Check LocalStorage cache → return if fresh.
 *   2. Call GitHub REST API via Octokit.
 *   3. Cache the response and return the commit array.
 *   4. On error, return a structured error object.
 *
 * @param {string} owner - Repository owner (e.g. "facebook")
 * @param {string} repo  - Repository name  (e.g. "react")
 * @returns {Promise<Array|{error:true, status:number, message:string}>}
 */
export async function fetchRepoCommits(owner, repo) {
  // --- (a) Cache check ---
  const key = cacheKey(owner, repo);
  const cached = readCache(key);
  if (cached) {
    console.info(`[GitTrace] Cache hit for ${owner}/${repo}`);
    return cached;
  }

  // --- (b) Live API call ---
  try {
    const { data } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: 50,
    });

    // Normalise the response to a leaner shape that the UI needs.
    // We keep the full object so downstream (e.g. Recharts hotspot)
    // can access nested fields like `files`, `stats`, etc.
    const commits = data.map((item) => ({
      sha: item.sha,
      message: item.commit.message,
      author: {
        name: item.commit.author?.name ?? 'Unknown',
        email: item.commit.author?.email ?? '',
        date: item.commit.author?.date ?? '',
        avatar_url: item.author?.avatar_url ?? '',
        login: item.author?.login ?? '',
      },
      url: item.html_url,
      // `files` is only present when fetching a single commit,
      // so it will be undefined here — the UI should handle that.
      files: item.files ?? [],
    }));

    // --- (c) Persist to cache ---
    writeCache(key, commits);
    console.info(`[GitTrace] Fetched & cached ${commits.length} commits for ${owner}/${repo}`);

    return commits;
  } catch (err) {
    // --- (d) Error handling ---
    return buildError(err);
  }
}

// ------------------------------------------------------------
// 4. Error Helpers
// ------------------------------------------------------------

/**
 * Convert an Octokit / network error into a structured error
 * object that the UI layer can display gracefully.
 *
 * @param {Error} err - The caught error.
 * @returns {{error: true, status: number, message: string}}
 */
function buildError(err) {
  const status = err.status ?? 500;

  // 404 — repo does not exist or is private
  if (status === 404) {
    return {
      error: true,
      status,
      message:
        'Repository not found. It may be private, deleted, or the URL is incorrect.',
    };
  }

  // 403 — rate limit exceeded (or forbidden)
  if (status === 403) {
    return {
      error: true,
      status,
      message:
        'GitHub API rate limit exceeded. Try again later or add a VITE_GITHUB_TOKEN in your .env file for higher limits.',
    };
  }

  // Everything else — generic failure
  return {
    error: true,
    status,
    message: err.message || 'An unexpected error occurred while fetching commits.',
  };
}
