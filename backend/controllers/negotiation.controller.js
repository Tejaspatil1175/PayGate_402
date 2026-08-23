const {
  initiateNegotiation,
  respondToNegotiation,
} = require('../services/negotiation.service');
const Negotiation = require('../models/Negotiation');

// @desc    Initiate negotiation / submit counter offer
// @route   POST /api/agent/negotiation
exports.initiate = async (req, res) => {
  try {
    const { intentId, productId, proposedPrice, quantity } = req.body;
    const agentId = req.body.agentId || req.headers['x-agent-id'];

    if (!intentId || !productId || proposedPrice === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Please provide intentId, productId, and proposedPrice',
      });
    }

    const negotiation = await initiateNegotiation({
      intentId,
      productId,
      proposedPrice: parseFloat(proposedPrice),
      quantity: parseInt(quantity, 10) || 1,
      agentId,
    });

    res.status(201).json({
      protocol: 'AP2/x402',
      success: true,
      message: `Negotiation status: ${negotiation.status}`,
      negotiation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Respond to open negotiation (accept, reject, counter)
// @route   POST /api/agent/negotiation/:id/respond
exports.respond = async (req, res) => {
  try {
    const { sender = 'agent', action, counterPrice, note } = req.body;

    if (!action || !['accept', 'reject', 'counter'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: "Action must be 'accept', 'reject', or 'counter'",
      });
    }

    const negotiation = await respondToNegotiation(req.params.id, {
      sender,
      action,
      counterPrice: counterPrice ? parseFloat(counterPrice) : null,
      note,
    });

    res.status(200).json({
      protocol: 'AP2/x402',
      success: true,
      message: `Negotiation updated to ${negotiation.status}`,
      negotiation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get negotiation details
// @route   GET /api/agent/negotiation/:id
exports.getDetails = async (req, res) => {
  try {
    const negotiation = await Negotiation.findById(req.params.id)
      .populate('intent')
      .populate('product')
      .populate('merchant', 'businessName email phone');

    if (!negotiation) {
      return res.status(404).json({
        success: false,
        error: 'Negotiation not found',
      });
    }

    res.status(200).json({
      protocol: 'AP2/x402',
      success: true,
      negotiation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
