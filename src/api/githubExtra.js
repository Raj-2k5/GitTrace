/* ============================================================
 * GitTrace — GitHub Extra API Helpers
 * ------------------------------------------------------------
 * Lightweight fetch wrappers. Uses githubFetch.
 * ============================================================ */

import { githubFetch } from '../utils/githubFetch';

const GH_API = 'https://api.github.com';

async function ghFetch(url) {
  const res = await githubFetch(url);
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

/**
 * Fetch a user's public repos.
 */
export async function fetchUserRepos(username) {
  return ghFetch(`${GH_API}/users/${username}/repos?sort=updated&per_page=10`);
}

/**
 * Fetch branches.
 */
export async function fetchBranches(owner, repo) {
  return ghFetch(`${GH_API}/repos/${owner}/${repo}/branches?per_page=20`);
}

/**
 * Fetch tags.
 */
export async function fetchTags(owner, repo) {
  return ghFetch(`${GH_API}/repos/${owner}/${repo}/tags?per_page=20`);
}

/**
 * Fetch topics.
 */
export async function fetchTopics(owner, repo) {
  const data = await ghFetch(`${GH_API}/repos/${owner}/${repo}/topics`);
  return data.names || [];
}

/**
 * Fetch related repos.
 */
export async function fetchRelatedRepos(owner, repo, language) {
  try {
    let topics = [];
    try { topics = await fetchTopics(owner, repo); } catch { /* no topics */ }

    let results = [];
    if (topics.length > 0 && language) {
      const q = `topic:${topics[0]}+language:${language}`;
      const data = await ghFetch(`${GH_API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=8`);
      results = data.items || [];
    }

    if (results.length < 3) {
      try {
        const ownerRepos = await fetchUserRepos(owner);
        const additional = ownerRepos.filter(r => r.name !== repo).map(r => ({
          full_name: `${owner}/${r.name}`,
          name: r.name,
          owner: { login: owner },
          description: r.description,
          language: r.language,
          stargazers_count: r.stargazers_count,
          topics: [],
        }));
        results = [...results, ...additional];
      } catch { /* skip */ }
    }

    const seen = new Set();
    const currentFullName = `${owner}/${repo}`.toLowerCase();
    return results.filter(r => {
      const fn = (r.full_name || `${r.owner?.login}/${r.name}`).toLowerCase();
      if (fn === currentFullName || seen.has(fn)) return false;
      seen.add(fn);
      return true;
    }).slice(0, 5);
  } catch (err) {
    return [];
  }
}
