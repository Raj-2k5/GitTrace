/* ============================================================
 * GitTrace — Compare View
 * ------------------------------------------------------------
 * Two-column comparison layout with center divider showing
 * side-by-side repo analysis: metadata, heatmaps, timelines.
 * ============================================================ */

import { useMemo, useState } from 'react';
import Timeline from '../timeline/Timeline';
import HotspotMap from '../analytics/HotspotMap';
import ComparisonSummaryPanel from './ComparisonSummaryPanel';
import { processHotspotData } from '../../utils/analytics';

function CompareColumn({ data, repoInfo, isLoading, label, isRight }) {
  const hotspotData = useMemo(() => processHotspotData(data), [data]);
  const hasData = data && data.length > 0 && !isLoading;

  return (
    <div className={`compare-column ${isRight ? 'compare-column--right' : 'compare-column--left'}`}>
      <div className={`compare-column__header ${isRight ? 'compare-column__header--right' : 'compare-column__header--left'}`}>
        <span className="compare-column__repo">
          {repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : label}
        </span>
      </div>

      {isLoading && (
        <div style={{ padding: '20px' }}>
          <div className="skeleton skeleton-line" style={{ width: '80%', height: '14px', marginBottom: '10px' }} />
          <div className="skeleton skeleton-treemap" />
        </div>
      )}

      {hasData && (
        <>
          <div className="compare-column__heatmap">
            <HotspotMap data={hotspotData} commits={data} repoInfo={repoInfo} />
          </div>
          <div className="compare-column__timeline">
            <Timeline commits={data} isLoading={false} repoInfo={repoInfo} />
          </div>
        </>
      )}
    </div>
  );
}

export default function CompareView({
  leftData, leftRepoInfo, leftLoading,
  rightData, rightRepoInfo, rightLoading,
}) {
  const [syncScroll, setSyncScroll] = useState(false);

  const leftHas = leftData && leftData.length > 0 && !leftLoading;
  const rightHas = rightData && rightData.length > 0 && !rightLoading;

  return (
    <div className="compare-wrapper" style={{ width: '100%' }}>
      {/* ── Comparison Intelligence Panel ── */}
      {leftHas && rightHas && (
        <ComparisonSummaryPanel 
           leftData={leftData} rightData={rightData}
           leftRepoInfo={leftRepoInfo} rightRepoInfo={rightRepoInfo}
        />
      )}

      {/* ── Side-by-Side Detail Columns ── */}
      <div className="compare-view" id="compare-view">
        <CompareColumn
          data={leftData}
          repoInfo={leftRepoInfo}
          isLoading={leftLoading}
          label="Original repo"
          isRight={false}
        />

        <div className="compare-divider">
          <label className="compare-divider__sync">
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={e => setSyncScroll(e.target.checked)}
            />
            <span>Sync scroll</span>
          </label>
        </div>

        <CompareColumn
          data={rightData}
          repoInfo={rightRepoInfo}
          isLoading={rightLoading}
          label="Comparison repo"
          isRight={true}
        />
      </div>
    </div>
  );
}
