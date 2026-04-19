/* ============================================================
 * GitTrace — Watch Button
 * ------------------------------------------------------------
 * Ghost button with bell icon. Toggles watched state.
 * ============================================================ */

import { useWatch } from '../../contexts/WatchContext';

export default function WatchButton({ owner, repo }) {
  const { isWatching, addWatch, removeWatch } = useWatch();

  if (!owner || !repo) return null;

  const watching = isWatching(owner, repo);

  const handleClick = () => {
    if (watching) {
      removeWatch(owner, repo);
    } else {
      addWatch(owner, repo);
    }
  };

  return (
    <button
      data-tooltip="Watch this repository"
      data-tooltip-desc="Will show updates in your dashboard dropdown."
      className={`watch-btn${watching ? ' watch-btn--active' : ''}`}
      onClick={handleClick}
      id="watch-btn"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill={watching ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <span>{watching ? 'Watching' : 'Watch'}</span>
    </button>
  );
}
