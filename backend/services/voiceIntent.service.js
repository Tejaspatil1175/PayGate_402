const axios = require('axios');
const FormData = require('form-data');
const { evaluateGatedAction } = require('../middleware/gatedActions');
const logger = require('../utils/logger');

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

/**
 * Transcribe audio using Groq Whisper API (whisper-large-v3) with local fallback
 * @param {Buffer} audioBuffer - Audio buffer
 * @param {string} mimeType - Audio mime type (e.g. 'audio/wav', 'audio/mp3', 'audio/webm')
 * @returns {Promise<string>} Transcribed text string
 */
async function transcribeAudioWithWhisper(audioBuffer, mimeType = 'audio/webm') {
  if (!GROQ_API_KEY) {
    logger.warn('[VOICE_WHISPER] GROQ_API_KEY not configured.');
    throw new Error('Groq Whisper API key is not configured on the backend. Please type your query or use browser voice recognition.');
  }

  try {
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: `audio_${Date.now()}.${mimeType.split('/')[1] || 'webm'}`,
      contentType: mimeType,
    });
    formData.append('model', 'whisper-large-v3');

    const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        ...formData.getHeaders(),
      },
      timeout: 15000,
    });

    const transcript = response.data?.text || '';
    logger.info(`[VOICE_WHISPER] Transcribed audio successfully: "${transcript}"`);
    return transcript;
  } catch (error) {
    logger.error('[VOICE_WHISPER] Whisper API error:', error.response?.data || error.message);
    throw new Error(`Voice transcription failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Parse structured commerce intent from transcript using Groq LLM (llama-3.3-70b-versatile) with Regex Fallback
 * @param {string} transcript - Input speech transcript text
 * @param {string} [userId] - Optional User ID
 * @returns {Promise<Object>} Structured intent with confirmation gate details
 */
async function parseVoiceIntent(transcript, userId) {
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    throw new Error('Speech transcript text is required');
  }

  const cleanTranscript = transcript.trim();
  let parsedIntent = null;

  // 1. Try Groq LLM extraction if API key available
  if (GROQ_API_KEY) {
    try {
      const prompt = `You are a voice intent parser for an agentic commerce payment gateway (PayGate 402).
Extract structured JSON from the user's speech transcript.
Transcript: "${cleanTranscript}"

Respond STRICTLY with a raw JSON object containing these keys:
{
  "action": "buy" | "search" | "book" | "topup" | "general",
  "category": "Electronics" | "Footwear" | "Apparel" | "Groceries" | "General",
  "itemKeywords": string (e.g. "running shoes", "black shirt"),
  "budget": number or null (e.g. 2000),
  "brandPreference": string or null,
  "scheduleTime": string or null
}
JSON output only:`;

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (content) {
        parsedIntent = JSON.parse(content);
      }
    } catch (error) {
      logger.warn('[VOICE_INTENT_LLM_WARN] Groq LLM parsing failed, using rule-based parser:', error.message);
    }
  }

  // 2. Rule-based Regex Fallback Parser if LLM not available or failed
  if (!parsedIntent) {
    parsedIntent = ruleBasedIntentParser(cleanTranscript);
  }

  const action = parsedIntent.action || 'buy';
  const category = parsedIntent.category || 'General';
  const itemKeywords = parsedIntent.itemKeywords || cleanTranscript;
  const budget = Number(parsedIntent.budget) || 0;
  const brandPreference = parsedIntent.brandPreference || '';
  const scheduleTime = parsedIntent.scheduleTime || '';

  // 3. Echo-back & Confirmation Gate Integration (gatedActions)
  const gatedEvaluation = await evaluateGatedAction({
    agentId: 'voice_assistant_agent',
    amount: budget,
    merchantId: null,
  });

  // Explicit echo confirmation summary for numerical accuracy check (e.g. 2000 vs 20000)
  const requiresConfirmation = true;
  const confirmationSummary = `Please confirm: Action '${action.toUpperCase()}' for item "${itemKeywords}" in category '${category}' at budget ₹${budget.toLocaleString('en-IN')}${brandPreference ? ` (Brand: ${brandPreference})` : ''}${scheduleTime ? ` (Scheduled: ${scheduleTime})` : ''}.`;

  return {
    rawTranscript: cleanTranscript,
    intent: {
      action,
      category,
      itemKeywords,
      budget,
      brandPreference,
      scheduleTime,
    },
    confirmationGate: {
      requiresConfirmation,
      confirmationSummary,
      echoBudget: budget,
      gatedActionDecision: gatedEvaluation.decision,
      requireManualApproval: gatedEvaluation.requireManualApproval,
      gatedReason: gatedEvaluation.reason,
    },
    parsedAt: new Date().toISOString(),
  };
}

/**
 * Fallback regex intent parser with intelligent noise stripping
 */
function ruleBasedIntentParser(transcript) {
  const lower = transcript.toLowerCase();
  
  let action = 'buy';
  if (lower.includes('search') || lower.includes('find') || lower.includes('look for')) {
    action = 'search';
  } else if (lower.includes('topup') || lower.includes('add money') || lower.includes('recharge')) {
    action = 'topup';
  }

  let category = 'General';
  if (lower.includes('shoe') || lower.includes('sneaker') || lower.includes('boot') || lower.includes('footwear')) category = 'Footwear';
  else if (lower.includes('phone') || lower.includes('laptop') || lower.includes('headphone') || lower.includes('electronic') || lower.includes('airpod')) category = 'Electronics';
  else if (lower.includes('shirt') || lower.includes('pant') || lower.includes('jacket') || lower.includes('cloth') || lower.includes('tshirt') || lower.includes('hoodie')) category = 'Apparel';
  else if (lower.includes('food') || lower.includes('grocery') || lower.includes('snack')) category = 'Groceries';

  // Extract budget / price figures
  let budget = 0;
  const priceMatches = transcript.match(/(?:under|below|for|around|budget|rs\.?|₹|\$)\s*(\d+(?:,\d+)*(?:\.\d+)?)/i) ||
                       transcript.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:rupees|rs|inr)/i) ||
                       transcript.match(/(\d+)/);
  if (priceMatches && priceMatches[1]) {
    budget = parseFloat(priceMatches[1].replace(/,/g, ''));
  }

  // Extract brand preference
  let brandPreference = '';
  const brands = ['nike', 'adidas', 'puma', 'apple', 'samsung', 'sony', 'boat', 'zara'];
  for (const b of brands) {
    if (lower.includes(b)) {
      brandPreference = b.charAt(0).toUpperCase() + b.slice(1);
      break;
    }
  }

  // Clean itemKeywords: Strip command prefixes and budget suffixes
  let cleaned = transcript
    .replace(/\b(buy|purchase|get me|order|find|search for|look for|show me|i want to buy|i want|please)\b/gi, '')
    .replace(/(?:under|below|for|around|budget|rs\.?|₹|\$)\s*(\d+(?:,\d+)*(?:\.\d+)?)/gi, '')
    .replace(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:rupees|rs|inr|dollars)/gi, '')
    .replace(/\b(rupees|rs|inr|bucks)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    action,
    category,
    itemKeywords: cleaned || transcript,
    budget,
    brandPreference,
    scheduleTime: null,
  };
}

module.exports = {
  transcribeAudioWithWhisper,
  parseVoiceIntent,
};
