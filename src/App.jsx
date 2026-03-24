/* ============================================================
 * GitTrace — App Entry Point
 * ------------------------------------------------------------
 * Wires up the useRepoData hook and renders the repo search bar
 * with the animated Timeline component (now including AI story).
 * Styled with Tailwind CSS for a dark-mode-first aesthetic.
 * ============================================================ */

import { useState } from 'react';
import { Search } from 'lucide-react';
import useRepoData from './hooks/useRepoData';
import Timeline from './components/timeline/Timeline';
import './index.css';

function App() {
  // Local controlled input state
  const [url, setUrl] = useState('');

  // Hook state + action (now includes AI story state)
  const {
    isLoading,
    data,
    error,
    aiStory,
    isAILoading,
    aiError,
    loadRepo,
  } = useRepoData();

  /** Handle form submission */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) loadRepo(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100">
      {/* ──────────── Header ──────────── */}
      <header className="pt-16 pb-10 text-center">
        <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          GitTrace
        </h1>
        <p className="mt-3 text-gray-400 text-lg">
          Paste a GitHub repo URL to explore its commit history
        </p>
      </header>

      {/* ──────────── Search Bar ──────────── */}
      <main className="max-w-2xl mx-auto px-4 pb-20">
        <form
          id="repo-search-form"
          onSubmit={handleSubmit}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <input
              id="repo-url-input"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. https://github.com/facebook/react"
              className="w-full rounded-lg border border-gray-700 bg-gray-800/60 pl-10 pr-4 py-3 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
          </div>
          <button
            id="repo-submit-btn"
            type="submit"
            disabled={isLoading}
            className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition cursor-pointer"
          >
            {isLoading ? 'Loading…' : 'Trace'}
          </button>
        </form>

        {/* ──────────── Error State ──────────── */}
        {error && (
          <div
            id="error-message"
            className="mt-6 rounded-lg border border-red-800 bg-red-900/30 p-4 text-sm text-red-300"
          >
            ⚠️ {error}
          </div>
        )}

        {/* ──────────── Mock-mode badge ──────────── */}
        {data && !isLoading && import.meta.env.VITE_USE_LIVE_API !== 'true' && (
          <div className="mt-6 mb-2 flex items-center gap-2">
            <span className="rounded-full bg-yellow-800/40 px-3 py-1 text-xs font-medium text-yellow-300">
              MOCK DATA
            </span>
            <span className="text-xs text-gray-500">
              {data.length} commit{data.length !== 1 ? 's' : ''} loaded
            </span>
          </div>
        )}

        {/* ──────────── Timeline (with AI Story) ──────────── */}
        <div className="mt-6">
          <Timeline
            commits={data}
            isLoading={isLoading}
            aiStory={aiStory}
            isAILoading={isAILoading}
            aiError={aiError}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
