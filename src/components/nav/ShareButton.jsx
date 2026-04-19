/* ============================================================
 * GitTrace — Share Button
 * ------------------------------------------------------------
 * Ghost button in metadata bar. Copies current URL to clipboard.
 * Uses Web Share API on mobile if available.
 * ============================================================ */

import { useState, useCallback } from 'react';

export default function ShareButton({ repoInfo }) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const title = repoInfo
      ? `${repoInfo.owner}/${repoInfo.repo} — GitTrace`
      : 'GitTrace';

    // Try Web Share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User cancelled or API unavailable — fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [repoInfo]);

  return (
    <button
      id="share-btn"
      data-tooltip="Copy link"
      data-tooltip-desc="Share this analysis with others."
      className={`share-btn${copied ? ' share-btn--copied' : ''}`}
      onClick={handleShare}
    >
      {copied ? '✓ Copied!' : 'Share ↗'}
    </button>
  );
}
