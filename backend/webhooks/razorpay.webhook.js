const { verifyWebhookSignature } = require('../services/razorpay.service');
const Order = require('../models/Order');
const { logAuditEvent } = require('../middleware/auditLogger');
const logger = require('../utils/logger');

/**
 * Handle incoming Razorpay Webhook notifications
 * @route POST /api/webhooks/razorpay
 */
async function handleRazorpayWebhook(req, res) {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.body;

  // 1. Verify HMAC-SHA256 signature against raw Buffer / string payload
  if (!signature) {
    logger.warn('[SECURITY_WEBHOOK_REJECTED] Missing X-Razorpay-Signature header');
    return res.status(400).json({ success: false, error: 'Missing webhook signature header' });
  }

  const isValid = verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    logger.warn('[SECURITY_WEBHOOK_REJECTED] Invalid Razorpay webhook signature detected');
    return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
  }

  // Parse JSON from raw payload
  let body;
  try {
    body = Buffer.isBuffer(rawBody) ? JSON.parse(rawBody.toString('utf8')) : (typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody);
  } catch (err) {
    logger.error('[SECURITY_WEBHOOK_ERROR] Failed to parse webhook JSON payload:', err.message);
    return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
  }

  const event = body.event;
  const payload = body.payload;

  logger.info(`[WEBHOOK] Received Razorpay event: ${event}`);


  try {
    if (event === 'payment.captured' || event === 'payment.authorized') {
      const paymentEntity = payload.payment?.entity || {};
      const razorpayOrderId = paymentEntity.order_id;
      const razorpayPaymentId = paymentEntity.id;
      const amountInRupees = (paymentEntity.amount || 0) / 100;
      const notes = paymentEntity.notes || {};

      // Route 1: Wallet Top-Up Payment
      if (notes.purpose === 'wallet_topup' && notes.userId) {
        const walletService = require('../services/wallet.service');
        await walletService.creditWallet(
          notes.userId,
          amountInRupees,
          razorpayPaymentId,
          'Razorpay Wallet Top-up'
        );

        await logAuditEvent({
          correlationId: razorpayOrderId || razorpayPaymentId,
          agentId: 'user_wallet',
          action: 'WALLET_TOPUP_SUCCESS',
          decision: 'ALLOW',
          reason: `Razorpay webhook confirmed wallet top-up of ₹${amountInRupees}`,
          metadata: {
            event,
            userId: notes.userId,
            razorpayPaymentId,
            amount: amountInRupees,
          },
        });

        logger.info(`[WEBHOOK] Credited ₹${amountInRupees} to wallet for user ${notes.userId}`);
      } else if (razorpayOrderId) {
        // Route 2: Direct Merchant / Cart Purchase Payment
        const order = await Order.findOne({ razorpayOrderId });

        if (order) {
          order.status = 'paid';
          order.razorpayPaymentId = razorpayPaymentId;
          await order.save();

          await logAuditEvent({
            correlationId: order.mandateHash || razorpayOrderId,
            agentId: order.agentId,
            merchant: order.merchant,
            mandateHash: order.mandateHash,
            razorpayOrderId,
            razorpayPaymentId,
            action: 'PAYMENT_CAPTURED',
            decision: 'ALLOW',
            reason: `Razorpay webhook confirmed payment capture for ₹${amountInRupees}`,
            metadata: {
              event,
              razorpayPaymentId,
              email: paymentEntity.email,
              contact: paymentEntity.contact,
            },
          });

          logger.info(`[WEBHOOK] Order ${order.orderId} updated to PAID`);
        }
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload.payment?.entity || {};
      const razorpayOrderId = paymentEntity.order_id;

      if (razorpayOrderId) {
        const order = await Order.findOne({ razorpayOrderId });
        if (order) {
          order.status = 'failed';
          await order.save();

          await logAuditEvent({
            correlationId: order.mandateHash || razorpayOrderId,
            agentId: order.agentId,
            merchant: order.merchant,
            mandateHash: order.mandateHash,
            razorpayOrderId,
            action: 'PAYMENT_FAILED',
            decision: 'BLOCK',
            reason: `Payment failed: ${paymentEntity.error_description || 'Unknown error'}`,
            metadata: {
              event,
              error: paymentEntity.error_code,
            },
          });
        }
      }
    }

    res.status(200).json({ success: true, received: true });
  } catch (error) {
    logger.error('[WEBHOOK] Error processing Razorpay webhook:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = handleRazorpayWebhook;
