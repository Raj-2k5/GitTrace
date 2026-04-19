/* ============================================================
 * GitTrace — GitHub API Service
 * ------------------------------------------------------------
 * Handles all GitHub REST API communication.
 * NO mock-data fallback — always hits the live API.
 * ============================================================ */

import { githubFetch } from '../utils/githubFetch';

const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes
const DETAIL_FETCH_LIMIT = 15;

const cacheKey = (owner, repo) => `gittrace_commits_${owner.toLowerCase()}_${repo.toLowerCase()}`;

const readCache = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { timestamp, data } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};

const writeCache = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    console.warn('[GitTrace] Unable to write to LocalStorage cache.');
  }
};

/**
 * Fetch detailed commit data via GET /repos/{owner}/{repo}/commits/{sha}.
 */
async function fetchCommitDetail(owner, repo, sha) {
  try {
    const res = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    return { files: data.files ?? [], stats: data.stats ?? {} };
  } catch (err) {
    return null;
  }
}

/**
 * Fetch repo info (checking if private)
 */
export async function fetchRepoInfoObj(owner, repo) {
  try {
    const res = await githubFetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    return {
      owner: data.owner.login,
      repo: data.name,
      private: data.private,
    };
  } catch (err) {
    return null;
  }
}

export async function fetchRepoCommits(owner, repo) {
  const key = cacheKey(owner, repo);
  const cached = readCache(key);
  if (cached) return cached;

  try {
    const res = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=30`);
    if (!res.ok) throw res; // Throw response to branch into status handling
    
    const data = await res.json();
    
    const commits = (Array.isArray(data) ? data : []).map((item) => ({
      sha: item.sha,
      message: item.commit?.message || '',
      author: {
        name: item.commit?.author?.name ?? 'Unknown',
        email: item.commit?.author?.email ?? '',
        date: item.commit?.author?.date ?? '',
        avatar_url: item.author?.avatar_url ?? '',
        login: item.author?.login ?? '',
      },
      url: item.html_url,
      files: [],
      stats: null,
    }));

    const toEnrich = commits.slice(0, DETAIL_FETCH_LIMIT);
    const detailResults = await Promise.allSettled(
      toEnrich.map((c) => fetchCommitDetail(owner, repo, c.sha))
    );

    detailResults.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        commits[i].files = result.value.files;
        commits[i].stats = result.value.stats;
      }
    });

    writeCache(key, commits);
    return commits;
  } catch (err) {
    return buildError(err);
  }
}

function buildError(err) {
  const status = err.status ?? 500;
  if (status === 404) return { error: true, status, message: 'Repository not found. It may be private, deleted, or the URL is incorrect.' };
  if (status === 403) return { error: true, status, message: 'GitHub API rate limit exceeded. Sign in above for 5,000 requests/hour.' };
  return { error: true, status, message: err.message || 'An unexpected error occurred while fetching commits.' };
}
