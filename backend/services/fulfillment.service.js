const Order = require('../models/Order');
const { logAuditEvent } = require('../middleware/auditLogger');
const { generateNonce } = require('../utils/crypto');
const logger = require('../utils/logger');

/**
 * Process post-payment fulfillment confirmation and generate delivery tracking details
 * @param {string} orderId - MongoDB ID or Order string
 * @param {Object} [data] - { trackingProvider, shippingAddress, notes }
 * @returns {Promise<Object>} Updated order with digital receipt
 */
async function processOrderFulfillment(orderId, data = {}) {
  const order = await Order.findOne({
    $or: [{ _id: orderId }, { orderId }, { razorpayOrderId: orderId }],
  }).populate('merchant', 'businessName email phone');

  if (!order) {
    throw new Error('Order not found for fulfillment');
  }

  if (order.status !== 'paid' && order.status !== 'fulfilled') {
    throw new Error(`Cannot fulfill order in '${order.status}' status. Payment must be confirmed first.`);
  }

  const trackingNumber = data.trackingNumber || `TRK_${generateNonce().substring(0, 12).toUpperCase()}`;
  const carrier = data.carrier || 'Express Courier';
  const estimatedDeliveryDays = data.estimatedDeliveryDays || 3;
  const estimatedDelivery = new Date(Date.now() + estimatedDeliveryDays * 24 * 60 * 60 * 1000);

  order.status = 'fulfilled';
  await order.save();

  const digitalReceipt = {
    protocol: 'AP2/x402',
    receiptId: `rcpt_${generateNonce().substring(0, 16)}`,
    orderId: order.orderId,
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: order.razorpayPaymentId,
    mandateHash: order.mandateHash,
    merchant: {
      id: order.merchant?._id,
      name: order.merchant?.businessName || 'Merchant',
    },
    items: order.items,
    totalPaid: {
      amount: order.amount,
      currency: order.currency || 'INR',
    },
    fulfillment: {
      status: 'fulfilled',
      carrier,
      trackingNumber,
      estimatedDelivery: estimatedDelivery.toISOString(),
      shippedAt: new Date().toISOString(),
    },
  };

  await logAuditEvent({
    correlationId: order.mandateHash || order.orderId,
    agentId: order.agentId,
    merchant: order.merchant?._id,
    mandateHash: order.mandateHash,
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: order.razorpayPaymentId,
    action: 'ORDER_FULFILLED',
    decision: 'ALLOW',
    reason: `Fulfillment processed. Tracking #: ${trackingNumber}`,
    metadata: {
      trackingNumber,
      carrier,
      receiptId: digitalReceipt.receiptId,
    },
  });

  logger.info(`[FULFILLMENT] Order ${order.orderId} fulfilled with tracking ${trackingNumber}`);

  return {
    order,
    digitalReceipt,
  };
}

/**
 * Get fulfillment and delivery tracking status for an order
 * @param {string} orderId
 * @returns {Promise<Object>}
 */
async function getFulfillmentDetails(orderId) {
  const order = await Order.findOne({
    $or: [{ _id: orderId }, { orderId }, { razorpayOrderId: orderId }],
  }).populate('merchant', 'businessName email phone');

  if (!order) {
    throw new Error('Order not found');
  }

  return {
    protocol: 'AP2/x402',
    orderId: order.orderId,
    status: order.status,
    mandateHash: order.mandateHash,
    razorpayPaymentId: order.razorpayPaymentId,
    isFulfilled: order.status === 'fulfilled',
    customer: order.customer,
    merchant: {
      name: order.merchant?.businessName,
      email: order.merchant?.email,
    },
  };
}

module.exports = {
  processOrderFulfillment,
  getFulfillmentDetails,
};
