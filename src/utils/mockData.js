/* ============================================================
 * GitTrace — Mock Commit Data
 * ------------------------------------------------------------
 * Realistic mock data matching the GitHub REST API commit schema.
 * Used when VITE_USE_LIVE_API is not "true" (default behaviour)
 * so developers can work on the UI without burning rate limits.
 *
 * IMPORTANT:
 *   Each commit includes a `files` array with per-file change
 *   stats ({ filename, additions, deletions, changes }) to
 *   support the Recharts hotspot visualization later in the
 *   sprint. This structure mirrors what the GitHub "Get a single
 *   commit" endpoint returns.
 * ============================================================ */

const MOCK_COMMITS = [
  {
    sha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
    message: 'feat: add dark-mode toggle to global settings panel',
    author: {
      name: 'Alice Chen',
      email: 'alice@example.com',
      date: '2026-03-24T18:30:00Z',
      avatar_url: 'https://i.pravatar.cc/150?u=alice',
      login: 'alicechen',
    },
    url: 'https://github.com/mock-org/mock-repo/commit/a1b2c3d',
    files: [
      { filename: 'src/components/Settings.jsx', additions: 42, deletions: 3, changes: 45 },
      { filename: 'src/styles/darkMode.css', additions: 88, deletions: 0, changes: 88 },
      { filename: 'src/utils/theme.js', additions: 15, deletions: 2, changes: 17 },
    ],
  },
  {
    sha: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
    message: 'fix: resolve infinite loop in useEffect cleanup',
    author: {
      name: 'Bob Martinez',
      email: 'bob@example.com',
      date: '2026-03-24T15:12:00Z',
      avatar_url: 'https://i.pravatar.cc/150?u=bob',
      login: 'bobmartinez',
    },
    url: 'https://github.com/mock-org/mock-repo/commit/b2c3d4e',
    files: [
      { filename: 'src/hooks/usePolling.js', additions: 5, deletions: 12, changes: 17 },
    ],
  },
  {
    sha: 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2',
    message: 'docs: update README with contribution guidelines',
    author: {
      name: 'Carol Nguyen',
      email: 'carol@example.com',
      date: '2026-03-24T10:44:00Z',
      avatar_url: 'https://i.pravatar.cc/150?u=carol',
      login: 'caroln',
    },
    url: 'https://github.com/mock-org/mock-repo/commit/c3d4e5f',
    files: [
      { filename: 'README.md', additions: 64, deletions: 8, changes: 72 },
      { filename: 'CONTRIBUTING.md', additions: 120, deletions: 0, changes: 120 },
    ],
  },
  {
    sha: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3',
    message: 'refactor: extract API client into standalone module',
    author: {
      name: 'David Kim',
      email: 'david@example.com',
      date: '2026-03-23T22:00:00Z',
      avatar_url: 'https://i.pravatar.cc/150?u=david',
      login: 'davidk',
    },
    url: 'https://github.com/mock-org/mock-repo/commit/d4e5f6a',
    files: [
      { filename: 'src/api/client.js', additions: 95, deletions: 0, changes: 95 },
      { filename: 'src/api/github.js', additions: 10, deletions: 67, changes: 77 },
      { filename: 'src/api/index.js', additions: 4, deletions: 0, changes: 4 },
      { filename: 'src/hooks/useRepoData.js', additions: 3, deletions: 8, changes: 11 },
    ],
  },
  {
    sha: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4',
    message: 'feat: implement commit history timeline visualization',
    author: {
      name: 'Alice Chen',
      email: 'alice@example.com',
      date: '2026-03-23T17:25:00Z',
      avatar_url: 'https://i.pravatar.cc/150?u=alice',
      login: 'alicechen',
    },
    url: 'https://github.com/mock-org/mock-repo/commit/e5f6a7b',
    files: [
      { filename: 'src/components/Timeline.jsx', additions: 210, deletions: 0, changes: 210 },
      { filename: 'src/components/CommitCard.jsx', additions: 78, deletions: 0, changes: 78 },
      { filename: 'src/styles/timeline.css', additions: 145, deletions: 0, changes: 145 },
    ],
  },
  {
    sha: 'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5',
    message: 'test: add integration tests for commit fetcher',
    author: {
      name: 'Eve Park',
      email: 'eve@example.com',
      date: '2026-03-23T14:10:00Z',
      avatar_url: 'https://i.pravatar.cc/150?u=eve',
      login: 'evepark',
    },
    url: 'https://github.com/mock-org/mock-repo/commit/f6a7b8c',
    files: [
      { filename: 'tests/api/github.test.js', additions: 132, deletions: 0, changes: 132 },
      { filename: 'tests/fixtures/commits.json', additions: 200, deletions: 0, changes: 200 },
    ],
  },
  {
    sha: 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6',
    message: 'fix: handle null author gracefully in commit list',
    author: {
      name: 'Bob Martinez',
      email: 'bob@example.com',
      date: '2026-03-22T20:45:00Z',
      avatar_url: 'https://i.pravatar.cc/150?u=bob',
      login: 'bobmartinez',
    },
    url: 'https://github.com/mock-org/mock-repo/commit/a7b8c9d',
    files: [
      { filename: 'src/components/CommitCard.jsx', additions: 8, deletions: 2, changes: 10 },
      { filename: 'src/utils/formatters.js', additions: 12, deletions: 0, changes: 12 },
    ],
  },
  {
    sha: 'b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7',
    message: 'chore: bump dependencies and lock file',
    author: {
      name: 'Dependabot',
      email: 'noreply@github.com',
      date: '2026-03-22T08:00:00Z',
      avatar_url: 'https://i.pravatar.cc/150?u=bot',
      login: 'dependabot[bot]',
    },
    url: 'https://github.com/mock-org/mock-repo/commit/b8c9d0e',
    files: [
      { filename: 'package.json', additions: 6, deletions: 6, changes: 12 },
      { filename: 'package-lock.json', additions: 850, deletions: 720, changes: 1570 },
    ],
  },
  {
    sha: 'c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8',
    message: 'feat: add file-change heatmap for hotspot analysis',
    author: {
      name: 'Carol Nguyen',
      email: 'carol@example.com',
      date: '2026-03-21T19:33:00Z',
      avatar_url: 'https://i.pravatar.cc/150?u=carol',
      login: 'caroln',
    },
    url: 'https://github.com/mock-org/mock-repo/commit/c9d0e1f',
    files: [
      { filename: 'src/components/Heatmap.jsx', additions: 175, deletions: 0, changes: 175 },
      { filename: 'src/utils/heatmapCalc.js', additions: 60, deletions: 0, changes: 60 },
      { filename: 'src/styles/heatmap.css', additions: 48, deletions: 0, changes: 48 },
    ],
  },
  {
    sha: 'd0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9',
    message: 'perf: memoize expensive commit diff calculations',
    author: {
      name: 'David Kim',
      email: 'david@example.com',
      date: '2026-03-21T11:15:00Z',
      avatar_url: 'https://i.pravatar.cc/150?u=david',
      login: 'davidk',
    },
    url: 'https://github.com/mock-org/mock-repo/commit/d0e1f2a',
    files: [
      { filename: 'src/hooks/useDiffStats.js', additions: 22, deletions: 14, changes: 36 },
      { filename: 'src/components/DiffViewer.jsx', additions: 5, deletions: 18, changes: 23 },
    ],
  },
];

export default MOCK_COMMITS;
