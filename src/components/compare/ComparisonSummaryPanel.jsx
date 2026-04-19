import { useState, useEffect, useMemo } from 'react';
import { generateComparisonVerdict } from '../../api/gemini';
import { processHotspotData, processContributorData } from '../../utils/analytics';

/**
 * Derives the necessary metrics for a single repo
 */
function deriveMetrics(data, repoInfo) {
  if (!data || data.length === 0) return null;

  const commits = data.length;
  const contributors = processContributorData(data).length;
  
  const sorted = [...data].sort((a, b) => new Date(a.author?.date) - new Date(b.author?.date));
  const firstDate = new Date(sorted[0].author?.date);
  const lastDate = new Date(sorted[sorted.length - 1].author?.date);
  const now = new Date();
  
  const msPerDay = 1000 * 60 * 60 * 24;
  const msPerWeek = msPerDay * 7;
  
  const age = Math.max(0, Math.floor((lastDate - firstDate) / msPerDay)) || 1;
  const daysSinceLast = Math.max(0, Math.floor((now - lastDate) / msPerDay));
  
  const weeksBetween = Math.max(1, (lastDate - firstDate) / msPerWeek);
  const velocity = +(commits / weeksBetween).toFixed(2);

  let totalAdds = 0;
  let totalDels = 0;
  
  data.forEach(c => {
    totalAdds += (c.stats?.additions ?? 0);
    totalDels += (c.stats?.deletions ?? 0);
  });
  
  const totalChanges = totalAdds + totalDels;
  const avgCommitSize = commits > 0 ? Math.round(totalChanges / commits) : 0;
  const churnRate = totalChanges > 0 ? Math.round((totalDels / totalChanges) * 100) : 0;
  
  const hotspots = processHotspotData(data);
  const top3Changes = hotspots.slice(0, 3).reduce((sum, h) => sum + h.size, 0);
  const fileConcentration = totalChanges > 0 ? Math.round((top3Changes / totalChanges) * 100) : 0;
  
  return {
    owner: repoInfo?.owner || '',
    name: repoInfo?.repo || '',
    commits,
    contributors,
    velocity,
    avgCommitSize,
    churnRate,
    fileConcentration,
    topFiles: hotspots.slice(0, 3).map(h => h.name.split('/').pop()),
    hotspots: hotspots.slice(0, 20),
    language: 'Unknown',
    age,
    daysSinceLast,
    firstDate,
    lastDate,
    rawCommits: sorted
  };
}

function MetricRow({ label, a, b, higherIsWinner = true, invertedFlag = false, interpretation = null }) {
  const isAWinner = higherIsWinner ? a > b : a < b;
  const isBWinner = higherIsWinner ? b > a : b < a;
  
  let flagA = false;
  let flagB = false;
  
  if (invertedFlag && label.includes('size')) {
    flagA = a > 1000;
    flagB = b > 1000;
  }
  
  return (
    <tr className="compare-table__row">
      <td className="compare-table__cell compare-table__cell--label">{label}</td>
      <td className={`compare-table__cell ${isAWinner ? 'compare-table__cell--winner' : ''} ${flagA ? 'compare-table__cell--flagged' : ''}`}>
        {flagA && <span className="flag-warn">⚠ </span>}
        {a} {isAWinner && <span className="winner-check">✓</span>}
      </td>
      <td className={`compare-table__cell ${isBWinner ? 'compare-table__cell--winner' : ''} ${flagB ? 'compare-table__cell--flagged' : ''}`}>
        {flagB && <span className="flag-warn">⚠ </span>}
        {b} {isBWinner && <span className="winner-check">✓</span>}
      </td>
      {interpretation && <td className="compare-table__cell compare-table__cell--interp">{interpretation}</td>}
    </tr>
  );
}

function SparklineChart({ metricsA, metricsB }) {
  const w = 800;
  const h = 80;
  
  const minDate = Math.min(metricsA.firstDate.getTime(), metricsB.firstDate.getTime());
  const maxDate = Math.max(metricsA.lastDate.getTime(), metricsB.lastDate.getTime());
  
  const getBuckets = (commits) => {
    const buckets = new Array(20).fill(0);
    if (minDate === maxDate) return buckets;
    commits.forEach(c => {
      const d = new Date(c.author?.date).getTime();
      const pct = (d - minDate) / (maxDate - minDate);
      const idx = Math.min(19, Math.floor(pct * 20));
      buckets[idx]++;
    });
    return buckets;
  };

  const bucketsA = getBuckets(metricsA.rawCommits);
  const bucketsB = getBuckets(metricsB.rawCommits);
  
  const maxVal = Math.max(...bucketsA, ...bucketsB, 1);
  
  const toPoints = (buckets) => buckets.map((val, i) => {
    const x = (i / 19) * w;
    const y = h - ((val / maxVal) * h);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="velocity-chart">
       <svg width="100%" height="80" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
         <polyline points={toPoints(bucketsA)} fill="none" stroke="#4FEFBC" strokeWidth="2" strokeLinejoin="round" />
         <polyline points={toPoints(bucketsB)} fill="none" stroke="#7C6AF7" strokeWidth="2" strokeLinejoin="round" />
       </svg>
    </div>
  );
}

export default function ComparisonSummaryPanel({ leftData, rightData, leftRepoInfo, rightRepoInfo }) {
  const [verdict, setVerdict] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  
  const { mA, mB } = useMemo(() => {
    return {
      mA: deriveMetrics(leftData, leftRepoInfo),
      mB: deriveMetrics(rightData, rightRepoInfo)
    };
  }, [leftData, rightData, leftRepoInfo, rightRepoInfo]);

  useEffect(() => {
    if (!mA || !mB) return;
    let isCancelled = false;
    
    async function fetchVerdict() {
      setLoadingAI(true);
      const result = await generateComparisonVerdict(mA, mB);
      if (!isCancelled && !result.error) {
        setVerdict(result.verdict);
      }
      setLoadingAI(false);
    }
    
    fetchVerdict();
    return () => { isCancelled = true; };
  }, [mA, mB]);

  if (!mA || !mB) return null;

  // Shared hotspots logic
  const sharedHotspots = mA.hotspots.filter(a => mB.hotspots.find(b => b.name === a.name));

  const getChurnInterp = (churn) => {
    if (churn > 40) return 'High refactoring activity';
    if (churn >= 10) return 'Healthy churn';
    return 'Mostly additive — low cleanup';
  };

  const getConcentrationInterp = (conc) => {
    if (conc > 60) return '⚠ High concentration — technical debt risk';
    if (conc >= 30) return 'Moderate concentration';
    return 'Well-distributed changes';
  };

  return (
    <div className="comparison-summary">
      <div className="comparison-summary__header">
        <span className="comparison-summary__title">⚡ Comparison Analysis</span>
        <span className="ai-badge">AI-powered</span>
      </div>

      <div className="comparison-summary__grid">
        <div className="comparison-summary__table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th className="compare-table__th">Metric</th>
                <th className="compare-table__th" style={{ color: '#4FEFBC' }}>{mA.owner}/{mA.name}</th>
                <th className="compare-table__th" style={{ color: '#7C6AF7' }}>{mB.owner}/{mB.name}</th>
                <th className="compare-table__th">Interpretation</th>
              </tr>
            </thead>
            <tbody>
              <MetricRow label="Total commits" a={mA.commits} b={mB.commits} />
              <MetricRow label="Commit velocity" a={`${mA.velocity}/wk`} b={`${mB.velocity}/wk`} />
              <MetricRow label="Contributors" a={mA.contributors} b={mB.contributors} />
              <MetricRow label="Avg commit size" a={mA.avgCommitSize} b={mB.avgCommitSize} higherIsWinner={false} invertedFlag={true} />
              <MetricRow label="Code churn rate" a={`${mA.churnRate}%`} b={`${mB.churnRate}%`} higherIsWinner={false} interpretation={
                 <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
                   <span style={{color: mA.churnRate > 40 ? '#FBBF24' : 'inherit'}}>{getChurnInterp(mA.churnRate)}</span>
                   <span style={{color: mB.churnRate > 40 ? '#FBBF24' : 'inherit'}}>{getChurnInterp(mB.churnRate)}</span>
                 </div>
              } />
              <MetricRow label="File concentration" a={`${mA.fileConcentration}%`} b={`${mB.fileConcentration}%`} higherIsWinner={false} interpretation={
                 <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
                   <span style={{color: mA.fileConcentration > 60 ? '#FBBF24' : 'inherit'}}>{getConcentrationInterp(mA.fileConcentration)}</span>
                   <span style={{color: mB.fileConcentration > 60 ? '#FBBF24' : 'inherit'}}>{getConcentrationInterp(mB.fileConcentration)}</span>
                 </div>
              } />
              <MetricRow label="Project age" a={`${mA.age} days`} b={`${mB.age} days`} />
            </tbody>
          </table>
        </div>

        <div className="comparison-summary__verdict">
          <div className="verdict-label">AI Verdict</div>
          {loadingAI ? (
            <div className="skeleton skeleton-line" style={{ height: '80px', marginTop: '12px' }} />
          ) : (
            <div className="verdict-content">{verdict || 'AI verdict could not be generated.'}</div>
          )}
        </div>
      </div>

      <div className="comparison-summary__hotspots">
        {sharedHotspots.length > 0 ? (
          <>
            <div className="hotspots-label">📁 Shared hotspot files</div>
            {sharedHotspots.slice(0,5).map(f => {
               const bMatch = mB.hotspots.find(b => b.name === f.name);
               return <div key={f.name} className="hotspot-item">{f.name.split('/').pop()} — A: {f.size} changes · B: {bMatch.size} changes</div>;
            })}
          </>
        ) : (
          <>
            <div className="hotspots-label">No overlapping files — these are independent codebases</div>
            <div className="hotspot-item">Repo A pressure point: {mA.topFiles[0]} ({mA.hotspots[0]?.size} changes)</div>
            <div className="hotspot-item">Repo B pressure point: {mB.topFiles[0]} ({mB.hotspots[0]?.size} changes)</div>
          </>
        )}
      </div>

      <div className="comparison-summary__chart">
        <SparklineChart metricsA={mA} metricsB={mB} />
        <div className="chart-legend">
           <span style={{color: '#4FEFBC'}}>— {mA.owner}/{mA.name}</span>
           <span style={{color: '#7C6AF7'}}>— {mB.owner}/{mB.name}</span>
        </div>
      </div>

    </div>
  );
}
