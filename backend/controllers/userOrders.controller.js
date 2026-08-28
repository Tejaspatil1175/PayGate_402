const mongoose = require('mongoose');
const Order = require('../models/Order');
const { getFulfillmentDetails } = require('../services/fulfillment.service');

// Helper to extract userId or customer email from request
function getUserIdFromReq(req) {
  return req.query.userId || req.headers['x-user-id'] || req.query.email || req.body.userId;
}

// @desc    Get buyer's order history
// @route   GET /api/user-orders
exports.getUserOrders = async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID or email is required (via ?userId= or header x-user-id)',
      });
    }

    const orders = await Order.find({
      $or: [
        { 'customer.id': userId },
        { 'customer.email': userId },
        { agentId: userId },
      ],
    })
      .sort({ createdAt: -1 })
      .populate('merchant', 'businessName email phone businessCategory')
      .lean();

    res.status(200).json({
      protocol: 'AP2/x402',
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get order details and live fulfillment tracking timeline
// @route   GET /api/user-orders/:orderId
exports.getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const isObjectId = mongoose.Types.ObjectId.isValid(orderId) && String(new mongoose.Types.ObjectId(orderId)) === orderId;
    const order = await Order.findOne(
      isObjectId
        ? { $or: [{ _id: orderId }, { orderId }, { razorpayOrderId: orderId }] }
        : { $or: [{ orderId }, { razorpayOrderId: orderId }] }
    )
      .populate('merchant', 'businessName email phone businessCategory')
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    const fulfillment = await getFulfillmentDetails(order._id);

    // Build timeline steps
    const timeline = [
      { step: 'Order Placed', completed: true, timestamp: order.createdAt },
      { step: 'Mandate Verified & Wallet Settled', completed: true, timestamp: order.createdAt },
      { step: 'Merchant Processing', completed: order.status === 'paid' || order.status === 'fulfilled' },
      { step: 'Out for Delivery / Fulfilled', completed: order.status === 'fulfilled' },
    ];

    res.status(200).json({
      success: true,
      order,
      fulfillment,
      timeline,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
