/* ============================================================
 * GitTrace — Watch Context
 * ------------------------------------------------------------
 * Manages watched repos in localStorage. Polls for new commits
 * every 30 minutes. Fires events on new activity.
 * ============================================================ */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { githubFetch } from '../utils/githubFetch';

const WatchContext = createContext(null);
const STORAGE_KEY = 'gittrace_watched';
const POLL_INTERVAL = 30 * 60 * 1000; // 30 minutes

function loadWatched() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWatched(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* full */ }
}

export function WatchProvider({ children }) {
  const [watchedRepos, setWatchedRepos] = useState(() => loadWatched());
  const [notifications, setNotifications] = useState([]);
  const pollRef = useRef(null);

  // Sync to localStorage
  useEffect(() => {
    saveWatched(watchedRepos);
  }, [watchedRepos]);

  const addWatch = useCallback((owner, repo) => {
    setWatchedRepos(prev => {
      const key = `${owner}/${repo}`.toLowerCase();
      if (prev.some(r => `${r.owner}/${r.repo}`.toLowerCase() === key)) return prev;
      return [...prev, {
        owner,
        repo,
        lastCheckedSha: null,
        addedAt: new Date().toISOString(),
        newCommits: 0,
      }];
    });
  }, []);

  const removeWatch = useCallback((owner, repo) => {
    const key = `${owner}/${repo}`.toLowerCase();
    setWatchedRepos(prev =>
      prev.filter(r => `${r.owner}/${r.repo}`.toLowerCase() !== key)
    );
  }, []);

  const isWatching = useCallback((owner, repo) => {
    const key = `${owner}/${repo}`.toLowerCase();
    return watchedRepos.some(r => `${r.owner}/${r.repo}`.toLowerCase() === key);
  }, [watchedRepos]);

  const clearNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Poll for new commits
  const checkForUpdates = useCallback(async () => {
    if (watchedRepos.length === 0) return;

    const updated = [...watchedRepos];
    let hasChanges = false;

    for (let i = 0; i < updated.length; i++) {
      const r = updated[i];
      try {
        const res = await githubFetch(
          `https://api.github.com/repos/${r.owner}/${r.repo}/commits?per_page=1`
        );
        if (!res || !res.ok) continue;
        const data = await res.json();
        const latestSha = data[0]?.sha;

        if (latestSha && r.lastCheckedSha && latestSha !== r.lastCheckedSha) {
          // New activity!
          updated[i] = { ...r, lastCheckedSha: latestSha, newCommits: (r.newCommits || 0) + 1 };
          hasChanges = true;

          const notifId = `${r.owner}/${r.repo}-${Date.now()}`;
          setNotifications(prev => [...prev, {
            id: notifId,
            owner: r.owner,
            repo: r.repo,
            message: `New activity in ${r.owner}/${r.repo}`,
            timestamp: Date.now(),
          }]);

          // Browser notification if permission granted
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification(`GitTrace — ${r.owner}/${r.repo}`, {
                body: 'New commits detected since your last check.',
                icon: '/favicon.svg',
              });
            } catch { /* ignore */ }
          }
        } else if (latestSha && !r.lastCheckedSha) {
          // First check — just record the SHA
          updated[i] = { ...r, lastCheckedSha: latestSha };
          hasChanges = true;
        }
      } catch { /* skip this repo */ }
    }

    if (hasChanges) {
      setWatchedRepos(updated);
    }
  }, [watchedRepos]);

  // Start polling
  useEffect(() => {
    if (watchedRepos.length === 0) return;

    // Check immediately on first watch
    checkForUpdates();

    pollRef.current = setInterval(checkForUpdates, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [watchedRepos.length, checkForUpdates]);

  // Request notification permission after first watch
  useEffect(() => {
    if (watchedRepos.length === 1 && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [watchedRepos.length]);

  // Update document title with notification count
  useEffect(() => {
    const count = notifications.length;
    const base = 'GitTrace';
    document.title = count > 0 ? `(${count}) ${base}` : base;
  }, [notifications.length]);

  const markSeen = useCallback((owner, repo) => {
    const key = `${owner}/${repo}`.toLowerCase();
    setWatchedRepos(prev =>
      prev.map(r =>
        `${r.owner}/${r.repo}`.toLowerCase() === key
          ? { ...r, newCommits: 0 }
          : r
      )
    );
  }, []);

  const value = {
    watchedRepos,
    notifications,
    addWatch,
    removeWatch,
    isWatching,
    markSeen,
    clearNotification,
  };

  return (
    <WatchContext.Provider value={value}>
      {children}
    </WatchContext.Provider>
  );
}

export function useWatch() {
  const ctx = useContext(WatchContext);
  if (!ctx) throw new Error('useWatch must be used inside <WatchProvider>');
  return ctx;
}
