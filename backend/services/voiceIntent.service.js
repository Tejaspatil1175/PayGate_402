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

  // Phonetic & Misspelling Normalization for Indian/Global accents
  const normalized = lower
    // Kairo name mishearings
    .replace(/\b(cairo|kyro|kiero|chiro|kero|kayro|karo|kaero|hiro|kiro|hero|keiro|cairo)\b/gi, 'kairo')
    // Action verb variations
    .replace(/\b(by|bay|kharid|kharido|lena|mangao|mangwana|order|buk|book|booking|layna)\b/gi, 'buy')
    // Track / Delivery variations
    .replace(/\b(trak|trac|trake|dhundo|pata karo|kaha hai|where is|bhejo|status|delivary|diliver)\b/gi, 'track')
    // Wallet / Balance variations
    .replace(/\b(walet|valet|balence|balans|paise|paisa|kitna hai|amount|funds|rupay)\b/gi, 'balance')
    // Product variations
    .replace(/\b(shoo|shoos|juta|jute|sneekers|sneeker|snicker|snickers)\b/gi, 'shoes')
    .replace(/\b(headfon|hedphone|hedfon|earfon|earphone|earbuds|airpods|airpod|bud)\b/gi, 'headphones')
    .replace(/\b(fone|fon|mobile|mobail)\b/gi, 'phone')
    .replace(/\b(kapde|tshirt|tee|t-shirt)\b/gi, 'shirt')
    // Greeting variations
    .replace(/\b(namaste|namaskar|helo|hlo|heyy|heya)\b/gi, 'hello');

  // Explicit purchase verbs
  const hasBuyWord = /\b(buy|purchase|order|book|get me|add money|topup|checkout|kharid)\b/i.test(normalized);
  const hasProductWord = /\b(shoes?|sneakers?|boots?|phones?|laptops?|headphones?|earphones?|earbuds?|watches?|shirts?|tshirts?|hoodies?|grocer(y|ies))\b/i.test(normalized);

  // If NOT explicitly asking to buy or book a product, treat as full Conversational AI Assistant
  if (!hasBuyWord && !hasProductWord) {
    let answer = 'I am your AP2 Voice Commerce Assistant. I can help you search products, negotiate autonomous discounts, check wallet balances, track orders, and execute cryptographic payments!';

    if (normalized.includes('who made') || normalized.includes('who created') || normalized.includes('who built') || normalized.includes('developer') || normalized.includes('founder') || normalized.includes('author') || normalized.includes('kisne banaya')) {
      answer = 'I was designed and developed by Tejas Patil for the Razorpay AI Buildathon to demonstrate the AP2 / x402 Autonomous Agent Payment Protocol!';
    } else if (normalized.includes('what are you doing') || normalized.includes('what r u doing') || normalized.includes('kya kar rahe')) {
      answer = 'I am actively monitoring merchant catalogs, evaluating cryptographic payment mandates, and standing by to help you buy products or track orders!';
    } else if (normalized.includes('stop') || normalized.includes('pause') || normalized.includes('wait') || normalized.includes('hold on') || normalized.includes('ruko') || normalized.includes('bas')) {
      answer = 'Understood! I will pause here. Whenever you are ready to shop, negotiate deals, or check orders, just say "Hey Kairo".';
    } else if (normalized.includes('feature') || normalized.includes('what can you do') || normalized.includes('capabilities') || normalized.includes('what you provide')) {
      answer = 'Here are my core capabilities as Kairo:\n• 🎙️ Natural Voice Commerce: Speak or type in real-time.\n• 🤝 Autonomous Price Negotiation: Negotiate 10-15% discounts with merchants.\n• 🔐 Cryptographic Cart Mandates: RSA-PSS 2048-bit mandate signing.\n• 💳 Real-time AP2 Wallet: Instant ledger debit and zero-double-credit idempotency.\n• 📦 Autonomous Order Tracking: Live fulfillment and delivery status.';
    } else if (normalized.includes('name') || normalized.includes('who are you') || normalized.includes('naam') || normalized.includes('kairo')) {
      answer = 'Hello! I am KAIRO — your Crypto-Agent Payment Intelligence Assistant for PayGate 402. I handle machine-to-machine negotiations, client-side mandate signing, and autonomous payments.';
    } else if (normalized.includes('ap2') || normalized.includes('paygate') || normalized.includes('mesh')) {
      answer = 'PayGate 402 is an Agentic Payment Integrity Mesh implementing the AP2 & x402 protocols for secure, machine-to-machine autonomous commerce with client-side RSA-PSS mandates.';
    } else if (normalized.includes('negotiat') || normalized.includes('discount') || normalized.includes('bargain') || normalized.includes('offer')) {
      answer = 'When you choose a product, I autonomously negotiate with verified merchants on your behalf to secure the best available market discount (up to 10-15% off).';
    } else if (normalized.includes('wallet') || normalized.includes('balance') || normalized.includes('money') || normalized.includes('fund') || normalized.includes('paise')) {
      answer = 'Your AP2 Wallet holds INR test funds. You can top up anytime via Razorpay, and configure daily velocity caps to control autonomous agent spending.';
    } else if (normalized.includes('order') || normalized.includes('track') || normalized.includes('delivery')) {
      answer = 'I track all your autonomous agent orders in real-time. Just ask "Track my last order" to see live fulfillment and delivery receipts.';
    } else if (normalized.includes('refund') || normalized.includes('fail') || normalized.includes('cancel') || normalized.includes('rollback')) {
      answer = 'Our Double-Entry Cryptographic Ledger includes automated rollback compensation. If an order fails, funds are instantly credited back to your wallet with zero loss.';
    } else if (normalized.includes('security') || normalized.includes('safe') || normalized.includes('hack') || normalized.includes('crypto')) {
      answer = 'All transactions are secured by client-side RSA-PSS 2048-bit keys, SHA-256 integrity hashes, policy velocity limits, and HMAC webhook authentication.';
    } else if (normalized.includes('how are you') || normalized.includes('kaise ho') || normalized.includes('how r u')) {
      answer = 'I am doing great! Ready to help you discover products, negotiate deals, and execute AP2 payments. What are you looking for today?';
    } else if (normalized.includes('thank') || normalized.includes('dhanyawad') || normalized.includes('shukriya') || normalized.includes('great')) {
      answer = "You're very welcome! Let me know whenever you want to search products, check deals, or settle orders.";
    } else if (normalized.includes('bye') || normalized.includes('goodbye') || normalized.includes('alvida')) {
      answer = 'Goodbye! Have a great day ahead. Feel free to say "Hey Kairo" whenever you need anything!';
    } else if (normalized.includes('joke') || normalized.includes('hasao')) {
      answer = 'Why did the autonomous agent go to the store? To negotiate a deal it could not refuse!';
    } else if (normalized.includes('weather') || normalized.includes('time') || normalized.includes('samay')) {
      answer = `Right now the local time is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. For commerce and shopping, it's always a good time to find deals!`;
    } else {
      answer = `I am KAIRO, listening! You can ask me questions about your wallet, orders, or ask me to find products like "Buy running shoes under 3000". How can I assist you?`;
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
  if (normalized.includes('search') || normalized.includes('find') || normalized.includes('look for')) {
    action = 'search';
  } else if (normalized.includes('topup') || normalized.includes('add money') || normalized.includes('recharge')) {
    action = 'topup';
  }

  let category = 'General';
  if (normalized.includes('shoe') || normalized.includes('sneaker') || normalized.includes('boot') || normalized.includes('footwear')) category = 'Footwear';
  else if (normalized.includes('phone') || normalized.includes('laptop') || normalized.includes('headphone') || normalized.includes('electronic') || normalized.includes('airpod')) category = 'Electronics';
  else if (normalized.includes('shirt') || normalized.includes('pant') || normalized.includes('jacket') || normalized.includes('cloth') || normalized.includes('tshirt') || normalized.includes('hoodie')) category = 'Apparel';
  else if (normalized.includes('food') || normalized.includes('grocery') || normalized.includes('snack')) category = 'Groceries';
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
