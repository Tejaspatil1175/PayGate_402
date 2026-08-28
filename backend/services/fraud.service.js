const mongoose = require('mongoose');
const Order = require('../models/Order');
const { logAuditEvent } = require('../middleware/auditLogger');
const logger = require('../utils/logger');

// Memory cache for tracking rapid repeat transaction hashes (for replay anomaly detection)
const repeatTxCache = new Map();

// Cleanup repeat transaction cache every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [hash, timestamp] of repeatTxCache.entries()) {
    if (now - timestamp > 10 * 60 * 1000) {
      repeatTxCache.delete(hash);
    }
  }
}, 10 * 60 * 1000);

/**
 * Calculate anomaly risk score and determine payout hold status
 * @param {Object} txData - { orderId, merchantId, agentId, amount, customer, ipAddress }
 * @returns {Promise<Object>} Detailed fraud evaluation score and decision
 */
async function evaluateFraudRisk(txData = {}) {
  const {
    orderId = '',
    merchantId = null,
    agentId = 'agent_anonymous',
    amount = 0,
    customer = {},
    ipAddress = '',
  } = txData;

  const numericAmount = Number(amount) || 0;
  let riskScore = 0;
  const riskFactors = [];

  // 1. Rapid Repeat / Replay Transaction Anomaly Check (+25 points)
  const txSignature = `${agentId}:${merchantId}:${numericAmount}`;
  const now = Date.now();
  const lastSeen = repeatTxCache.get(txSignature);

  if (lastSeen && now - lastSeen < 10000) { // Same agent & amount within 10 seconds
    riskScore += 25;
    riskFactors.push({
      factor: 'RAPID_REPEAT_TRANSACTION',
      points: 25,
      description: 'Identical transaction repeated within 10 seconds (potential replay attempt)',
    });
  }
  repeatTxCache.set(txSignature, now);

  // 2. High Amount Anomaly Check (+20 to +35 points)
  if (numericAmount > 50000) {
    riskScore += 35;
    riskFactors.push({
      factor: 'HIGH_VALUE_TRANSACTION',
      points: 35,
      description: `Transaction amount ₹${numericAmount} exceeds standard high-value threshold (₹50,000)`,
    });
  } else if (numericAmount > 20000) {
    riskScore += 20;
    riskFactors.push({
      factor: 'ELEVATED_VALUE_TRANSACTION',
      points: 20,
      description: `Transaction amount ₹${numericAmount} exceeds elevated threshold (₹20,000)`,
    });
  }

  // 3. Velocity Anomaly Check (+15 to +30 points)
  try {
    const pastHour = new Date(Date.now() - 60 * 60 * 1000);
    const query = {
      createdAt: { $gte: pastHour },
    };
    if (agentId && agentId !== 'agent_anonymous') {
      query.agentId = agentId;
    }

    const recentOrderCount = await Order.countDocuments(query);
    if (recentOrderCount >= 10) {
      riskScore += 30;
      riskFactors.push({
        factor: 'EXTREME_VELOCITY_SPIKE',
        points: 30,
        description: `Agent submitted ${recentOrderCount} orders in the past 1 hour`,
      });
    } else if (recentOrderCount >= 5) {
      riskScore += 15;
      riskFactors.push({
        factor: 'HIGH_VELOCITY_PATTERN',
        points: 15,
        description: `Agent submitted ${recentOrderCount} orders in the past 1 hour`,
      });
    }
  } catch (err) {
    logger.warn('[FRAUD_VELOCITY_CHECK_WARN] DB velocity query skipped:', err.message);
  }

  // 4. Anonymous / Missing IP & Agent Metadata (+15 points)
  if (!ipAddress || ipAddress === '127.0.0.1' || agentId === 'agent_anonymous') {
    riskScore += 15;
    riskFactors.push({
      factor: 'UNVERIFIED_AGENT_METADATA',
      points: 15,
      description: 'Transaction originated from unverified agent identity or local/missing IP',
    });
  }

  // Cap max score at 100
  riskScore = Math.min(100, riskScore);

  // Determine Risk Level & Action
  let riskLevel = 'LOW';
  let payoutHold = false;
  let action = 'ALLOW';
  let decisionReason = 'Low fraud risk detected. Proceed with standard payout.';

  if (riskScore >= 70) {
    riskLevel = 'HIGH';
    payoutHold = true;
    action = 'PAYOUT_HOLD';
    decisionReason = `High fraud risk score (${riskScore}/100). Automatic payout hold triggered.`;
  } else if (riskScore >= 35) {
    riskLevel = 'MEDIUM';
    payoutHold = false;
    action = 'REVIEW';
    decisionReason = `Medium fraud risk score (${riskScore}/100). Flagged for monitoring.`;
  }

  const result = {
    protocol: 'AP2/x402',
    orderId,
    riskScore,
    riskLevel,
    action,
    payoutHold,
    decisionReason,
    riskFactors,
    evaluatedAt: new Date().toISOString(),
  };

  // Log Audit Event for Medium and High Risk
  if (riskScore >= 35) {
    await logAuditEvent({
      correlationId: orderId || null,
      agentId,
      merchant: merchantId,
      action: 'FRAUD_SCORING_EVALUATED',
      decision: payoutHold ? 'PAYOUT_HOLD' : 'ALLOW',
      reason: decisionReason,
      ipAddress,
      metadata: {
        riskScore,
        riskLevel,
        payoutHold,
        riskFactors,
      },
    });
  }

  return result;
}

/**
 * Apply payout hold to an order due to high fraud score
 * @param {string} orderId
 * @param {Object} fraudEvaluation
 * @returns {Promise<Object>} Updated order document
 */
async function placePayoutHold(orderId, fraudEvaluation = {}) {
  const isObjectId = mongoose.Types.ObjectId.isValid(orderId) && String(new mongoose.Types.ObjectId(orderId)) === orderId;
  const order = await Order.findOne(
    isObjectId
      ? { $or: [{ _id: orderId }, { orderId }, { razorpayOrderId: orderId }] }
      : { $or: [{ orderId }, { razorpayOrderId: orderId }] }
  );

  if (!order) {
    throw new Error('Order not found for payout hold');
  }

  order.gateDecision = {
    passed: !fraudEvaluation.payoutHold,
    reason: fraudEvaluation.decisionReason || 'Payout hold placed due to elevated risk',
    evaluatedAt: new Date(),
  };

  // Store fraud metadata on order
  order.markModified('gateDecision');
  await order.save();

  await logAuditEvent({
    correlationId: order.orderId,
    agentId: order.agentId,
    merchant: order.merchant,
    action: 'FRAUD_PAYOUT_HOLD_PLACED',
    decision: 'PAYOUT_HOLD',
    reason: `Fraud score: ${fraudEvaluation.riskScore || 'HIGH'}. Payout hold active.`,
    metadata: {
      fraudEvaluation,
    },
  });

  logger.warn(`[FRAUD_HOLD] Order ${order.orderId} placed on payout hold (Score: ${fraudEvaluation.riskScore})`);

  return order;
}

/**
 * Release payout hold after manual review
 * @param {string} orderId
 * @param {string} adminReason
 * @returns {Promise<Object>} Updated order
 */
async function releasePayoutHold(orderId, adminReason = 'Manual review passed') {
  const isObjectId = mongoose.Types.ObjectId.isValid(orderId) && String(new mongoose.Types.ObjectId(orderId)) === orderId;
  const order = await Order.findOne(
    isObjectId
      ? { $or: [{ _id: orderId }, { orderId }, { razorpayOrderId: orderId }] }
      : { $or: [{ orderId }, { razorpayOrderId: orderId }] }
  );

  if (!order) {
    throw new Error('Order not found');
  }

  order.gateDecision = {
    passed: true,
    reason: `Payout hold released: ${adminReason}`,
    evaluatedAt: new Date(),
  };

  order.markModified('gateDecision');
  await order.save();

  await logAuditEvent({
    correlationId: order.orderId,
    agentId: order.agentId,
    merchant: order.merchant,
    action: 'FRAUD_PAYOUT_HOLD_RELEASED',
    decision: 'ALLOW',
    reason: adminReason,
  });

  logger.info(`[FRAUD_HOLD_RELEASED] Order ${order.orderId} payout hold released`);

  return order;
}

module.exports = {
  evaluateFraudRisk,
  placePayoutHold,
  releasePayoutHold,
};
