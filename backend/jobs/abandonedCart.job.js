const Contract = require('../models/Contract');
const Order = require('../models/Order');
const { logAuditEvent } = require('../middleware/auditLogger');
const logger = require('../utils/logger');

let cronIntervalId = null;

/**
 * Scan database for signed-but-unpaid contracts and trigger recovery nudges
 * @param {Object} options - { abandonedThresholdMinutes, maxRecoveryAttempts }
 * @returns {Promise<Object>} Summary of processed abandoned contracts
 */
async function runAbandonedCartRecovery(options = {}) {
  const {
    abandonedThresholdMinutes = 15,
    maxRecoveryAttempts = 3,
  } = options;

  const now = new Date();
  const thresholdDate = new Date(now.getTime() - abandonedThresholdMinutes * 60 * 1000);

  try {
    // Find contracts that are signed/draft, created before thresholdDate, and not expired
    const abandonedContracts = await Contract.find({
      status: { $in: ['signed', 'draft'] },
      createdAt: { $lte: thresholdDate },
      expiresAt: { $gt: now },
    }).populate('merchant', 'businessName email');

    logger.info(`[ABANDONED_CART_JOB] Found ${abandonedContracts.length} potential abandoned contract(s) eligible for recovery`);

    const recoveryResults = [];

    for (const contract of abandonedContracts) {
      // Check corresponding order status
      const existingOrder = await Order.findOne({ mandateHash: contract.mandateHash }).lean();
      
      // Skip if order is already paid or fulfilled
      if (existingOrder && (existingOrder.status === 'paid' || existingOrder.status === 'fulfilled')) {
        continue;
      }

      // Generate 5% recovery incentive
      const agreedAmount = contract.contractTerms?.agreedAmount || 0;
      const recoveryDiscountPercent = 5;
      const recoveryDiscountAmount = Math.round((agreedAmount * recoveryDiscountPercent) / 100);
      const discountedAgreedAmount = Math.max(0, agreedAmount - recoveryDiscountAmount);

      const recoveryPayload = {
        contractId: contract.contractId,
        mandateHash: contract.mandateHash,
        agentId: contract.agentId,
        merchant: {
          id: contract.merchant?._id,
          name: contract.merchant?.businessName || 'Merchant',
        },
        originalAgreedAmount: agreedAmount,
        recoveryIncentive: {
          code: 'RECOVER5',
          discountPercent: recoveryDiscountPercent,
          discountAmount: recoveryDiscountAmount,
          discountedAmount: discountedAgreedAmount,
        },
        status: contract.status,
        remindedAt: now.toISOString(),
      };

      await logAuditEvent({
        correlationId: contract.mandateHash || contract.contractId,
        agentId: contract.agentId,
        merchant: contract.merchant?._id,
        action: 'ABANDONED_CONTRACT_RECOVERY_NUDGE',
        decision: 'ALLOW',
        reason: `Recovery nudge dispatched for signed-but-unpaid contract. Offered ${recoveryDiscountPercent}% incentive code RECOVER5.`,
        metadata: recoveryPayload,
      });

      recoveryResults.push(recoveryPayload);
    }

    return {
      protocol: 'AP2/x402',
      processedCount: abandonedContracts.length,
      recoveredCount: recoveryResults.length,
      recoveries: recoveryResults,
      executedAt: now.toISOString(),
    };
  } catch (error) {
    logger.error('[ABANDONED_CART_JOB_ERROR] Failed to run abandoned contract recovery pass:', error.message);
    throw error;
  }
}

/**
 * Start periodic background cron job for abandoned cart recovery
 * @param {number} intervalMinutes
 */
function startAbandonedCartCron(intervalMinutes = 15) {
  if (cronIntervalId) {
    logger.warn('[ABANDONED_CART_JOB] Scheduler is already running');
    return;
  }

  const intervalMs = intervalMinutes * 60 * 1000;
  logger.info(`[ABANDONED_CART_JOB] Starting recovery scheduler (running every ${intervalMinutes} mins)`);

  cronIntervalId = setInterval(async () => {
    try {
      await runAbandonedCartRecovery();
    } catch (err) {
      logger.error('[ABANDONED_CART_JOB_CRON_ERR]', err.message);
    }
  }, intervalMs);
}

/**
 * Stop periodic background cron job
 */
function stopAbandonedCartCron() {
  if (cronIntervalId) {
    clearInterval(cronIntervalId);
    cronIntervalId = null;
    logger.info('[ABANDONED_CART_JOB] Stopped recovery scheduler');
  }
}

module.exports = {
  runAbandonedCartRecovery,
  startAbandonedCartCron,
  stopAbandonedCartCron,
};
