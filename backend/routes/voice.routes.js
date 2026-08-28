const express = require('express');
const router = express.Router();
const multer = require('multer');
const { transcribeAudioWithWhisper, parseVoiceIntent } = require('../services/voiceIntent.service');
const walletService = require('../services/wallet.service');
const Order = require('../models/Order');
const Merchant = require('../models/Merchant');

// Memory storage for multer audio uploads
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max audio size
});

// @desc    Parse structured intent directly from transcript text with numerical confirmation check
// @route   POST /api/voice/parse-text
router.post('/parse-text', async (req, res) => {
  try {
    const { text, userId, history, lastContext } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text transcript is required',
      });
    }

    const result = await parseVoiceIntent(text, userId, history, lastContext);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[VOICE_PARSE_TEXT_ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error processing voice intent',
    });
  }
});

// @desc    Execute AP2 voice purchase — check balance, create order, debit wallet atomically
// @route   POST /api/voice/execute-purchase
router.post('/execute-purchase', async (req, res) => {
  try {
    const { product, negotiatedPrice } = req.body;
    const userId = req.body.userId || req.headers['x-user-id'];

    if (!product || !negotiatedPrice) {
      return res.status(400).json({ success: false, error: 'product and negotiatedPrice are required' });
    }

    const amount = Number(negotiatedPrice);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid purchase amount' });
    }

    // 1. Check wallet balance first — reject early if insufficient
    const walletInfo = await walletService.getWalletBalance(userId);
    if (walletInfo.balance < amount) {
      return res.status(402).json({
        success: false,
        insufficientBalance: true,
        required: amount,
        available: walletInfo.balance,
        error: `Insufficient wallet balance. You have ₹${walletInfo.balance.toLocaleString('en-IN')} but this costs ₹${amount.toLocaleString('en-IN')}. Please top up your wallet first.`,
      });
    }

    // 2. Find any merchant to attach order to (use product.merchantId if available)
    let merchantDoc = product.merchantId
      ? await Merchant.findById(product.merchantId).lean()
      : await Merchant.findOne().lean();

    if (!merchantDoc) {
      return res.status(500).json({ success: false, error: 'No merchant available for order creation' });
    }

    // 3. Create Order record
    const orderId = `ORD-VOICE-${Date.now()}`;
    const mandateHash = `AP2-${Buffer.from(`${userId}:${product._id || product.title}:${amount}:${Date.now()}`).toString('base64').slice(0, 24)}`;

    const newOrder = await Order.create({
      merchant: merchantDoc._id,
      orderId,
      agentId: 'kairo_voice_agent',
      mandateHash,
      items: [{
        product: product._id || undefined,
        title: product.title,
        quantity: 1,
        price: amount,
        unitPrice: amount,
        totalPrice: amount,
      }],
      amount,
      status: 'paid',
      customer: { name: 'KAIRO Voice Buyer' },
      gateDecision: { passed: true, reason: 'AP2 autonomous voice mandate signed' },
    });

    // 4. Debit wallet atomically
    await walletService.debitWallet(
      userId,
      amount,
      orderId,
      `AP2 Voice Purchase: ${product.title}`
    );

    return res.status(200).json({
      success: true,
      orderId: newOrder.orderId,
      amount,
      product: product.title,
      mandateHash,
      message: `✅ AP2 mandate signed. ₹${amount.toLocaleString('en-IN')} debited. Order ${orderId} created!`,
    });
  } catch (error) {
    console.error('[VOICE_EXECUTE_PURCHASE_ERROR]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Transcribe audio via Groq Whisper fallback & parse voice intent
// @route   POST /api/voice/transcribe-audio
router.post('/transcribe-audio', upload.single('audio'), async (req, res) => {
  try {
    let audioBuffer = null;
    let mimeType = 'audio/webm';

    if (req.file) {
      audioBuffer = req.file.buffer;
      mimeType = req.file.mimetype || 'audio/webm';
    } else if (req.body.audioData) {
      // Base64 audio string fallback
      const base64Data = req.body.audioData.replace(/^data:audio\/\w+;base64,/, '');
      audioBuffer = Buffer.from(base64Data, 'base64');
      mimeType = req.body.mimeType || 'audio/webm';
    }

    if (!audioBuffer) {
      return res.status(400).json({
        success: false,
        error: 'Audio file (multipart field "audio") or base64 "audioData" is required',
      });
    }

    const transcript = await transcribeAudioWithWhisper(audioBuffer, mimeType);
    const userId = req.body.userId || req.headers['x-user-id'];
    let history = [];
    let lastContext = null;
    try {
      if (req.body.history) history = JSON.parse(req.body.history);
      if (req.body.lastContext) lastContext = JSON.parse(req.body.lastContext);
    } catch (e) {
      // ignore malformed history/context, proceed without it
    }

    const result = await parseVoiceIntent(transcript, userId, history, lastContext);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
