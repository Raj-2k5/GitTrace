/* ============================================================
 * GitTrace — Analytics Utilities
 * ------------------------------------------------------------
 * Data-processing helpers that transform raw commit arrays into
 * structures ready for Recharts visualizations.
 *
 * EXPORTS:
 *   processHotspotData(commits) → treemap-ready flat array
 * ============================================================ */

// ------------------------------------------------------------
// 1. processHotspotData
// ------------------------------------------------------------

/**
 * Iterate through commits and their associated `files` arrays
 * to aggregate per-file change frequency.
 *
 * For each file that appears across all commits we track:
 *   - `commitCount`  — how many commits touched this file
 *   - `totalChanges` — sum of `changes` (additions + deletions)
 *
 * RETURN FORMAT (flat array for Recharts Treemap):
 *   [{ name: "src/App.jsx", size: 45, commits: 3 }, ...]
 *
 * Files with 0 total changes are filtered out to prevent NaN
 * in Treemap layout calculations. `size` is guaranteed to be
 * a valid integer > 0. Sorted descending, capped at top 20.
 *
 * @param {Array} commits — Array of commit objects, each with
 *                          an optional `.files` array of
 *                          { filename, additions, deletions, changes }.
 * @returns {Array<{name: string, size: number, commits: number}>}
 */
export function processHotspotData(commits) {
  if (!commits || !Array.isArray(commits) || commits.length === 0) {
    return [];
  }

  /** @type {Map<string, {changes: number, commits: number}>} */
  const fileMap = new Map();

  for (const commit of commits) {
    // Guard: some commits may not have file data
    if (!commit.files || !Array.isArray(commit.files)) continue;

    for (const file of commit.files) {
      const fname = file.filename;
      if (!fname) continue;

      const changeCount = file.changes ?? ((file.additions ?? 0) + (file.deletions ?? 0));

      const existing = fileMap.get(fname);
      if (existing) {
        existing.changes += changeCount;
        existing.commits += 1;
      } else {
        fileMap.set(fname, {
          changes: changeCount,
          commits: 1,
        });
      }
    }
  }

  // Convert map → sorted array, filter out zero-change files, take top 20
  return Array.from(fileMap.entries())
    .map(([name, stats]) => ({
      name,
      size: Math.max(1, Math.round(stats.changes)),  // guarantee integer > 0
      commits: stats.commits,
    }))
    .filter((f) => f.size > 0)
    .sort((a, b) => b.size - a.size)
    .slice(0, 20);
}

