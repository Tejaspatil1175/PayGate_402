const Razorpay = require('razorpay');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Get an instance of Razorpay SDK using env or merchant credentials
 * @param {Object} [credentials] - { keyId, keySecret }
 * @returns {Razorpay}
 */
function getRazorpayInstance(credentials = {}) {
  const keyId = credentials.keyId || process.env.RAZORPAY_KEY_ID;
  const keySecret = credentials.keySecret || process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    logger.warn('Razorpay API keys not configured. Falling back to test mode defaults.');
  }

  return new Razorpay({
    key_id: keyId || 'rzp_test_placeholder',
    key_secret: keySecret || 'secret_placeholder',
  });
}

/**
 * Create a new Razorpay Order (gated after AP2/x402 contract verification)
 * @param {Object} params - { amount, currency, receipt, notes, credentials }
 * @returns {Promise<Object>} Razorpay Order Object
 */
async function createRazorpayOrder(params) {
  const { amount, currency = 'INR', receipt, notes = {}, credentials } = params;

  if (!amount || amount <= 0) {
    throw new Error('Order amount must be greater than zero');
  }

  const razorpay = getRazorpayInstance(credentials);

  // Razorpay expects amount in minor units (e.g. ₹100 = 10000 paise)
  const amountInPaise = Math.round(amount * 100);

  const orderOptions = {
    amount: amountInPaise,
    currency: currency.toUpperCase(),
    receipt: receipt || `receipt_${Date.now()}`,
    notes: {
      protocol: 'AP2/x402',
      gateStatus: 'PASSED',
      ...notes,
    },
  };

  try {
    const order = await razorpay.orders.create(orderOptions);
    logger.info(`[RAZORPAY] Created order ${order.id} for ₹${amount} (${order.amount} paise)`);
    return order;
  } catch (error) {
    logger.error('[RAZORPAY] Order creation failed:', error.message || error);
    throw new Error(`Razorpay Order creation failed: ${error.description || error.message}`);
  }
}

/**
 * Fetch Razorpay order details by Order ID
 * @param {string} orderId
 * @param {Object} [credentials]
 * @returns {Promise<Object>}
 */
async function fetchRazorpayOrder(orderId, credentials) {
  const razorpay = getRazorpayInstance(credentials);
  try {
    return await razorpay.orders.fetch(orderId);
  } catch (error) {
    logger.error(`[RAZORPAY] Fetch order failed for ${orderId}:`, error.message);
    throw new Error(`Failed to fetch Razorpay order ${orderId}`);
  }
}

/**
 * Verify Razorpay Webhook HMAC-SHA256 signature
 * @param {string|Buffer} body - Raw body payload
 * @param {string} signature - X-Razorpay-Signature header value
 * @param {string} [secret] - Webhook secret
 * @returns {boolean}
 */
function verifyWebhookSignature(body, signature, secret) {
  const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret || !signature) {
    logger.warn('Webhook secret or signature missing for verification');
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(typeof body === 'string' ? body : JSON.stringify(body))
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch (error) {
    logger.error('Error verifying Razorpay webhook signature:', error.message);
    return false;
  }
}

module.exports = {
  getRazorpayInstance,
  createRazorpayOrder,
  fetchRazorpayOrder,
  verifyWebhookSignature,
};
