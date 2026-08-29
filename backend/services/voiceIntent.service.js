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
 * @param {Array<{role: string, text: string}>} [history] - Recent conversation turns for context resolution
 * @param {Object} [lastContext] - Last known resolved intent (category, itemKeywords, budget) to merge follow-ups against
 * @returns {Promise<Object>} Structured intent with confirmation gate details
 */
async function parseVoiceIntent(transcript, userId, history = [], lastContext = null) {
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    throw new Error('Speech transcript text is required');
  }

  const cleanTranscript = transcript.trim();
  let parsedIntent = null;

  const historyBlock = Array.isArray(history) && history.length > 0
    ? history.slice(-6).map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n')
    : '(no prior conversation)';

  const lastContextBlock = lastContext
    ? `Last known resolved intent from this conversation: category="${lastContext.category || ''}", item="${lastContext.itemKeywords || ''}", budget=${lastContext.budget || 0}. If the user's new message is a short follow-up (e.g. just a number, "book it", "yes", "confirm", "that one"), resolve it against this last known intent instead of treating it as a brand new unrelated request.`
    : '(no prior resolved intent yet)';

  // 1. Try Groq or xAI (Grok) LLM extraction and conversational reasoning
  // 1. Google Gemini 2.5 Flash AI reasoning
  const geminiKey = process.env.GEMINI_API_KEY || '';
  if (geminiKey) {
    try {
      const prompt = `You are Tejas, an intelligent voice commerce AI for PayGate 402 (Autonomous Agent Payment Protocol AP2 / x402).

Recent conversation:
${historyBlock}

${lastContextBlock}

User spoke: "${cleanTranscript}"

Classify intent into JSON:
{
  "action": "buy" | "search" | "question" | "topup" | "general" | "confirm_purchase",
  "category": "Electronics" | "Footwear" | "Apparel" | "Groceries" | "Books" | "General",
  "itemKeywords": string,
  "budget": number or null,
  "brandPreference": string or null,
  "isFollowUp": boolean,
  "answer": string or null
}
If user is greeting, saying hello, or asking a question, set action to "question" and provide a friendly conversational greeting/answer in "answer". Do NOT set action to "general" or "buy" for greetings. If user is searching or buying a product, extract clean itemKeywords and budget, and set action to "buy" or "search". If user confirms previous proposal (e.g. "purchase it", "buy it", "confirm", "just purchase it"), set action to "confirm_purchase".
Output raw JSON only:`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        },
        { timeout: 3500 }
      );

      let content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) {
        content = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        parsedIntent = JSON.parse(content);
      }
    } catch (error) {
      logger.warn('[VOICE_INTENT_GEMINI_WARN] Gemini parsing failed, using rule-based parser:', error.response?.data || error.message);
    }
  }

  // 2. Rule-based Regex Fallback Parser if LLM not available or failed
  if (!parsedIntent) {
    parsedIntent = ruleBasedIntentParser(cleanTranscript, lastContext);
  }

  const action = parsedIntent.action || 'buy';
  const category = parsedIntent.category || lastContext?.category || 'General';
  const itemKeywords = parsedIntent.itemKeywords || (parsedIntent.isFollowUp ? lastContext?.itemKeywords : cleanTranscript) || cleanTranscript;
  const budget = Number(parsedIntent.budget) || (parsedIntent.isFollowUp ? Number(lastContext?.budget) : 0) || 0;
  const brandPreference = parsedIntent.brandPreference || lastContext?.brandPreference || '';
  const scheduleTime = parsedIntent.scheduleTime || '';
  const answer = parsedIntent.answer || null;

  // Confirm-purchase short-circuit: tells the frontend to trigger checkout directly, no new search needed
  if (action === 'confirm_purchase') {
    return {
      rawTranscript: cleanTranscript,
      isConfirmPurchase: true,
      intent: { action: 'confirm_purchase', category, itemKeywords, budget, brandPreference },
      parsedAt: new Date().toISOString(),
    };
  }

  // If it's a general question, greeting, or conversational statement with an answer
  if ((action === 'question' || action === 'general') && answer) {
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

  // Only require confirmation if manual approval threshold is exceeded by high-value policy
  const requiresConfirmation = Boolean(gatedEvaluation.requireManualApproval);
  const confirmationSummary = `Action '${action.toUpperCase()}' for item "${itemKeywords}" in category '${category}' at budget ₹${budget.toLocaleString('en-IN')}${brandPreference ? ` (Brand: ${brandPreference})` : ''}${scheduleTime ? ` (Scheduled: ${scheduleTime})` : ''}.`;

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
 * @param {string} transcript
 * @param {Object} [lastContext] - Last known resolved intent to merge short follow-ups against
 */
function ruleBasedIntentParser(transcript, lastContext = null) {
  const lower = transcript.toLowerCase().trim();

  // Confirmation / Purchase phrases for previously found item ("purchase it", "buy this", "book it", "yes", "confirm", "buy it", "go ahead", "proceed", "do it")
  const isConfirmPhrase = /^\s*(okay\s*)?(ok\s*)?(purchase\s*it|purchase\s*this|buy\s*it|buy\s*this|book\s*it|book\s*this|confirm|yes|yeah|yep|proceed|go\s*ahead|do\s*it|order\s*it|order\s*this|kharido)\s*[.!]?\s*$/i.test(lower);
  if (isConfirmPhrase && lastContext) {
    return {
      action: 'confirm_purchase',
      category: lastContext.category || 'General',
      itemKeywords: lastContext.itemKeywords || '',
      budget: lastContext.budget || 0,
      brandPreference: lastContext.brandPreference || '',
      answer: null,
    };
  }

  // Bare number/short budget follow-up (e.g. "3 thousand", "3000", "around 3000") when a prior item exists
  const bareBudgetMatch = lower.match(/^\s*(?:around|about|budget|rs\.?|₹)?\s*(\d+(?:,\d+)*)\s*(thousand|k)?\s*(?:rupees|rs|inr)?\s*[.!]?\s*$/i);
  if (bareBudgetMatch && lastContext && lastContext.itemKeywords) {
    let num = parseFloat(bareBudgetMatch[1].replace(/,/g, ''));
    if (bareBudgetMatch[2]) num *= 1000; // "3 thousand" -> 3000
    return {
      action: 'buy',
      category: lastContext.category || 'General',
      itemKeywords: lastContext.itemKeywords,
      budget: num,
      brandPreference: lastContext.brandPreference || '',
      isFollowUp: true,
      answer: null,
    };
  }

  // Phonetic & Misspelling Normalization for Indian/Global accents
  const normalized = lower
    // Tejas name mishearings & mispronunciations
    .replace(/\b(tejas|tejaz|tijas|tijaz|tejus|thejas|kiaro|cairo|kyro|kiero|chiro|kero|kayro|karo|kaero|hiro|kiro|hero|keiro|kairu|kairon|kailo|kaito|kaido|kearo|gyro|caero|kai\s*ro|ki\s*aro|kay\s*ro)\b/gi, 'tejas')
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

  // Explicit purchase & search verbs
  const hasBuyOrSearchWord = /\b(buy|purchase|order|book|get me|add money|topup|checkout|kharid|search for|search|find me|find|look for|show me|want)\b/i.test(normalized);
  const hasProductWord = /\b(shoes?|sneakers?|boots?|phones?|laptops?|headphones?|earphones?|earbuds?|watches?|shirts?|tshirts?|hoodies?|books?|novels?|grocer(y|ies))\b/i.test(normalized);

  // If user says "search for books" or "buy shoes" or gives a budget, treat as shopping intent!
  if (!hasBuyOrSearchWord && !hasProductWord) {
    let answer = 'I am your AP2 Voice Commerce Assistant. I can help you search products, negotiate autonomous discounts, check wallet balances, track orders, and execute cryptographic payments!';

    if (normalized.includes('who made') || normalized.includes('who created') || normalized.includes('who built') || normalized.includes('developer') || normalized.includes('founder') || normalized.includes('author') || normalized.includes('kisne banaya')) {
      answer = 'I was designed and developed by Tejas Patil for the Razorpay AI Buildathon to demonstrate the AP2 / x402 Autonomous Agent Payment Protocol!';
    } else if (normalized.includes('what are you doing') || normalized.includes('what r u doing') || normalized.includes('kya kar rahe')) {
      answer = 'I am actively monitoring merchant catalogs, evaluating cryptographic payment mandates, and standing by to help you buy products or track orders!';
    } else if (normalized.includes('stop') || normalized.includes('pause') || normalized.includes('wait') || normalized.includes('hold on') || normalized.includes('ruko') || normalized.includes('bas')) {
      answer = 'Understood! I will pause here. Whenever you are ready to shop, negotiate deals, or check orders, just say "Hey Tejas".';
    } else if (normalized.includes('feature') || normalized.includes('what can you do') || normalized.includes('capabilities') || normalized.includes('what you provide')) {
      answer = 'Here are my core capabilities as Tejas:\n• 🎙️ Natural Voice Commerce: Speak or type in real-time.\n• 🤝 Autonomous Price Negotiation: Negotiate 10-15% discounts with merchants.\n• 🔐 Cryptographic Cart Mandates: RSA-PSS 2048-bit mandate signing.\n• 💳 Real-time AP2 Wallet: Instant ledger debit and zero-double-credit idempotency.\n• 📦 Autonomous Order Tracking: Live fulfillment and delivery status.';
    } else if (normalized.includes('name') || normalized.includes('who are you') || normalized.includes('naam') || normalized.includes('tejas')) {
      answer = 'Hello! I am Tejas — your Crypto-Agent Payment Intelligence Assistant for PayGate 402. I handle machine-to-machine negotiations, client-side mandate signing, and autonomous payments.';
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
      answer = 'Goodbye! Have a great day ahead. Feel free to say "Hey Tejas" whenever you need anything!';
    } else if (normalized.includes('joke') || normalized.includes('hasao')) {
      answer = 'Why did the autonomous agent go to the store? To negotiate a deal it could not refuse!';
    } else if (normalized.includes('weather') || normalized.includes('time') || normalized.includes('samay')) {
      answer = `Right now the local time is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. For commerce and shopping, it's always a good time to find deals!`;
    } else {
      answer = `I am Tejas, listening! You can ask me questions about your wallet, orders, or ask me to find products like "Buy running shoes under 3000". How can I assist you?`;
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
  const priceMatches = transcript.match(/(?:under|below|for|around|budget|rs\.?|₹|\$)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(thousand|k)?/i) ||
                       transcript.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(thousand|k)?\s*(?:rupees|rs|inr)?/i) ||
                       transcript.match(/(\d+)/);
  if (priceMatches && priceMatches[1]) {
    budget = parseFloat(priceMatches[1].replace(/,/g, ''));
    if (priceMatches[2] && (priceMatches[2].toLowerCase() === 'k' || priceMatches[2].toLowerCase() === 'thousand')) {
      budget = budget * 1000;
    } else if (budget > 0 && budget < 100 && !/\b(rupee|rs|inr)\b/i.test(transcript)) {
      // E.g. "under 5" or "for 3" -> 5000, 3000
      budget = budget * 1000;
    }
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

  // Clean itemKeywords: Strip command prefixes, conversational fillers, and budget suffixes
  let cleaned = transcript
    .replace(/\b(okay|ok|hey|kairo|kiaro|same|there is a product|product|search for|search|find me|find|look for|show me|buy|purchase|get me|order|i want to buy|i want|please)\b/gi, '')
    .replace(/(?:under|below|for|around|budget|rs\.?|₹|\$)\s*(\d+(?:,\d+)*(?:\.\d+)?)/gi, '')
    .replace(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:rupees|rs|inr|dollars)/gi, '')
    .replace(/\b(rupees|rs|inr|bucks|it|this|that)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If after stripping all filler words nothing is left (e.g. user just said "search for it"), fallback to lastContext or clean transcript
  if (!cleaned && lastContext?.itemKeywords) {
    cleaned = lastContext.itemKeywords;
  }

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
