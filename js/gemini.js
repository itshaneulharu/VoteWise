/**
 * VoteWise — Gemini API Integration
 * Handles communication with Google's Gemini API, including the
 * full VoteWise system prompt for election guidance.
 */

const GeminiService = {
  MODELS: ['gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-2.0-flash'],
  _currentModelIndex: 0,
  API_BASE: 'https://generativelanguage.googleapis.com/v1beta/models',

  get MODEL() { return this.MODELS[this._currentModelIndex]; },

  /**
   * The VoteWise system instruction sent to Gemini.
   */
  SYSTEM_PROMPT: `You are VoteWise, a friendly and knowledgeable AI-powered election guide built to help every citizen — especially first-time voters — understand the democratic process with clarity and confidence.

PERSONALITY:
- Warm, approachable, and encouraging — like a civic-minded friend, not a textbook
- Use simple, jargon-free language
- Break complex processes into small, digestible steps
- Celebrate civic participation ("Great question! Voting is your superpower 🗳️")
- Never be politically biased — always neutral, factual, and inclusive

CORE CAPABILITIES:

1. ELECTION PROCESS EXPLAINER
When asked about the election process, always structure your answer as:
- A one-line simple summary
- A numbered step-by-step breakdown
- A "Did You Know?" fun civic fact at the end

2. PERSONALIZED VOTER GUIDE
Ask the user targeted questions to personalize their journey:
- "Are you a first-time voter?"
- "Which country/state are you voting in?"
- "Have you registered yet?"
Based on answers, generate a custom checklist with deadlines and actions.

3. TIMELINE & REMINDERS
When asked about timelines, present them as clear phases:
Phase 1 → Phase 2 → Phase 3 format with dates if provided by user.
Always end with: "Want me to set a reminder checklist for you?"

4. DOUBT RESOLVER (FAQ Mode)
For common questions, give concise direct answers followed by:
"Want to know more about this?" to encourage follow-up.

Common topics you handle:
- Voter registration process & deadlines
- Voter ID / documents required
- How to find your polling booth
- How EVMs (Electronic Voting Machines) work
- What NOTA means
- How votes are counted
- What happens if I miss voting
- Difference between local, state, and national elections
- How to check your name on the voter list
- Postal ballot / absentee voting

RESPONSE FORMAT RULES:
- Always use emojis sparingly but effectively (🗳️ ✅ 📅 📍 💡)
- Use bullet points and numbered lists for steps
- Bold key terms using **double asterisks**
- Keep responses under 200 words unless user asks for detail
- End every response with one follow-up question to keep the conversation going

TONE EXAMPLES:
BAD: "The electoral process involves a multi-tiered administrative framework..."
GOOD: "Elections happen in clear steps — let me walk you through it simply!"

BAD: "You must furnish documentation as per ECI guidelines."
GOOD: "You'll need a valid ID — here's a quick list of what's accepted 📋"

BOUNDARIES:
- Do not endorse any political party, candidate, or ideology
- Do not make up election dates — ask the user for their region or say "Check your local Election Commission website for exact dates"
- If unsure, say: "I want to make sure you get accurate info — please verify this at your official election authority's website"`,

  /**
   * Get the stored API key.
   * @returns {string|null}
   */
  getApiKey() {
    return localStorage.getItem('votewise_api_key');
  },

  /**
   * Save the API key.
   * @param {string} key
   */
  setApiKey(key) {
    localStorage.setItem('votewise_api_key', key.trim());
  },

  /**
   * Remove the stored API key.
   */
  clearApiKey() {
    localStorage.removeItem('votewise_api_key');
  },

  /**
   * Check if an API key is stored.
   * @returns {boolean}
   */
  hasApiKey() {
    const key = this.getApiKey();
    return key && key.length > 0;
  },

  /**
   * Validate an API key by listing available models (lightweight GET request).
   * @param {string} key
   * @returns {Promise<{valid: boolean, networkError: boolean}>}
   */
  async validateApiKey(key) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
      const response = await fetch(url);
      console.log('[VoteWise] API key validation response:', response.status);
      if (response.ok) {
        return { valid: true, networkError: false };
      }
      // 400/403 = bad key, anything else might be transient
      if (response.status === 400 || response.status === 403) {
        return { valid: false, networkError: false };
      }
      // Other errors (429 rate limit, 500 server error) — key might still be valid
      return { valid: true, networkError: false };
    } catch (err) {
      console.warn('[VoteWise] Validation network error:', err);
      // Network error — can't verify, assume valid and let chat attempt reveal issues
      return { valid: true, networkError: true };
    }
  },

  /**
   * Send a message to Gemini with full conversation history.
   * @param {string} userMessage - The latest user message
   * @param {Array} chatHistory - Array of {role, text} objects
   * @returns {Promise<string>} The bot's response text
   */
  async sendMessage(userMessage, chatHistory = []) {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('API_KEY_MISSING');

    const url = `${this.API_BASE}/${this.MODEL}:generateContent?key=${apiKey}`;

    // Build contents array with history
    const contents = [];

    // Add previous conversation turns
    for (const msg of chatHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      });
    }

    // Add the new user message
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    const requestBody = {
      system_instruction: {
        parts: [{ text: this.SYSTEM_PROMPT }]
      },
      contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1024,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ]
    };

    // Retry with exponential backoff for rate limits
    const MAX_RETRIES = 4;
    const RETRY_DELAYS = [3000, 5000, 8000, 12000];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Rebuild URL in case model changed
      const currentUrl = `${this.API_BASE}/${this.MODEL}:generateContent?key=${apiKey}`;

      try {
        const response = await fetch(currentUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (response.status === 429) {
          if (attempt < MAX_RETRIES) {
            // After 2 fails on same model, try next model
            if (attempt >= 1 && this._currentModelIndex < this.MODELS.length - 1) {
              this._currentModelIndex++;
              console.log(`[VoteWise] Switching to fallback model: ${this.MODEL}`);
            }
            const delay = RETRY_DELAYS[attempt];
            console.log(`[VoteWise] Rate limited (${this.MODEL}). Retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
            await this._sleep(delay);
            continue;
          }
          throw new Error('RATE_LIMITED');
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[VoteWise] API error:', response.status, errorData);
          if (response.status === 400) throw new Error('BAD_REQUEST');
          if (response.status === 403) throw new Error('API_KEY_INVALID');
          throw new Error(`API_ERROR_${response.status}`);
        }

        const data = await response.json();

        // Extract text from response
        if (data.candidates && data.candidates.length > 0) {
          const candidate = data.candidates[0];
          if (candidate.content && candidate.content.parts) {
            return candidate.content.parts.map(p => p.text).join('');
          }
          if (candidate.finishReason === 'SAFETY') {
            return "I want to make sure I give you helpful and safe information. Could you rephrase your question? I'm here to help with election and voting topics! 🗳️";
          }
        }

        throw new Error('EMPTY_RESPONSE');
      } catch (error) {
        // Re-throw known errors (except RATE_LIMITED which is handled above)
        if (['API_KEY_MISSING', 'API_KEY_INVALID', 'BAD_REQUEST', 'EMPTY_RESPONSE', 'RATE_LIMITED'].includes(error.message) || error.message.startsWith('API_ERROR_')) {
          throw error;
        }
        // Network errors — retry if attempts remain
        if (attempt < MAX_RETRIES) {
          console.log(`[VoteWise] Network error, retrying in ${RETRY_DELAYS[attempt] / 1000}s...`);
          await this._sleep(RETRY_DELAYS[attempt]);
          continue;
        }
        throw new Error('NETWORK_ERROR');
      }
    }
  },

  /**
   * Sleep helper for retry delays.
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Get a user-friendly error message.
   * @param {Error} error
   * @returns {string}
   */
  getErrorMessage(error) {
    const messages = {
      'API_KEY_MISSING': '🔑 Please add your Gemini API key in settings to start chatting.',
      'API_KEY_INVALID': '🔑 Your API key seems invalid. Please check it in settings.',
      'RATE_LIMITED': '⏳ Too many requests! Please wait a moment and try again.',
      'BAD_REQUEST': '😕 Something went wrong with the request. Please try rephrasing your question.',
      'EMPTY_RESPONSE': '🤔 I didn\'t get a response. Please try again!',
      'NETWORK_ERROR': '🌐 Network issue — please check your internet connection and try again.',
    };
    return messages[error.message] || `⚠️ An unexpected error occurred. Please try again.`;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GeminiService;
}
