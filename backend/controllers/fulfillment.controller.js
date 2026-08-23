const {
  processOrderFulfillment,
  getFulfillmentDetails,
} = require('../services/fulfillment.service');

// @desc    Process order fulfillment (post-payment tracking hook)
// @route   POST /api/agent/fulfillment/:id/fulfill
exports.triggerFulfillment = async (req, res) => {
  try {
    const { carrier, trackingNumber, estimatedDeliveryDays } = req.body;
    const result = await processOrderFulfillment(req.params.id, {
      carrier,
      trackingNumber,
      estimatedDeliveryDays,
    });

    res.status(200).json({
      protocol: 'AP2/x402',
      success: true,
      message: 'Fulfillment processed successfully',
      receipt: result.digitalReceipt,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get delivery tracking and digital receipt for order
// @route   GET /api/agent/fulfillment/:id
exports.getFulfillmentStatus = async (req, res) => {
  try {
    const result = await getFulfillmentDetails(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
