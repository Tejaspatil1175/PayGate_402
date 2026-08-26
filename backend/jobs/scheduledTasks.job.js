const cron = require('node-cron');
const { getPendingTasksToExecute, updateTaskExecutionStatus } = require('../services/scheduler.service');
const { matchIntentToMerchants } = require('../services/matching.service');
const { initiateNegotiation } = require('../services/negotiation.service');
const { createCommerceContract } = require('../services/contract.service');
const { debitWallet, getWalletBalance } = require('../services/wallet.service');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { generateNonce } = require('../utils/crypto');
const logger = require('../utils/logger');

/**
 * Execute a single scheduled task through the full search -> match -> negotiate -> contract -> wallet loop
 * @param {Object} task - ScheduledTask document
 */
async function executeSingleScheduledTask(task) {
  logger.info(`[SCHEDULED_JOB] Processing task "${task.taskName}" (${task._id}) for user ${task.user?._id || task.user}`);

  const userId = task.user?._id || task.user;
  const { category, itemKeywords, budgetCap } = task.intent;

  try {
    // 1. FRESH WALLET BALANCE CHECK (do not rely on cached values)
    const wallet = await getWalletBalance(userId);
    if (wallet.balance < budgetCap) {
      throw new Error(`Insufficient wallet balance at execution time. Available: ₹${wallet.balance}, Required: ₹${budgetCap}`);
    }

    // 2. FRESH SEARCH & MATCHING
    const matches = await matchIntentToMerchants({
      category,
      keywords: itemKeywords.trim().split(/\s+/),
      budgetCap,
      userId,
    });

    if (!matches || matches.length === 0) {
      throw new Error('No matching merchant products found within budget cap at execution time');
    }

    const topMatch = matches[0];
    const productId = topMatch.product.id;

    // 3. FRESH PRODUCT & STOCK RE-VERIFICATION
    const freshProduct = await Product.findById(productId);
    if (!freshProduct || !freshProduct.isAvailable) {
      throw new Error('Matched product is no longer available in catalog');
    }
    if ((freshProduct.stock || 0) <= 0) {
      throw new Error('Matched product is out of stock at execution time');
    }
    if (freshProduct.price > budgetCap) {
      throw new Error(`Product price ₹${freshProduct.price} increased beyond scheduled budget cap ₹${budgetCap}`);
    }

    // 4. AUTO-NEGOTIATION FLOW
    const negotiation = await initiateNegotiation({
      merchantId: topMatch.merchant.id,
      productId: freshProduct._id,
      proposedPrice: Math.min(freshProduct.price, budgetCap),
      agentId: 'scheduled_cron_agent',
    });

    const finalPrice = negotiation.agreedPrice || freshProduct.price;

    // Re-check wallet balance against final negotiated price
    if (wallet.balance < finalPrice) {
      throw new Error(`Insufficient wallet balance for final negotiated price ₹${finalPrice}`);
    }

    // 5. GENERATE & SIGN COMMERCE CONTRACT
    const contract = await createCommerceContract({
      merchantId: topMatch.merchant.id,
      agentId: 'scheduled_cron_agent',
      items: [
        {
          product: freshProduct._id,
          title: freshProduct.title,
          quantity: 1,
          price: finalPrice,
        },
      ],
      agreedAmount: finalPrice,
      currency: freshProduct.currency || 'INR',
      userId,
    });

    // 6. ATOMIC WALLET DEBIT
    await debitWallet(
      userId,
      finalPrice,
      contract.contractId,
      `Scheduled purchase: ${task.taskName}`
    );

    // 7. CREATE PAID ORDER RECORD
    const orderDoc = await Order.create({
      merchant: topMatch.merchant.id,
      orderId: `ord_${generateNonce().substring(0, 12)}`,
      razorpayOrderId: `sched_${generateNonce().substring(0, 12)}`,
      mandateHash: contract.mandateHash,
      agentId: 'scheduled_cron_agent',
      items: [
        {
          product: freshProduct._id,
          title: freshProduct.title,
          quantity: 1,
          price: finalPrice,
        },
      ],
      amount: finalPrice,
      currency: freshProduct.currency || 'INR',
      status: 'paid',
      gateDecision: {
        passed: true,
        reason: 'Scheduled task executed successfully via automated cron loop',
      },
    });

    // Decrement stock
    freshProduct.stock = Math.max(0, freshProduct.stock - 1);
    await freshProduct.save();

    // 8. UPDATE TASK LOG AS EXECUTED
    await updateTaskExecutionStatus(task._id, 'executed', {
      orderId: orderDoc._id,
    });

    logger.info(`[SCHEDULED_JOB_SUCCESS] Task "${task.taskName}" executed. Order: ${orderDoc.orderId}`);
    return orderDoc;
  } catch (error) {
    logger.warn(`[SCHEDULED_JOB_FAILED] Task "${task.taskName}" failed execution: ${error.message}`);
    await updateTaskExecutionStatus(task._id, 'failed', {
      errorMessage: error.message,
    });
    return null;
  }
}

/**
 * Runner function to query and process all due scheduled tasks
 */
async function runScheduledTasksJob() {
  try {
    const pendingTasks = await getPendingTasksToExecute();
    if (pendingTasks.length > 0) {
      logger.info(`[SCHEDULED_CRON] Found ${pendingTasks.length} pending task(s) to execute`);
      for (const task of pendingTasks) {
        await executeSingleScheduledTask(task);
      }
    }
  } catch (error) {
    logger.error('[SCHEDULED_CRON_ERROR] Cron job execution failed:', error.message);
  }
}

/**
 * Initialize background cron runner (runs every minute)
 */
function initScheduledTasksCron() {
  logger.info('[SCHEDULED_CRON] Initializing background cron runner (every 60 seconds)...');
  cron.schedule('*/1 * * * *', async () => {
    await runScheduledTasksJob();
  });
}

module.exports = {
  executeSingleScheduledTask,
  runScheduledTasksJob,
  initScheduledTasksCron,
};
