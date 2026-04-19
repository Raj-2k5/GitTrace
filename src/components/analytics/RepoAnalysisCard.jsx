/* ============================================================
 * GitTrace — RepoAnalysisCard Component
 * ------------------------------------------------------------
 * Deep structured repository analysis replacing the generic
 * AI story card. Shows:
 *  • Project description (AI or rule-based)
 *  • Timeline bar (first → last commit)
 *  • Feature evolution mini-timeline
 *  • Volatility insight
 *  • Activity status badge
 * ============================================================ */

import { useState, useMemo } from 'react';
import {
  extractFeatures,
  computeActivityStatus,
  computeDuration,
  buildRuleBasedAnalysis,
  processHotspotData,
  processContributorData,
  detectPrimaryLanguage,
  formatNumber,
} from '../../utils/analytics';
import { generateDeepAnalysis } from '../../api/gemini';

export default function RepoAnalysisCard({
  commits,
  repoInfo,
  hotspotData,
}) {
  const [aiData, setAiData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  // Rule-based fallback — always available
  const ruleData = useMemo(() => {
    if (!commits || commits.length === 0 || !repoInfo) return null;
    return buildRuleBasedAnalysis(commits, repoInfo.owner, repoInfo.repo, hotspotData || []);
  }, [commits, repoInfo, hotspotData]);

  // Duration data
  const durationInfo = useMemo(() => computeDuration(commits), [commits]);
  const statusInfo = useMemo(() => computeActivityStatus(commits), [commits]);
  const features = useMemo(() => {
    if (aiData?.features && aiData.features.length > 0) return aiData.features;
    return ruleData?.features || [];
  }, [aiData, ruleData]);

  // Trigger AI analysis
  const handleGenerateAI = async () => {
    if (!commits || !repoInfo) return;
    setAiLoading(true);
    setAiError(false);

    const contributors = processContributorData(commits);
    const lang = detectPrimaryLanguage(commits);

    const result = await generateDeepAnalysis(
      commits,
      repoInfo.owner,
      repoInfo.repo,
      contributors,
      lang?.name || '',
      hotspotData || []
    );

    if (result?.error) {
      setAiError(true);
      setAiLoading(false);
    } else {
      setAiData(result);
      setAiLoading(false);
    }
  };

  if (!commits || commits.length === 0 || !ruleData) return null;

  const data = aiData || ruleData;
  const isAI = !!aiData && !aiData.isRuleBased;
  const visibleFeatures = showAllFeatures ? features : features.slice(0, 6);

  return (
    <div className="analysis-card">
      {/* ── Header ── */}
      <div className="analysis-card__header">
        <span className="analysis-card__icon">✦</span>
        <span className="analysis-card__title">Repository Analysis</span>
        <span className={`analysis-card__badge ${isAI ? 'analysis-card__badge--ai' : 'analysis-card__badge--rule'}`}>
          {isAI ? 'AI-powered' : 'From commit data'}
        </span>
      </div>

      {/* ── AI Loading ── */}
      {aiLoading && (
        <div className="analysis-card__loading">
          <div className="skeleton skeleton-line" style={{ width: '85%', height: '13px' }} />
          <div className="skeleton skeleton-line" style={{ width: '70%', height: '13px' }} />
          <div className="skeleton skeleton-line" style={{ width: '60%', height: '13px' }} />
        </div>
      )}

      {/* ── Project Description ── */}
      {data.project && !aiLoading && (
        <div className="analysis-card__section">
          <span className="analysis-card__label">Project</span>
          <p className="analysis-card__prose">{data.project}</p>
        </div>
      )}

      {/* ── Goal (AI only) ── */}
      {data.goal && !aiLoading && (
        <div className="analysis-card__section">
          <span className="analysis-card__label">Goal</span>
          <p className="analysis-card__prose">{data.goal}</p>
        </div>
      )}

      {/* ── Timeline Bar ── */}
      {durationInfo.duration && !aiLoading && (
        <div className="analysis-card__section">
          <span className="analysis-card__label">Running for</span>
          <div className="analysis-card__duration-text">
            {data.timeline_duration || durationInfo.duration}
          </div>
          <div className="timeline-bar">
            <div className="timeline-bar__fill" />
          </div>
          <div className="timeline-bar__dates">
            <span>{durationInfo.firstDate}</span>
            <span>{durationInfo.lastDate}</span>
          </div>
        </div>
      )}

      {/* ── Feature Evolution ── */}
      {features.length > 0 && !aiLoading && (
        <div className="analysis-card__section">
          <span className="analysis-card__label">Features added</span>
          <div className="feature-timeline">
            {visibleFeatures.map((f, i) => (
              <div key={i} className="feature-timeline__entry">
                <div
                  className="feature-timeline__dot"
                  style={{ background: f.heat || 'var(--accent-violet)' }}
                />
                <span className="feature-timeline__date">{f.date}</span>
                <span className="feature-timeline__name">{f.name}</span>
              </div>
            ))}
          </div>
          {features.length > 6 && !showAllFeatures && (
            <button
              className="analysis-card__show-more"
              onClick={() => setShowAllFeatures(true)}
            >
              + {features.length - 6} more
            </button>
          )}
        </div>
      )}

      {/* ── Biggest Change (AI only) ── */}
      {data.biggest_change && !aiLoading && (
        <div className="analysis-card__section">
          <span className="analysis-card__label">Biggest change</span>
          <p className="analysis-card__prose">{data.biggest_change}</p>
        </div>
      )}

      {/* ── Volatility Insight ── */}
      {data.volatility && !aiLoading && (
        <div className="analysis-card__section">
          <span className="analysis-card__label">Hottest area</span>
          <p className="analysis-card__prose analysis-card__volatility">{data.volatility}</p>
        </div>
      )}

      {/* ── Status Badge ── */}
      {!aiLoading && (
        <div className={`status-badge ${statusInfo.colorClass}`}>
          <span>{statusInfo.icon}</span>
          <span>
            {statusInfo.status}
            {statusInfo.daysSince >= 0 && (
              <> — last commit {statusInfo.daysSince === 0 ? 'today' :
                statusInfo.daysSince === 1 ? 'yesterday' :
                `${statusInfo.daysSince} days ago`}</>
            )}
          </span>
        </div>
      )}

      {/* ── Generate AI Button (when not yet generated) ── */}
      {!aiData && !aiLoading && !aiError && (
        <button className="analysis-card__ai-btn" onClick={handleGenerateAI}>
          <span>✦</span> Generate AI Analysis
          <span className="analysis-card__ai-btn-sub">Powered by Gemini</span>
        </button>
      )}
    </div>
  );
}
