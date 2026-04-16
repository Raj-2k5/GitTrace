/* ============================================================
 * GitTrace — GitHub API Service
 * ------------------------------------------------------------
 * Handles all GitHub REST API communication through Octokit.
 * NO mock-data fallback — always hits the live API.
 *
 * KEY FEATURES:
 *  1. Fetches the last 30 commits for any public repo.
 *  2. Enriches the top 15 commits with detailed file-change
 *     data via individual commit fetches (Promise.allSettled).
 *  3. LocalStorage caching with a 60-minute TTL — stores the
 *     enriched data so the detail-fetch doesn't re-run.
 *  4. Structured error objects for 404, 403 (rate-limit), and
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
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes in milliseconds
const DETAIL_FETCH_LIMIT = 15;        // Max commits to enrich with file data

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

    // Check freshness — return null if older than 60 minutes
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
// 3. Detail Fetcher
// ------------------------------------------------------------

/**
 * Fetch detailed commit data (including the `files` array) for
 * a single commit SHA via GET /repos/{owner}/{repo}/commits/{sha}.
 *
 * @param {string} owner - Repository owner
 * @param {string} repo  - Repository name
 * @param {string} sha   - The commit SHA to fetch
 * @returns {Promise<{files: Array, stats: Object}|null>}
 */
async function fetchCommitDetail(owner, repo, sha) {
  try {
    const { data } = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: sha,
    });
    return {
      files: data.files ?? [],
      stats: data.stats ?? {},
    };
  } catch (err) {
    // Individual commit fetch failure is non-fatal — log and return null
    console.warn(`[GitTrace] Failed to fetch detail for ${sha.slice(0, 7)}:`, err.message);
    return null;
  }
}

// ------------------------------------------------------------
// 4. Public API
// ------------------------------------------------------------

/**
 * Fetch the last 30 commits for a public GitHub repository,
 * then enrich the top 15 with detailed file-change data.
 *
 * Flow:
 *   1. Check LocalStorage cache → return if fresh (< 60 min).
 *   2. List 30 commits via Octokit.
 *   3. Slice top 15 → fetch each individually for file details.
 *   4. Merge file data back into commit objects.
 *   5. Cache the enriched array and return it.
 *   6. On error, return a structured error object.
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

  // --- (b) Step A: Fetch the commit list ---
  try {
    const { data } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: 30,
    });

    // Normalise to a leaner shape
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
      files: [],   // placeholder — enriched below
      stats: null,
    }));

    // --- (c) Step B & C: Enrich top 15 with file details ---
    const toEnrich = commits.slice(0, DETAIL_FETCH_LIMIT);

    console.info(
      `[GitTrace] Fetching file details for ${toEnrich.length} commits…`,
    );

    const detailResults = await Promise.allSettled(
      toEnrich.map((c) => fetchCommitDetail(owner, repo, c.sha)),
    );

    // --- (d) Step D: Merge detail data back into commits ---
    detailResults.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        commits[i].files = result.value.files;
        commits[i].stats = result.value.stats;
      }
    });

    // --- (e) Persist enriched data to cache ---
    writeCache(key, commits);
    console.info(
      `[GitTrace] Fetched & cached ${commits.length} commits ` +
      `(${toEnrich.length} enriched) for ${owner}/${repo}`,
    );

    return commits;
  } catch (err) {
    // --- (f) Error handling ---
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
