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

  // 1. Try Groq LLM extraction and conversational answer if API key available
  if (GROQ_API_KEY) {
    try {
      const prompt = `You are an intelligent voice commerce assistant for PayGate 402 (Autonomous Agent Payment Protocol AP2 / x402).
The user spoke: "${cleanTranscript}"

Determine if the user is asking a conversational question OR stating a purchase/e-commerce intent.

Respond STRICTLY with a raw JSON object matching this schema:
{
  "action": "buy" | "search" | "question" | "topup" | "general",
  "category": "Electronics" | "Footwear" | "Apparel" | "Groceries" | "General",
  "itemKeywords": string,
  "budget": number or null,
  "brandPreference": string or null,
  "answer": string (If the user asked a question, provide a friendly, helpful, concise answer in 1-3 sentences. Otherwise null)
}
JSON output only:`;

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
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
  const answer = parsedIntent.answer || null;

  // If it's a general question with an answer, return directly without gating confirmation
  if (action === 'question' && answer) {
    return {
      rawTranscript: cleanTranscript,
      isQuestion: true,
      answer,
      intent: {
        action: 'question',
        category: 'General',
        itemKeywords: cleanTranscript,
        budget: 0,
      },
      parsedAt: new Date().toISOString(),
    };
  }

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
  const lower = transcript.toLowerCase().trim();

  // Explicit purchase verbs
  const hasBuyWord = /\b(buy|purchase|order|book|get me|add money|topup|checkout)\b/i.test(lower);
  const hasProductWord = /\b(shoes?|sneakers?|boots?|phones?|laptops?|headphones?|earphones?|earbuds?|watches?|shirts?|tshirts?|hoodies?|grocer(y|ies))\b/i.test(lower);

  // If NOT explicitly asking to buy or book a product, treat as full Conversational AI Assistant
  if (!hasBuyWord && !hasProductWord) {
    let answer = 'I am your AP2 Voice Commerce Assistant. I can help you search products, negotiate autonomous discounts, check wallet balances, track orders, and execute cryptographic payments!';

    if (lower.includes('who made') || lower.includes('who created') || lower.includes('who built') || lower.includes('developer') || lower.includes('founder') || lower.includes('author')) {
      answer = 'I was designed and developed by Tejas Patil for the Razorpay AI Buildathon to demonstrate the AP2 / x402 Autonomous Agent Payment Protocol!';
    } else if (lower.includes('what are you doing') || lower.includes('what r u doing') || lower.includes('what doing')) {
      answer = 'I am actively monitoring merchant catalogs, evaluating cryptographic payment mandates, and standing by to help you buy products or track orders!';
    } else if (lower.includes('stop') || lower.includes('pause') || lower.includes('wait') || lower.includes('hold on') || lower.includes('shutup') || lower.includes('quiet')) {
      answer = 'Understood! I will pause here. Whenever you are ready to shop, negotiate deals, or check orders, just say hello.';
    } else if (lower.includes('feature') || lower.includes('what can you do') || lower.includes('capabilities') || lower.includes('what you provide')) {
      answer = 'Here are my core capabilities:\n• 🎙️ Natural Voice Commerce: Speak or type in real-time.\n• 🤝 Autonomous Price Negotiation: Negotiate 10-15% discounts with merchants.\n• 🔐 Cryptographic Cart Mandates: RSA-PSS 2048-bit mandate signing.\n• 💳 Real-time AP2 Wallet: Instant ledger debit and zero-double-credit idempotency.\n• 📦 Autonomous Order Tracking: Live fulfillment and delivery status.';
    } else if (lower.includes('name') || lower.includes('who are you') || lower.includes('who r u')) {
      answer = 'Hello! I am your personalized AP2 Voice Commerce Agent. I handle machine-to-machine negotiations, client-side mandate signing, and autonomous payments.';
    } else if (lower.includes('ap2') || lower.includes('paygate') || lower.includes('mesh')) {
      answer = 'PayGate 402 is an Agentic Payment Integrity Mesh implementing the AP2 & x402 protocols for secure, machine-to-machine autonomous commerce with client-side RSA-PSS mandates.';
    } else if (lower.includes('negotiat') || lower.includes('discount') || lower.includes('bargain')) {
      answer = 'When you choose a product, I autonomously negotiate with verified merchants on your behalf to secure the best available market discount (up to 10-15% off).';
    } else if (lower.includes('wallet') || lower.includes('balance') || lower.includes('money') || lower.includes('fund')) {
      answer = 'Your AP2 Wallet holds INR test funds. You can top up anytime via Razorpay, and configure daily velocity caps to control autonomous agent spending.';
    } else if (lower.includes('order') || lower.includes('track') || lower.includes('delivery')) {
      answer = 'I track all your autonomous agent orders in real-time. Just ask "Track my last order" to see live fulfillment and delivery receipts.';
    } else if (lower.includes('refund') || lower.includes('fail') || lower.includes('cancel') || lower.includes('rollback')) {
      answer = 'Our Double-Entry Cryptographic Ledger includes automated rollback compensation. If an order fails, funds are instantly credited back to your wallet with zero loss.';
    } else if (lower.includes('security') || lower.includes('safe') || lower.includes('hack') || lower.includes('crypto')) {
      answer = 'All transactions are secured by client-side RSA-PSS 2048-bit keys, SHA-256 integrity hashes, policy velocity limits, and HMAC webhook authentication.';
    } else if (lower.includes('how are you') || lower.includes('how r u') || lower.includes('how are u')) {
      answer = 'I am doing great! Ready to help you discover products, negotiate deals, and execute AP2 payments. What are you looking for today?';
    } else if (lower.includes('thank') || lower.includes('thx') || lower.includes('good job') || lower.includes('awesome') || lower.includes('great')) {
      answer = "You're very welcome! Let me know whenever you want to search products, check deals, or settle orders.";
    } else if (lower.includes('bye') || lower.includes('goodbye') || lower.includes('good night') || lower.includes('see you')) {
      answer = 'Goodbye! Have a great day ahead. Feel free to wake me up whenever you need anything!';
    } else if (lower.includes('joke') || lower.includes('make me laugh')) {
      answer = 'Why did the autonomous agent go to the store? To negotiate a deal it could not refuse!';
    } else if (lower.includes('weather') || lower.includes('time')) {
      answer = `Right now the local time is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. For commerce and shopping, it's always a good time to find deals!`;
    } else {
      answer = `I am listening! You can ask me questions about your wallet, orders, or ask me to find products like "Buy running shoes under 3000". How can I assist you?`;
    }

    return {
      action: 'question',
      category: 'General',
      itemKeywords: transcript,
      budget: 0,
      brandPreference: '',
      answer,
    };
  }
  
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
    answer: null,
  };
}

module.exports = {
  transcribeAudioWithWhisper,
  parseVoiceIntent,
};
