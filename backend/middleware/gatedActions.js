const Order = require('../models/Order');
const PolicyRule = require('../models/PolicyRule');
const { logAuditEvent } = require('./auditLogger');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

/**
 * Evaluate gated action controls: Manual approval thresholds and first-time buyer checks
 * @param {Object} params - { agentId, amount, merchantId, customerEmail, customerPhone }
 * @returns {Promise<Object>} Gated action evaluation result
 */
async function evaluateGatedAction(params = {}) {
  const {
    agentId = 'agent_anonymous',
    amount = 0,
    merchantId = null,
    customerEmail = null,
    customerPhone = null,
    defaultApprovalThreshold = 25000, // Default ₹25,000 threshold for manual merchant approval
    firstTimeBuyerLimit = 10000, // Default ₹10,000 limit for first-time buyer agent
  } = params;

  const numericAmount = Number(amount) || 0;
  const details = [];
  let decision = 'ALLOW';
  let reason = 'Action approved without gating';
  let isFirstTimeBuyer = false;
  let requireManualApproval = false;

  // 1. First-Time Buyer Check
  try {
    const buyerQueries = [];
    if (agentId && agentId !== 'agent_anonymous') {
      buyerQueries.push({ agentId });
    }
    if (customerEmail) {
      buyerQueries.push({ 'customer.email': customerEmail });
    }
    if (customerPhone) {
      buyerQueries.push({ 'customer.phone': customerPhone });
    }

    let priorOrderCount = 0;
    if (buyerQueries.length > 0) {
      priorOrderCount = await Order.countDocuments({
        $or: buyerQueries,
        status: { $in: ['paid', 'fulfilled'] },
      });
    }

    if (priorOrderCount === 0) {
      isFirstTimeBuyer = true;
      details.push({
        check: 'first_time_buyer',
        passed: numericAmount <= firstTimeBuyerLimit,
        isFirstTimeBuyer: true,
        priorOrderCount: 0,
        limit: firstTimeBuyerLimit,
        details: `First-time buyer status detected. Limit: ₹${firstTimeBuyerLimit}`,
      });

      if (numericAmount > firstTimeBuyerLimit) {
        decision = 'REQUIRE_APPROVAL';
        requireManualApproval = true;
        reason = `First-time buyer order amount ₹${numericAmount} exceeds threshold ₹${firstTimeBuyerLimit}. Manual merchant verification required.`;
      }
    } else {
      details.push({
        check: 'first_time_buyer',
        passed: true,
        isFirstTimeBuyer: false,
        priorOrderCount,
        details: `Verified returning buyer with ${priorOrderCount} prior successful order(s)`,
      });
    }
  } catch (err) {
    logger.warn('[GATED_ACTION_BUYER_CHECK_WARN] First-time buyer DB lookup skipped:', err.message);
  }

  // 2. Merchant & System Manual Approval Threshold Check
  let activeThreshold = defaultApprovalThreshold;
  if (merchantId) {
    try {
      const approvalRule = await PolicyRule.findOne({
        merchant: merchantId,
        ruleType: 'require_manual_approval',
        isActive: true,
      }).lean();

      if (approvalRule && approvalRule.requireApprovalThreshold !== undefined) {
        activeThreshold = approvalRule.requireApprovalThreshold;
      }
    } catch (err) {
      logger.warn('[GATED_ACTION_POLICY_WARN] Policy threshold lookup failed:', err.message);
    }
  }

  if (numericAmount >= activeThreshold) {
    requireManualApproval = true;
    if (decision !== 'BLOCK') {
      decision = 'REQUIRE_APPROVAL';
      reason = `Order amount ₹${numericAmount} reaches or exceeds manual approval threshold ₹${activeThreshold}`;
    }
    details.push({
      check: 'manual_approval_threshold',
      passed: false,
      threshold: activeThreshold,
      details: reason,
    });
  } else {
    details.push({
      check: 'manual_approval_threshold',
      passed: true,
      threshold: activeThreshold,
      details: `Amount ₹${numericAmount} is below manual approval threshold ₹${activeThreshold}`,
    });
  }

  return {
    protocol: 'AP2/x402',
    decision,
    requireManualApproval,
    isFirstTimeBuyer,
    reason,
    evaluatedAmount: numericAmount,
    activeThreshold,
    details,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Express middleware factory for gated action thresholds
 * @param {Object} options - { strictBlockOnApprovalRequired }
 */
function createGatedActionsMiddleware(options = {}) {
  const strictBlock = options.strictBlockOnApprovalRequired || false;

  return async (req, res, next) => {
    const amount = req.body.amount || req.body.orderAmount || 0;
    const agentId = req.headers['x-agent-id'] || req.body.agentId || 'agent_anonymous';
    const merchantId = req.body.merchantId || req.headers['x-merchant-id'] || null;
    const customerEmail = req.body.customer?.email || req.body.email || null;
    const customerPhone = req.body.customer?.phone || req.body.phone || null;

    const evaluation = await evaluateGatedAction({
      agentId,
      amount,
      merchantId,
      customerEmail,
      customerPhone,
      ...options,
    });

    req.gatedAction = evaluation;

    if (evaluation.decision !== 'ALLOW') {
      logger.info(`[GATED_ACTION] Decision: ${evaluation.decision} | Agent: ${agentId} | Reason: ${evaluation.reason}`);

      await logAuditEvent({
        correlationId: req.correlationId || null,
        agentId,
        merchant: merchantId,
        action: `GATED_ACTION ${req.method} ${req.originalUrl}`,
        decision: evaluation.decision,
        reason: evaluation.reason,
        ipAddress: req.ip || req.connection.remoteAddress || '',
        metadata: {
          amount,
          isFirstTimeBuyer: evaluation.isFirstTimeBuyer,
          requireManualApproval: evaluation.requireManualApproval,
        },
      });

      if (strictBlock) {
        return next(new AppError(evaluation.reason, 403, evaluation.decision));
      }
    }

    next();
  };
}

// Default exported middleware instance
const gatedActionsMiddleware = createGatedActionsMiddleware();

module.exports = {
  evaluateGatedAction,
  createGatedActionsMiddleware,
  gatedActionsMiddleware,
};
