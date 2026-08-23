const Intent = require('../models/Intent');
const { generateNonce } = require('../utils/crypto');
const { logAuditEvent } = require('../middleware/auditLogger');

// @desc    Submit new purchase intent (AI Buyer Agent interface)
// @route   POST /api/agent/intent
exports.submitIntent = async (req, res) => {
  try {
    const {
      agentId,
      userPublicKey,
      category,
      keywords,
      budgetCap,
      currency,
      merchantPreferences,
      expiresInMinutes,
      signature,
    } = req.body;

    const agentIdentifier = agentId || req.headers['x-agent-id'];

    if (!agentIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID is required (in body or X-Agent-ID header)',
      });
    }

    if (!budgetCap || parseFloat(budgetCap) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid budgetCap is required',
      });
    }

    const nonce = generateNonce();
    const expiryTime = new Date(
      Date.now() + (parseInt(expiresInMinutes, 10) || 60) * 60 * 1000
    );

    const intent = await Intent.create({
      agentId: agentIdentifier,
      userPublicKey: userPublicKey || '',
      category: category || 'General',
      keywords: Array.isArray(keywords)
        ? keywords
        : (keywords || '').split(',').map((k) => k.trim()).filter(Boolean),
      budgetCap: parseFloat(budgetCap),
      currency: currency || 'INR',
      merchantPreferences: merchantPreferences || [],
      expiresAt: expiryTime,
      nonce,
      signature: signature || '',
      status: 'submitted',
    });

    await logAuditEvent({
      correlationId: nonce,
      agentId: agentIdentifier,
      action: 'INTENT_SUBMITTED',
      decision: 'ALLOW',
      reason: `Purchase intent submitted with budget cap ₹${budgetCap}`,
      metadata: {
        intentId: intent._id,
        category: intent.category,
        budgetCap: intent.budgetCap,
      },
    });

    res.status(201).json({
      protocol: 'AP2/x402',
      success: true,
      message: 'Purchase intent submitted successfully',
      intent: {
        id: intent._id,
        agentId: intent.agentId,
        category: intent.category,
        keywords: intent.keywords,
        budgetCap: intent.budgetCap,
        currency: intent.currency,
        status: intent.status,
        expiresAt: intent.expiresAt,
        nonce: intent.nonce,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get single purchase intent details
// @route   GET /api/agent/intent/:id
exports.getIntentById = async (req, res) => {
  try {
    const intent = await Intent.findById(req.params.id);

    if (!intent) {
      return res.status(404).json({
        success: false,
        error: 'Purchase intent not found',
      });
    }

    res.status(200).json({
      protocol: 'AP2/x402',
      success: true,
      intent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    List intents by agent ID
// @route   GET /api/agent/intent
exports.getAgentIntents = async (req, res) => {
  try {
    const agentId = req.query.agentId || req.headers['x-agent-id'];
    const filter = agentId ? { agentId } : {};

    const intents = await Intent.find(filter).sort({ createdAt: -1 }).limit(50);

    res.status(200).json({
      protocol: 'AP2/x402',
      success: true,
      count: intents.length,
      intents,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
