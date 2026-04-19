/* ============================================================
 * GitTrace — AISummaryCard Component (Redesigned)
 * ------------------------------------------------------------
 * Handles three states:
 *  1. AI unavailable → slim amber banner with dismiss button
 *  2. AI story available → violet-bordered story card
 *  3. Fallback → auto-generated statistical summary
 *
 * No more "Generate AI Story" CTA button. AI story sits
 * between the metadata bar and the sparkline/commit list.
 * ============================================================ */

import { useState } from 'react';
import { generateStatisticalSummary } from '../../utils/analytics';

export default function AISummaryCard({
  story,
  isLoading,
  error,
  commits,
  repoInfo,
  onGenerateStory,
  hasCommits = false,
}) {
  const [dismissed, setDismissed] = useState(false);

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="ai-story-card" style={{ margin: '12px 20px' }}>
        <div className="ai-story-card__header">
          <span className="ai-story-card__icon">✦</span>
          <span className="ai-story-card__title">Repository story</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="skeleton skeleton-line" style={{ width: '85%', height: '14px' }} />
          <div className="skeleton skeleton-line" style={{ width: '70%', height: '14px' }} />
          <div className="skeleton skeleton-line" style={{ width: '60%', height: '14px' }} />
        </div>
      </div>
    );
  }

  // ── AI Story available ──
  if (story && !story.error) {
    return (
      <div className="ai-story-card" style={{ margin: '12px 20px' }}>
        <div className="ai-story-card__header">
          <span className="ai-story-card__icon">✦</span>
          <span className="ai-story-card__title">Repository story</span>
          {story.vibe && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '11px',
                color: 'var(--accent-violet)',
                background: 'rgba(124, 106, 247, 0.1)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {story.vibe}
            </span>
          )}
        </div>
        <div className="ai-story-card__body">
          {story.summary}
        </div>
      </div>
    );
  }

  // ── Error / No API key: Show banner + statistical fallback ──
  if (error && !dismissed) {
    const fallbackSummary = hasCommits && commits && repoInfo
      ? generateStatisticalSummary(commits, repoInfo.owner, repoInfo.repo)
      : '';

    return (
      <div style={{ margin: '12px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Slim amber banner */}
        <div className="ai-banner">
          <span className="ai-banner__icon">⚠</span>
          <span className="ai-banner__text">
            AI narrative unavailable —{' '}
            <span className="ai-banner__key">configure VITE_GEMINI_API_KEY</span>
          </span>
          <button
            className="ai-banner__dismiss"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>

        {/* Statistical fallback */}
        {fallbackSummary && (
          <div className="ai-story-card" style={{ margin: 0 }}>
            <div className="ai-story-card__header">
              <span className="ai-story-card__icon" style={{ color: 'var(--text-secondary)' }}>✦</span>
              <span className="ai-story-card__title">Repository story</span>
              <span className="ai-story-card__label">Generated from commit data</span>
            </div>
            <div className="ai-story-card__body">
              {fallbackSummary}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── No story, no error, has commits: show generate button (subtle) ──
  if (hasCommits && !story && !error && onGenerateStory) {
    return (
      <div style={{ margin: '12px 20px' }}>
        <button
          className="ai-story-card"
          onClick={onGenerateStory}
          style={{
            margin: 0,
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'border-color var(--transition-fast)',
          }}
        >
          <div className="ai-story-card__header">
            <span className="ai-story-card__icon">✦</span>
            <span className="ai-story-card__title">Generate AI story</span>
            <span className="ai-story-card__label" style={{ color: 'var(--accent-violet)' }}>
              Powered by Gemini
            </span>
          </div>
          <div className="ai-story-card__body" style={{ fontSize: '13px' }}>
            Let AI summarize the recent commit activity into a human-readable sprint update.
          </div>
        </button>
      </div>
    );
  }

  // ── Nothing to show ──
  return null;
}
