/* ============================================================
 * GitTrace — GitHub Extra API Helpers
 * ------------------------------------------------------------
 * Lightweight fetch wrappers for breadcrumb dropdowns,
 * related repositories, and branch/tag listing.
 * Uses raw fetch (not Octokit) to avoid unnecessary overhead.
 * ============================================================ */

const GH_API = 'https://api.github.com';

function headers() {
  const h = { Accept: 'application/vnd.github+json' };
  const token = import.meta.env.VITE_GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghFetch(url) {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

/**
 * Fetch a user's public repos (for breadcrumb owner dropdown).
 * @returns {Promise<Array<{name, language, stargazers_count, description, html_url}>>}
 */
export async function fetchUserRepos(username) {
  return ghFetch(`${GH_API}/users/${username}/repos?sort=updated&per_page=10`);
}

/**
 * Fetch branches for a repository.
 */
export async function fetchBranches(owner, repo) {
  return ghFetch(`${GH_API}/repos/${owner}/${repo}/branches?per_page=20`);
}

/**
 * Fetch tags for a repository.
 */
export async function fetchTags(owner, repo) {
  return ghFetch(`${GH_API}/repos/${owner}/${repo}/tags?per_page=20`);
}

/**
 * Fetch repository topics.
 */
export async function fetchTopics(owner, repo) {
  const data = await ghFetch(`${GH_API}/repos/${owner}/${repo}/topics`);
  return data.names || [];
}

/**
 * Fetch related repositories based on topics and language.
 * Exclude the current repo from results. Cap at 5.
 */
export async function fetchRelatedRepos(owner, repo, language) {
  try {
    // First try topics
    let topics = [];
    try {
      topics = await fetchTopics(owner, repo);
    } catch { /* no topics */ }

    let results = [];

    // Search by first topic + language
    if (topics.length > 0 && language) {
      const q = `topic:${topics[0]}+language:${language}`;
      const data = await ghFetch(
        `${GH_API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=8`
      );
      results = data.items || [];
    }

    // If not enough results, search by language + owner's other repos
    if (results.length < 3) {
      try {
        const ownerRepos = await fetchUserRepos(owner);
        const additional = ownerRepos
          .filter(r => r.name !== repo)
          .map(r => ({
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

    // Deduplicate + exclude current repo
    const seen = new Set();
    const currentFullName = `${owner}/${repo}`.toLowerCase();
    return results
      .filter(r => {
        const fn = (r.full_name || `${r.owner?.login}/${r.name}`).toLowerCase();
        if (fn === currentFullName || seen.has(fn)) return false;
        seen.add(fn);
        return true;
      })
      .slice(0, 5);
  } catch (err) {
    console.warn('[GitTrace] Failed to fetch related repos:', err.message);
    return [];
  }
}
