/* ============================================================
 * GitTrace — Gemini AI Service
 * ------------------------------------------------------------
 * Integrates with the Google Gemini API to generate "Progress
 * Stories" — human-readable sprint summaries derived from raw
 * commit messages.
 *
 * FEATURES:
 *  1. Uses the `gemini-2.5-flash` model for fast, cost-effective
 *     text generation.
 *  2. Enforces structured JSON output via `responseMimeType`.
 *  3. Graceful fallback if the API key is missing or the call
 *     fails — the app continues to work without AI insights.
 *
 * USAGE:
 *   import { generateCommitSummary } from './api/gemini';
 *   const story = await generateCommitSummary(commits);
 *   // → { title, summary, vibe } or { error: true, message }
 * ============================================================ */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ------------------------------------------------------------
// 1. Client Initialization
// ------------------------------------------------------------

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

/**
 * Lazily initialize the Gemini client.  Returns null if no API
 * key is configured — the caller should treat this as "AI
 * features unavailable" rather than an error.
 */
const getModel = () => {
  if (!API_KEY) {
    console.warn(
      '[GitTrace] No VITE_GEMINI_API_KEY found. AI Progress Stories are disabled.',
    );
    return null;
  }

  const genAI = new GoogleGenerativeAI(API_KEY);

  // Use gemini-2.5-flash for speed and cost efficiency
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    // Enforce structured JSON output so we can parse reliably
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });
};

// ------------------------------------------------------------
// 2. Prompt Construction
// ------------------------------------------------------------

/**
 * Build the system prompt that instructs Gemini to behave as a
 * Tech Lead and return a structured JSON summary.
 *
 * @param {Array} commits - Array of commit objects.
 * @returns {string} - The full prompt string.
 */
function buildPrompt(commits) {
  // Extract only the messages + authors to keep the prompt lean
  const commitList = commits
    .map(
      (c, i) =>
        `${i + 1}. [${c.author?.name ?? 'Unknown'}] ${c.message.split('\n')[0]}`,
    )
    .join('\n');

  return `You are a senior Tech Lead reviewing a batch of recent Git commits for a project.

Analyze the following commit messages and produce a concise "Progress Story" — a sprint-style summary that communicates what the team accomplished.

COMMITS:
${commitList}

INSTRUCTIONS:
- "title": A catchy, short title for this batch of work (max 8 words). Be creative but professional. Examples: "The Performance Push", "Dark Mode & Beyond", "Bug Squash Marathon".
- "summary": A 2-3 sentence human-readable summary of what was achieved. Focus on business/project value and developer impact, not individual commits. Write in past tense.
- "vibe": A single keyword that captures the overall mood of this batch. Pick ONE from: "Feature Shipping", "Bug Squashing", "Refactoring", "Performance", "Testing", "Documentation", "Maintenance", "Infrastructure", "UI Polish", "Security".

Return ONLY a valid JSON object with exactly these three keys: "title", "summary", "vibe".`;
}

// ------------------------------------------------------------
// 3. Public API
// ------------------------------------------------------------

/**
 * Generate a structured AI "Progress Story" from an array of
 * commits using Google Gemini.
 *
 * @param {Array} commitsArray - Array of commit objects (needs
 *                               at least `.message` and `.author.name`).
 * @returns {Promise<{title:string, summary:string, vibe:string} |
 *                   {error:true, message:string}>}
 */
export async function generateCommitSummary(commitsArray) {
  // Guard: no commits → nothing to summarise
  if (!commitsArray || commitsArray.length === 0) {
    return { error: true, message: 'No commits to summarize.' };
  }

  const model = getModel();

  // Guard: no API key → gracefully skip
  if (!model) {
    return {
      error: true,
      message: 'Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.',
    };
  }

  try {
    const prompt = buildPrompt(commitsArray);
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse the JSON response — Gemini should return valid JSON
    // thanks to responseMimeType, but we wrap in try/catch anyway.
    const parsed = JSON.parse(text);

    // Validate the expected keys exist
    if (!parsed.title || !parsed.summary || !parsed.vibe) {
      console.warn('[GitTrace] Gemini response missing expected keys:', parsed);
      return {
        error: true,
        message: 'AI returned an incomplete response. Please try again.',
      };
    }

    console.info('[GitTrace] AI Progress Story generated:', parsed.title);
    return parsed;
  } catch (err) {
    console.error('[GitTrace] Gemini API error:', err);

    // Provide user-friendly error messages
    if (err.message?.includes('API_KEY')) {
      return {
        error: true,
        message: 'Invalid Gemini API key. Check your VITE_GEMINI_API_KEY.',
      };
    }

    return {
      error: true,
      message: err.message || 'Failed to generate AI summary.',
    };
  }
}
