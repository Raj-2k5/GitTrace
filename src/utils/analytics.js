/* ============================================================
 * GitTrace — Analytics Utilities
 * ------------------------------------------------------------
 * Data-processing helpers that transform raw commit arrays into
 * structures ready for visualizations.
 *
 * EXPORTS:
 *   processHotspotData(commits)            → treemap-ready array
 *   processContributorData(commits)        → per-author breakdown
 *   detectPrimaryLanguage(commits)         → { name, color }
 *   generateStatisticalSummary(commits, owner, repo) → string
 *   computeSparklineData(commits)          → [{ date, count }]
 *   computeDateRange(commits)              → "Mar 25 – Apr 16, 2026"
 *   computeTotalStats(commits)             → { additions, deletions }
 * ============================================================ */

// ------------------------------------------------------------
// 1. processHotspotData (existing — unchanged)
// ------------------------------------------------------------

/**
 * Aggregate per-file change frequency for treemap visualization.
 * @param {Array} commits
 * @returns {Array<{name: string, size: number, commits: number}>}
 */
export function processHotspotData(commits) {
  if (!commits || !Array.isArray(commits) || commits.length === 0) {
    return [];
  }

  const fileMap = new Map();

  for (const commit of commits) {
    if (!commit.files || !Array.isArray(commit.files)) continue;

    for (const file of commit.files) {
      const fname = file.filename;
      if (!fname) continue;

      const changeCount = file.changes ?? ((file.additions ?? 0) + (file.deletions ?? 0));

      const existing = fileMap.get(fname);
      if (existing) {
        existing.changes += changeCount;
        existing.commits += 1;
        // Track last commit that modified this file
        existing.lastSha = commit.sha;
        existing.lastDate = commit.author?.date ?? '';
      } else {
        fileMap.set(fname, {
          changes: changeCount,
          commits: 1,
          lastSha: commit.sha,
          lastDate: commit.author?.date ?? '',
        });
      }
    }
  }

  return Array.from(fileMap.entries())
    .map(([name, stats]) => ({
      name,
      size: Math.max(1, Math.round(stats.changes)),
      commits: stats.commits,
      lastSha: stats.lastSha,
      lastDate: stats.lastDate,
    }))
    .filter((f) => f.size > 0)
    .sort((a, b) => b.size - a.size)
    .slice(0, 20);
}

// ------------------------------------------------------------
// 2. processContributorData
// ------------------------------------------------------------

/**
 * Aggregate per-author statistics from commits.
 * @param {Array} commits
 * @returns {Array<{name, login, avatar_url, commits, additions, deletions}>}
 */
export function processContributorData(commits) {
  if (!commits || commits.length === 0) return [];

  const authorMap = new Map();

  for (const commit of commits) {
    const name = commit.author?.name || 'Unknown';
    const key = name.toLowerCase();

    const existing = authorMap.get(key);
    const additions = commit.stats?.additions ?? commit.files?.reduce((s, f) => s + (f.additions ?? 0), 0) ?? 0;
    const deletions = commit.stats?.deletions ?? commit.files?.reduce((s, f) => s + (f.deletions ?? 0), 0) ?? 0;

    if (existing) {
      existing.commits += 1;
      existing.additions += additions;
      existing.deletions += deletions;
    } else {
      authorMap.set(key, {
        name,
        login: commit.author?.login || '',
        avatar_url: commit.author?.avatar_url || '',
        commits: 1,
        additions,
        deletions,
      });
    }
  }

  return Array.from(authorMap.values())
    .sort((a, b) => b.commits - a.commits);
}

// ------------------------------------------------------------
// 3. detectPrimaryLanguage
// ------------------------------------------------------------

const LANG_MAP = {
  js:    { name: 'JavaScript',  color: '#F7DF1E' },
  jsx:   { name: 'JavaScript',  color: '#F7DF1E' },
  ts:    { name: 'TypeScript',  color: '#3178C6' },
  tsx:   { name: 'TypeScript',  color: '#3178C6' },
  py:    { name: 'Python',      color: '#3572A5' },
  rb:    { name: 'Ruby',        color: '#CC342D' },
  java:  { name: 'Java',        color: '#B07219' },
  go:    { name: 'Go',          color: '#00ADD8' },
  rs:    { name: 'Rust',        color: '#DEA584' },
  cpp:   { name: 'C++',         color: '#F34B7D' },
  c:     { name: 'C',           color: '#555555' },
  cs:    { name: 'C#',          color: '#239120' },
  php:   { name: 'PHP',         color: '#4F5D95' },
  swift: { name: 'Swift',       color: '#FA7343' },
  kt:    { name: 'Kotlin',      color: '#A97BFF' },
  vue:   { name: 'Vue',         color: '#41B883' },
  svelte:{ name: 'Svelte',      color: '#FF3E00' },
  html:  { name: 'HTML',        color: '#E34C26' },
  css:   { name: 'CSS',         color: '#1572B6' },
  scss:  { name: 'SCSS',        color: '#C6538C' },
  md:    { name: 'Markdown',    color: '#083FA1' },
  json:  { name: 'JSON',        color: '#292929' },
  yml:   { name: 'YAML',        color: '#CB171E' },
  yaml:  { name: 'YAML',        color: '#CB171E' },
  sh:    { name: 'Shell',       color: '#89E051' },
};

/**
 * Detect primary programming language from file extensions across commits.
 * Ignores lock files and config.
 * @param {Array} commits
 * @returns {{ name: string, color: string } | null}
 */
export function detectPrimaryLanguage(commits) {
  if (!commits || commits.length === 0) return null;

  const extCount = {};
  const ignored = new Set(['json', 'md', 'yml', 'yaml', 'txt', 'lock', 'toml', 'cfg', 'ini', 'env']);

  for (const commit of commits) {
    if (!commit.files) continue;
    for (const file of commit.files) {
      if (!file.filename) continue;
      const ext = file.filename.split('.').pop()?.toLowerCase();
      if (!ext || ignored.has(ext)) continue;
      if (file.filename.includes('lock')) continue;
      extCount[ext] = (extCount[ext] || 0) + (file.changes ?? 1);
    }
  }

  const sorted = Object.entries(extCount).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;

  const topExt = sorted[0][0];
  return LANG_MAP[topExt] || { name: topExt.toUpperCase(), color: '#6B7280' };
}

// ------------------------------------------------------------
// 4. generateStatisticalSummary
// ------------------------------------------------------------

/**
 * Rule-based statistical summary when AI is unavailable.
 * @param {Array} commits
 * @param {string} owner
 * @param {string} repo
 * @returns {string}
 */
export function generateStatisticalSummary(commits, owner, repo) {
  if (!commits || commits.length === 0) return '';

  const contributors = processContributorData(commits);
  const totalStats = computeTotalStats(commits);
  const dateRange = computeDateRange(commits);
  const hotspots = processHotspotData(commits);

  const repoName = `${owner}/${repo}`;
  const numCommits = commits.length;
  const numContributors = contributors.length;

  // Calculate date span in weeks
  const dates = commits
    .map(c => new Date(c.author?.date))
    .filter(d => !isNaN(d));
  let weekSpan = '';
  if (dates.length >= 2) {
    const earliest = Math.min(...dates);
    const latest = Math.max(...dates);
    const weeks = Math.max(1, Math.round((latest - earliest) / (7 * 24 * 60 * 60 * 1000)));
    weekSpan = `${weeks} week${weeks !== 1 ? 's' : ''}`;
  }

  // Find largest commit
  let largestCommitLines = 0;
  for (const c of commits) {
    const total = (c.stats?.additions ?? 0) + (c.stats?.deletions ?? 0);
    if (total > largestCommitLines) largestCommitLines = total;
  }

  // Hottest file
  let hottestInfo = '';
  if (hotspots.length > 0) {
    const top = hotspots[0];
    const totalChanges = hotspots.reduce((s, h) => s + h.size, 0);
    const pct = totalChanges > 0 ? Math.round((top.size / totalChanges) * 100) : 0;
    hottestInfo = ` ${top.name.split('/').pop()} accounts for ${pct}% of all file changes.`;
  }

  let parts = [];
  parts.push(`${repoName} has ${formatNumber(numCommits)} commit${numCommits !== 1 ? 's' : ''}`);
  if (weekSpan) parts[0] += ` across ${weekSpan}`;
  parts[0] += `, driven by ${numContributors} contributor${numContributors !== 1 ? 's' : ''}.`;

  if (largestCommitLines > 0) {
    parts.push(`The largest commit added ${formatNumber(largestCommitLines)} lines in a single push.`);
  }

  if (hottestInfo) parts.push(hottestInfo.trim());

  return parts.join(' ');
}

// ------------------------------------------------------------
// 5. computeSparklineData
// ------------------------------------------------------------

/**
 * Group commits into daily buckets for sparkline visualization.
 * @param {Array} commits
 * @returns {Array<{date: string, count: number}>}
 */
export function computeSparklineData(commits) {
  if (!commits || commits.length === 0) return [];

  const dayMap = {};

  for (const c of commits) {
    const d = c.author?.date;
    if (!d) continue;
    const day = d.slice(0, 10); // "YYYY-MM-DD"
    dayMap[day] = (dayMap[day] || 0) + 1;
  }

  // Get full date range
  const days = Object.keys(dayMap).sort();
  if (days.length === 0) return [];

  const start = new Date(days[0]);
  const end = new Date(days[days.length - 1]);
  const result = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: dayMap[key] || 0 });
  }

  return result;
}

// ------------------------------------------------------------
// 6. computeDateRange
// ------------------------------------------------------------

/**
 * Compute formatted date range from commits.
 * @param {Array} commits
 * @returns {string} e.g. "Mar 25 – Apr 16, 2026"
 */
export function computeDateRange(commits) {
  if (!commits || commits.length === 0) return '';

  const dates = commits
    .map(c => new Date(c.author?.date))
    .filter(d => !isNaN(d))
    .sort((a, b) => a - b);

  if (dates.length === 0) return '';

  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const earliest = dates[0];
  const latest = dates[dates.length - 1];

  const yearPart = latest.getFullYear();

  if (earliest.toDateString() === latest.toDateString()) {
    return `${fmt(earliest)}, ${yearPart}`;
  }

  return `${fmt(earliest)} – ${fmt(latest)}, ${yearPart}`;
}

// ------------------------------------------------------------
// 7. computeTotalStats
// ------------------------------------------------------------

/**
 * Compute total additions and deletions across all commits.
 * @param {Array} commits
 * @returns {{ additions: number, deletions: number }}
 */
export function computeTotalStats(commits) {
  if (!commits || commits.length === 0) return { additions: 0, deletions: 0 };

  let additions = 0;
  let deletions = 0;

  for (const c of commits) {
    if (c.stats) {
      additions += c.stats.additions ?? 0;
      deletions += c.stats.deletions ?? 0;
    } else if (c.files) {
      for (const f of c.files) {
        additions += f.additions ?? 0;
        deletions += f.deletions ?? 0;
      }
    }
  }

  return { additions, deletions };
}

// ------------------------------------------------------------
// 8. Shared Helpers
// ------------------------------------------------------------

/**
 * Format a number with commas: 4447 → "4,447"
 */
export function formatNumber(n) {
  if (n == null || isNaN(n)) return '0';
  return n.toLocaleString('en-US');
}

/**
 * Derive a stable HSL color from a string (for initials avatars).
 */
export function stringToColor(str) {
  if (!str) return 'hsl(0, 0%, 40%)';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

/**
 * Get initials from a name (first letter, uppercase).
 * Always returns a character — 'U' for 'unknown', '?' for empty.
 */
export function getInitials(name) {
  if (!name) return '?';
  const n = name.trim().toLowerCase();
  if (n === 'unknown') return 'U';
  return name.charAt(0).toUpperCase();
}

/**
 * Get heat border color based on total lines changed.
 */
export function getHeatColor(linesChanged) {
  if (linesChanged >= 5000) return '#DC2626';
  if (linesChanged >= 1000) return '#EA580C';
  if (linesChanged >= 500)  return '#D97706';
  if (linesChanged >= 100)  return '#059669';
  return '#1D4ED8';
}

/**
 * Group commits by month/year.
 * @param {Array} commits
 * @returns {Array<{label: string, month: string, commits: Array}>}
 */
export function groupCommitsByMonth(commits) {
  if (!commits || commits.length === 0) return [];

  const groups = new Map();

  for (const commit of commits) {
    const d = new Date(commit.author?.date);
    if (isNaN(d)) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    if (!groups.has(key)) {
      groups.set(key, { label, month: key, commits: [] });
    }
    groups.get(key).commits.push(commit);
  }

  // Sort by most recent first
  return Array.from(groups.values()).sort((a, b) => b.month.localeCompare(a.month));
}

// ------------------------------------------------------------
// 9. extractFeatures — scan commit messages for feature keywords
// ------------------------------------------------------------

const FEATURE_KEYWORDS = /^(feat|add|implement|create|introduce|initial|setup|build|enable|integrate|design|launch)/i;

/**
 * Extract feature entries from commit messages.
 * Looks for commits whose message starts with feature-related keywords.
 * @param {Array} commits
 * @returns {Array<{date: string, name: string, heat: string}>}
 */
export function extractFeatures(commits) {
  if (!commits || commits.length === 0) return [];

  // Sort oldest first
  const sorted = [...commits].sort(
    (a, b) => new Date(a.author?.date) - new Date(b.author?.date)
  );

  const features = [];

  for (const c of sorted) {
    const msg = (c.message || '').split('\n')[0].trim();
    if (!msg) continue;

    // Check for conventional commit prefix or keywords
    const lower = msg.toLowerCase();
    const isFeature =
      FEATURE_KEYWORDS.test(lower) ||
      lower.startsWith('feat:') ||
      lower.startsWith('feat(') ||
      lower.includes('initial commit') ||
      lower.includes('first commit');

    if (isFeature) {
      const date = c.author?.date?.slice(0, 10) || '?';
      // Clean up the message: remove prefixes like 'feat:', 'feat(scope):'
      let name = msg
        .replace(/^(feat|add|implement|create|introduce|initial|setup|build|enable|integrate|design|launch)[:\s(]*/i, '')
        .replace(/^\)\s*:?\s*/, '')
        .trim();
      // Capitalize first letter
      if (name.length > 0) {
        name = name.charAt(0).toUpperCase() + name.slice(1);
      }
      // Truncate long messages
      if (name.length > 80) name = name.slice(0, 77) + '…';

      const changes = (c.stats?.additions ?? 0) + (c.stats?.deletions ?? 0);
      features.push({ date, name, heat: getHeatColor(changes) });
    }
  }

  return features.slice(0, 8);
}

// ------------------------------------------------------------
// 10. computeActivityStatus — Active / Slowing / Stale
// ------------------------------------------------------------

/**
 * Compute activity status based on days since last commit.
 * @param {Array} commits
 * @returns {{ status: string, daysSince: number, icon: string, colorClass: string }}
 */
export function computeActivityStatus(commits) {
  if (!commits || commits.length === 0) {
    return { status: 'Unknown', daysSince: -1, icon: '?', colorClass: 'status--unknown' };
  }

  const dates = commits
    .map(c => new Date(c.author?.date))
    .filter(d => !isNaN(d));

  if (dates.length === 0) {
    return { status: 'Unknown', daysSince: -1, icon: '?', colorClass: 'status--unknown' };
  }

  const latest = new Date(Math.max(...dates));
  const daysSince = Math.floor((Date.now() - latest.getTime()) / (86400000));

  if (daysSince <= 7) {
    return { status: 'Active', daysSince, icon: '✓', colorClass: 'status--active' };
  } else if (daysSince <= 30) {
    return { status: 'Slowing down', daysSince, icon: '⚡', colorClass: 'status--slowing' };
  } else {
    return { status: 'Stale', daysSince, icon: '⚠', colorClass: 'status--stale' };
  }
}

// ------------------------------------------------------------
// 11. computeDuration — human-readable time span
// ------------------------------------------------------------

/**
 * Compute human-readable duration between first and last commit.
 * @param {Array} commits
 * @returns {{ duration: string, firstDate: string, lastDate: string }}
 */
export function computeDuration(commits) {
  if (!commits || commits.length === 0) {
    return { duration: '', firstDate: '', lastDate: '' };
  }

  const dates = commits
    .map(c => new Date(c.author?.date))
    .filter(d => !isNaN(d))
    .sort((a, b) => a - b);

  if (dates.length === 0) {
    return { duration: '', firstDate: '', lastDate: '' };
  }

  const first = dates[0];
  const last = dates[dates.length - 1];
  const diffMs = last - first;
  const diffDays = Math.floor(diffMs / 86400000);

  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  let duration;
  if (diffDays === 0) {
    duration = 'Same day';
  } else if (diffDays < 7) {
    duration = `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;
    duration = `${weeks} week${weeks !== 1 ? 's' : ''}`;
    if (days > 0) duration += ` ${days} day${days !== 1 ? 's' : ''}`;
  } else {
    const months = Math.floor(diffDays / 30);
    const weeks = Math.floor((diffDays % 30) / 7);
    duration = `${months} month${months !== 1 ? 's' : ''}`;
    if (weeks > 0) duration += ` ${weeks} week${weeks !== 1 ? 's' : ''}`;
  }

  return { duration, firstDate: fmt(first), lastDate: fmt(last) };
}

// ------------------------------------------------------------
// 12. buildRuleBasedAnalysis — full fallback without AI
// ------------------------------------------------------------

/**
 * Build a complete structured analysis from commit data alone.
 * Used when no Gemini API key is available.
 */
export function buildRuleBasedAnalysis(commits, owner, repo, hotspots) {
  const contributors = processContributorData(commits);
  const lang = detectPrimaryLanguage(commits);
  const { duration, firstDate, lastDate } = computeDuration(commits);
  const status = computeActivityStatus(commits);
  const features = extractFeatures(commits);
  const totalStats = computeTotalStats(commits);

  // Biggest commit
  let biggestCommit = null;
  let biggestLines = 0;
  for (const c of commits) {
    const total = (c.stats?.additions ?? 0) + (c.stats?.deletions ?? 0);
    if (total > biggestLines) {
      biggestLines = total;
      biggestCommit = c;
    }
  }

  // Volatility insight
  let volatility = '';
  if (hotspots.length > 0) {
    const totalChanges = hotspots.reduce((s, h) => s + h.size, 0);
    const top = hotspots[0];
    const pct = totalChanges > 0 ? Math.round((top.size / totalChanges) * 100) : 0;
    const fileName = top.name.split('/').pop();
    const isLockFile = fileName.includes('lock') || fileName.includes('package-lock');
    volatility = `${fileName} accounts for ${pct}% of all changes`;
    if (isLockFile) {
      volatility += ' — likely dependency churn, not feature work.';
    } else {
      volatility += ' — this file is under active development.';
    }
  }

  return {
    project: `${owner}/${repo} — a ${lang?.name || 'code'} project with ${commits.length} commits across ${duration || 'a single session'}.`,
    goal: null, // Can't infer without AI
    timeline_duration: duration,
    firstDate,
    lastDate,
    features,
    biggest_change: biggestCommit
      ? `${biggestCommit.message?.split('\n')[0]} — ${formatNumber(biggestLines)} lines changed`
      : null,
    volatility,
    status: status.status,
    days_since_last: status.daysSince,
    isRuleBased: true,
  };
}
