const Order = require('../models/Order');
const { logAuditEvent } = require('./auditLogger');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

// Memory store for tracking agent/IP velocity metrics
const velocityStore = new Map();

// Periodic cleanup of expired velocity windows (runs every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of velocityStore.entries()) {
    if (now > record.resetTime) {
      velocityStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Evaluate transaction guardrails for an agent transaction
 * @param {Object} params - { agentId, amount, merchantId, windowMs, maxSingleAmount, maxRequestsPerWindow, maxCumulativeSpendPerWindow }
 * @returns {Promise<Object>} Guardrail evaluation result
 */
async function checkTransactionGuardrails(params) {
  const {
    agentId = 'agent_anonymous',
    amount = 0,
    merchantId = null,
    windowMs = 15 * 60 * 1000, // 15 minutes window
    maxSingleAmount = 100000, // Max ₹1,00,000 per transaction
    maxRequestsPerWindow = 10, // Max 10 transactions per 15 minutes
    maxCumulativeSpendPerWindow = 200000, // Max ₹2,00,000 aggregate spend per 15 minutes
  } = params;

  const numericAmount = Number(amount) || 0;
  const checks = [];
  let passed = true;
  let blockReason = '';

  // 1. Single Transaction Bounded Limit Check
  if (numericAmount > maxSingleAmount) {
    passed = false;
    blockReason = `Transaction amount ₹${numericAmount} exceeds maximum single transaction guardrail cap of ₹${maxSingleAmount}`;
    checks.push({
      rule: 'max_single_transaction_bound',
      passed: false,
      details: blockReason,
    });
  } else {
    checks.push({
      rule: 'max_single_transaction_bound',
      passed: true,
      details: `Amount ₹${numericAmount} <= max single limit ₹${maxSingleAmount}`,
    });
  }

  if (!passed) {
    return { passed: false, reason: blockReason, checks };
  }

  // 2. Memory Store Velocity Check (Frequency & Immediate Spend)
  const now = Date.now();
  const storeKey = `guardrail:${agentId}`;
  let record = velocityStore.get(storeKey);

  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      totalSpend: 0,
      resetTime: now + windowMs,
    };
  }

  const projectedCount = record.count + 1;
  const projectedMemorySpend = record.totalSpend + numericAmount;

  if (projectedCount > maxRequestsPerWindow) {
    passed = false;
    blockReason = `Transaction velocity limit exceeded: ${projectedCount} requests in window (max allowed: ${maxRequestsPerWindow})`;
    checks.push({
      rule: 'transaction_frequency_velocity',
      passed: false,
      details: blockReason,
    });
  } else {
    checks.push({
      rule: 'transaction_frequency_velocity',
      passed: true,
      details: `Request count ${projectedCount}/${maxRequestsPerWindow} within velocity window`,
    });
  }

  if (projectedMemorySpend > maxCumulativeSpendPerWindow) {
    passed = false;
    blockReason = `Cumulative transaction spend velocity exceeded: projected window spend ₹${projectedMemorySpend} (max allowed: ₹${maxCumulativeSpendPerWindow})`;
    checks.push({
      rule: 'cumulative_spend_velocity',
      passed: false,
      details: blockReason,
    });
  } else {
    checks.push({
      rule: 'cumulative_spend_velocity',
      passed: true,
      details: `Projected spend ₹${projectedMemorySpend} <= cumulative window limit ₹${maxCumulativeSpendPerWindow}`,
    });
  }

  if (!passed) {
    return { passed: false, reason: blockReason, checks };
  }

  // 3. Database Historical Velocity Check (DB aggregate spend in window)
  try {
    const windowStartDate = new Date(now - windowMs);
    const query = {
      createdAt: { $gte: windowStartDate },
      status: { $in: ['paid', 'created', 'fulfilled'] },
    };

    if (agentId && agentId !== 'agent_anonymous') {
      query.agentId = agentId;
    }

    const recentOrders = await Order.find(query).lean();
    const dbWindowSpend = recentOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const totalProjectedSpend = dbWindowSpend + numericAmount;

    if (totalProjectedSpend > maxCumulativeSpendPerWindow) {
      passed = false;
      blockReason = `Historical DB spend velocity exceeded: total spend in window ₹${totalProjectedSpend} exceeds cap ₹${maxCumulativeSpendPerWindow}`;
      checks.push({
        rule: 'historical_db_spend_velocity',
        passed: false,
        details: blockReason,
      });
    } else {
      checks.push({
        rule: 'historical_db_spend_velocity',
        passed: true,
        details: `Historical DB window spend ₹${totalProjectedSpend} <= cap ₹${maxCumulativeSpendPerWindow}`,
      });
    }
  } catch (err) {
    logger.warn('[GUARDRAIL_DB_CHECK_WARN] DB velocity lookup skipped:', err.message);
  }

  if (!passed) {
    return { passed: false, reason: blockReason, checks };
  }

  // Record successful velocity check in memory
  record.count = projectedCount;
  record.totalSpend = projectedMemorySpend;
  velocityStore.set(storeKey, record);

  return {
    passed: true,
    reason: 'All transaction guardrails passed',
    checks,
  };
}

/**
 * Express middleware factory for transaction guardrails
 * @param {Object} options
 */
function createTransactionGuardrails(options = {}) {
  return async (req, res, next) => {
    // Extract transaction metadata from body/headers
    const amount = req.body.amount || req.body.orderAmount || (req.body.items ? req.body.items.reduce((s, i) => s + (i.price * i.quantity), 0) : 0);
    const agentId = req.headers['x-agent-id'] || req.body.agentId || 'agent_anonymous';
    const merchantId = req.body.merchantId || req.headers['x-merchant-id'] || null;

    const evaluation = await checkTransactionGuardrails({
      agentId,
      amount,
      merchantId,
      ...options,
    });

    if (!evaluation.passed) {
      logger.warn(`[GUARDRAIL_BLOCK] Agent: ${agentId} | Amount: ₹${amount} | Reason: ${evaluation.reason}`);

      await logAuditEvent({
        correlationId: req.correlationId || null,
        agentId,
        merchant: merchantId,
        action: `GUARDRAIL_CHECK ${req.method} ${req.originalUrl}`,
        decision: 'BLOCK',
        reason: evaluation.reason,
        ipAddress: req.ip || req.connection.remoteAddress || '',
        metadata: {
          amount,
          checks: evaluation.checks,
        },
      });

      return next(new AppError(evaluation.reason, 400, 'BLOCK'));
    }

    req.guardrailCheck = evaluation;
    next();
  };
}

// Default exported middleware instance
const transactionGuardrails = createTransactionGuardrails();

module.exports = {
  checkTransactionGuardrails,
  createTransactionGuardrails,
  transactionGuardrails,
};
