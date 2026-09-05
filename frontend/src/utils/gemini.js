/**
 * Frontend Google Gemini API Direct Integration Utility
 * Allows client-side intent classification, product reasoning, and voice commerce
 * without requiring the backend to be online.
 */

const DEFAULT_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export function getGeminiApiKey() {
  const stored = localStorage.getItem('paygate_gemini_api_key');
  if (stored && stored.trim().length > 5) {
    return stored.trim();
  }
  return DEFAULT_GEMINI_KEY;
}

export function setGeminiApiKey(key) {
  if (key && key.trim()) {
    localStorage.setItem('paygate_gemini_api_key', key.trim());
  } else {
    localStorage.removeItem('paygate_gemini_api_key');
  }
}

/**
 * Test Gemini API Key connectivity directly from browser
 */
export async function testGeminiConnection(apiKey = null) {
  const key = apiKey || getGeminiApiKey();
  if (!key) return { success: false, error: 'No Gemini API key provided' };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with the word OK.' }] }],
        }),
      }
    );

    const data = await res.json();
    if (res.ok && data.candidates && data.candidates.length > 0) {
      return { success: true, message: 'Gemini API connected successfully' };
    }
    return {
      success: false,
      error: data.error?.message || 'Invalid Gemini API response',
    };
  } catch (err) {
    return { success: false, error: err.message || 'Network error reaching Gemini' };
  }
}

/**
 * Call Gemini API directly from frontend
 */
export async function callGemini(prompt, systemInstruction = '') {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error('Gemini API key is not configured');
  }

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  // Try gemini-1.5-flash first, fallback to gemini-2.0-flash / gemini-pro
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
  let lastError = null;

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (res.ok && data.candidates && data.candidates.length > 0) {
        return data.candidates[0].content.parts[0].text;
      }
      if (data.error) {
        lastError = new Error(data.error.message);
      }
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('Failed to generate response from Gemini');
}

/**
 * Direct Frontend Voice Intent & Commerce Classification with Gemini
 */
export async function parseVoiceIntentDirect(text, history = [], lastContext = null) {
  const prompt = `You are Tejas, an intelligent voice commerce AI for PayGate 402 (Autonomous Agent Payment Protocol AP2 / x402).
User spoke: "${text}"

${lastContext ? `Previous context: ${JSON.stringify(lastContext)}` : ''}

Classify intent into JSON:
{
  "action": "buy" | "search" | "question" | "topup" | "general" | "confirm_purchase",
  "category": "Electronics" | "Footwear" | "Apparel" | "Groceries" | "Books" | "General",
  "itemKeywords": string,
  "budget": number or null,
  "brandPreference": string or null,
  "isQuestion": boolean,
  "answer": string or null
}
If user is greeting or asking a question, set action to "question", isQuestion to true, and provide a helpful answer.
If user wants to buy or search, set action to "buy" or "search", extract itemKeywords and budget.
Return ONLY valid JSON.`;

  try {
    const raw = await callGemini(prompt);
    const cleaned = raw.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      success: true,
      intent: parsed,
      isQuestion: parsed.isQuestion || parsed.action === 'question',
      answer: parsed.answer,
      isConfirmPurchase: parsed.action === 'confirm_purchase',
    };
  } catch (err) {
    console.warn('[DirectGemini] Parsing fallback:', err.message);
    // Simple regex fallback if Gemini is unreachable
    const isGreeting = /^(hi|hello|hey|help|who are you)/i.test(text.trim());
    return {
      success: true,
      intent: {
        action: isGreeting ? 'question' : 'search',
        itemKeywords: text,
        category: 'General',
        budget: null,
      },
      isQuestion: isGreeting,
      answer: isGreeting ? 'Hello! I am your PayGate 402 AI Commerce Assistant. What would you like to buy?' : null,
    };
  }
}
