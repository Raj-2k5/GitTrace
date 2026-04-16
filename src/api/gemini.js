/* ============================================================
 * GitTrace — Gemini AI Service
 * ------------------------------------------------------------
 * Integrates with the Google Gemini API via @google/genai SDK
 * to generate human-readable sprint summaries from commit data.
 *
 * FEATURES:
 *  1. Uses the `gemini-2.5-flash` model for fast generation.
 *  2. Enforces structured JSON output via `responseMimeType`.
 *  3. System prompt tuned for a Senior Engineering Manager
 *     persona producing 2-paragraph sprint updates.
 *  4. Graceful fallback if the API key is missing or the call
 *     fails — the app continues to work without AI insights.
 *
 * USAGE:
 *   import { generateCommitSummary } from './api/gemini';
 *   const story = await generateCommitSummary(commits);
 *   // → { title, summary, vibe } or { error: true, message }
 * ============================================================ */

import { GoogleGenAI } from '@google/genai';

// ------------------------------------------------------------
// 1. Client Initialization
// ------------------------------------------------------------

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

/**
 * Lazily initialize the Gemini client.  Returns null if no API
 * key is configured — the caller should treat this as "AI
 * features unavailable" rather than an error.
 */
let _client = null;

const getClient = () => {
  if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
    console.warn(
      '[GitTrace] No VITE_GEMINI_API_KEY found. AI Progress Stories are disabled.',
    );
    return null;
  }

  if (!_client) {
    _client = new GoogleGenAI({ apiKey: API_KEY });
  }
  return _client;
};

// ------------------------------------------------------------
// 2. System Prompt & Prompt Construction
// ------------------------------------------------------------

const SYSTEM_PROMPT = `You are a Senior Engineering Manager. I will provide a list of recent Git commits. Summarize this work into a concise, human-readable 2-paragraph sprint update. Focus on the 'why' and the overall progress, grouping related tasks together. Avoid technical jargon where possible.

Along with the summary, provide:
- "title": A catchy, short title for this batch of work (max 8 words). Be creative but professional. Examples: "The Performance Push", "Dark Mode & Beyond", "Bug Squash Marathon".
- "summary": Your 2-paragraph sprint update.
- "vibe": A single keyword that captures the overall mood of this batch. Pick ONE from: "Feature Shipping", "Bug Squashing", "Refactoring", "Performance", "Testing", "Documentation", "Maintenance", "Infrastructure", "UI Polish", "Security".

Return ONLY a valid JSON object with exactly these three keys: "title", "summary", "vibe".`;

/**
 * Build the user prompt containing the commit messages.
 *
 * @param {Array} commits - Array of commit objects.
 * @returns {string} - The user prompt string.
 */
function buildUserPrompt(commits) {
  // Extract just the commit messages (with author for context)
  const commitList = commits
    .map(
      (c, i) =>
        `${i + 1}. [${c.author?.name ?? 'Unknown'}] ${c.message.split('\n')[0]}`,
    )
    .join('\n');

  return `Here are the recent Git commits to summarize:\n\n${commitList}`;
}

// ------------------------------------------------------------
// 3. Public API
// ------------------------------------------------------------

/**
 * Generate a structured AI "Progress Story" from an array of
 * commits using Google Gemini (@google/genai SDK).
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

  const client = getClient();

  // Guard: no API key → gracefully skip
  if (!client) {
    return {
      error: true,
      message: 'Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.',
    };
  }

  try {
    const userPrompt = buildUserPrompt(commitsArray);

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;

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
    if (err.message?.includes('API_KEY') || err.message?.includes('API key')) {
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
