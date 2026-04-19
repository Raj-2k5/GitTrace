/* ============================================================
 * GitTrace — Gemini AI Service (Deep Analysis)
 * ------------------------------------------------------------
 * Integrates with the Google Gemini API via @google/genai SDK
 * to generate structured repository analysis summaries.
 *
 * USAGE:
 *   import { generateDeepAnalysis } from './api/gemini';
 *   const analysis = await generateDeepAnalysis(commits, owner, repo, contributors, language, hotspots);
 * ============================================================ */

import { GoogleGenAI } from '@google/genai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

let _client = null;

const getClient = () => {
  if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
    return null;
  }
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: API_KEY });
  }
  return _client;
};

/**
 * Build the deep analysis prompt from actual commit data.
 */
function buildDeepPrompt(commits, owner, repo, contributors, language, hotspots) {
  const sorted = [...commits].sort(
    (a, b) => new Date(a.author?.date) - new Date(b.author?.date)
  );
  const firstDate = sorted[0]?.author?.date || 'unknown';
  const lastDate = sorted[sorted.length - 1]?.author?.date || 'unknown';

  const contribList = contributors
    .slice(0, 5)
    .map(c => `${c.name} (${c.commits} commits, +${c.additions} -${c.deletions})`)
    .join('\n  ');

  const commitLines = sorted
    .map(c => {
      const adds = c.stats?.additions ?? 0;
      const dels = c.stats?.deletions ?? 0;
      const date = c.author?.date?.slice(0, 10) || '?';
      const author = c.author?.name || 'Unknown';
      const msg = c.message?.split('\n')[0] || '';
      return `${date} | ${author} | ${msg} | +${adds} -${dels}`;
    })
    .join('\n');

  const hotspotLines = hotspots
    .slice(0, 5)
    .map(h => `${h.name}: ${h.size} changes`)
    .join('\n  ');

  return `You are analyzing a GitHub repository. Here is the raw commit data:

Repository: ${owner}/${repo}
Total commits analyzed: ${commits.length}
Date range: ${firstDate} to ${lastDate}
Contributors:
  ${contribList}
Primary language: ${language || 'Unknown'}

Commits (chronological, oldest first):
${commitLines}

File change hotspots:
  ${hotspotLines}

Based ONLY on this data, write a structured repository summary. Return a JSON object with these exact keys:

{
  "project": "One sentence describing what this project is, specific, no fluff.",
  "goal": "One to two sentences on the problem it solves or the value it provides.",
  "timeline_duration": "Human readable duration like '3 weeks 2 days'",
  "activity_pattern": "One sentence: burst of activity, steady, stale, etc.",
  "features": [
    { "date": "YYYY-MM-DD", "name": "Specific feature name extracted from commit message" }
  ],
  "biggest_change": "Describe the single largest commit by lines changed, what it did.",
  "volatility": "Which files change most and what that implies about technical debt.",
  "status": "Active|Slowing|Stale",
  "days_since_last": 2
}

RULES:
- Extract REAL feature names from commit messages (look for feat:, add, implement, create, initial keywords)
- Maximum 6 features in the list, pick the most important ones
- Be specific. Use exact dates, filenames, and feature names from the data
- Do not write marketing language. Do not pad with generic observations
- Maximum 250 words total across all fields
- Return ONLY valid JSON, no markdown`;
}

/**
 * Generate a deep structured analysis via Gemini.
 */
export async function generateDeepAnalysis(commits, owner, repo, contributors, language, hotspots) {
  if (!commits || commits.length === 0) {
    return { error: true, message: 'No commits to analyze.' };
  }

  const client = getClient();

  if (!client) {
    return {
      error: true,
      message: 'Gemini API key not configured.',
    };
  }

  try {
    const prompt = buildDeepPrompt(commits, owner, repo, contributors, language, hotspots);

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text);

    if (!parsed.project) {
      return { error: true, message: 'AI returned incomplete response.' };
    }

    return parsed;
  } catch (err) {
    console.error('[GitTrace] Gemini API error:', err);
    return {
      error: true,
      message: err.message || 'Failed to generate AI analysis.',
    };
  }
}

/** Legacy export for backward compat */
export async function generateCommitSummary(commitsArray) {
  return generateDeepAnalysis(commitsArray, '', '', [], '', []);
}

/**
 * Generate a comparison verdict for two repositories based on analytical metrics.
 */
export async function generateComparisonVerdict(repoA, repoB) {
  const client = getClient();
  if (!client) {
    return { error: true, message: 'Gemini API key not configured.' };
  }

  const formatRepoData = (repo) => `
  Repo: ${repo.owner}/${repo.name}
  - Commits: ${repo.commits}, Contributors: ${repo.contributors}, Velocity: ${repo.velocity}/week
  - Avg commit size: ${repo.avgCommitSize} lines, Churn rate: ${repo.churnRate}%
  - File concentration: ${repo.fileConcentration}% in top 3 files
  - Most changed files: ${repo.topFiles.join(', ')}
  - Language: ${repo.language}
  - Age: ${repo.age} days, Last commit: ${repo.daysSinceLast} days ago`;

  const prompt = `Compare these two GitHub repositories based on their commit data:
  
  Repo A: ${formatRepoData(repoA)}
  
  Repo B: ${formatRepoData(repoB)}
  
  Answer these questions specifically using only the data above:
  
  1. Which repo shows healthier development practices and why? (cite specific metrics)
  2. What does each repo's commit pattern suggest about its development style — collaborative vs solo, iterative vs big-bang, maintained vs abandoned?
  3. What is the single biggest red flag in each repo if any?
  4. If someone is evaluating these repos for production use or contribution, what is your one-sentence recommendation?
  
  Be specific. Reference exact numbers. No generic advice.
  Maximum 120 words total. Use plain sentences, no bullet points.`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return { error: false, verdict: response.text };
  } catch (err) {
    console.error('[GitTrace] Gemini API error:', err);
    return { error: true, message: err.message || 'Failed to generate comparison verdict.' };
  }
}

