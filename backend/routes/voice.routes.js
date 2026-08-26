const express = require('express');
const router = express.Router();
const multer = require('multer');
const { transcribeAudioWithWhisper, parseVoiceIntent } = require('../services/voiceIntent.service');

// Memory storage for multer audio uploads
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max audio size
});

// @desc    Parse structured intent directly from transcript text with numerical confirmation check
// @route   POST /api/voice/parse-text
router.post('/parse-text', async (req, res) => {
  try {
    const { text, userId } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text transcript is required',
      });
    }

    const result = await parseVoiceIntent(text, userId);

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

    const result = await parseVoiceIntent(transcript, userId);

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
