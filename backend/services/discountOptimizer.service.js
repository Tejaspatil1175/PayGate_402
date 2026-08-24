const Order = require('../models/Order');
const { generateNonce } = require('../utils/crypto');
const logger = require('../utils/logger');

/**
 * Optimize discount rates for a order / contract based on volume tiers, agent history, and merchant policy caps
 * @param {Object} params - { merchantId, agentId, amount, items, promoCode, maxDiscountCapPercent }
 * @returns {Promise<Object>} Optimized discount result
 */
async function optimizeDiscount(params = {}) {
  const {
    merchantId = null,
    agentId = 'agent_anonymous',
    amount = 0,
    items = [],
    promoCode = '',
    maxDiscountCapPercent = 25, // Hard cap on maximum discount percentage to protect merchant margin
  } = params;

  const originalAmount = Number(amount) || items.reduce((s, i) => s + (i.price * (i.quantity || 1)), 0);
  if (originalAmount <= 0) {
    return {
      protocol: 'AP2/x402',
      originalAmount: 0,
      discountAmount: 0,
      finalAmount: 0,
      appliedDiscountPercent: 0,
      reason: 'Zero amount transaction',
    };
  }

  let totalDiscountPercent = 0;
  const appliedRules = [];

  // 1. Order Volume Tier Discount
  if (originalAmount >= 50000) {
    totalDiscountPercent += 15;
    appliedRules.push({
      rule: 'high_volume_tier',
      discountPercent: 15,
      description: '15% High Volume Tier discount (Orders >= ₹50,000)',
    });
  } else if (originalAmount >= 20000) {
    totalDiscountPercent += 10;
    appliedRules.push({
      rule: 'medium_volume_tier',
      discountPercent: 10,
      description: '10% Medium Volume Tier discount (Orders >= ₹20,000)',
    });
  } else if (originalAmount >= 5000) {
    totalDiscountPercent += 5;
    appliedRules.push({
      rule: 'entry_volume_tier',
      discountPercent: 5,
      description: '5% Entry Volume Tier discount (Orders >= ₹5,000)',
    });
  }

  // 2. Agent Loyalty / Repeat Buyer Discount
  if (agentId && agentId !== 'agent_anonymous') {
    try {
      const priorPaidCount = await Order.countDocuments({
        agentId,
        status: { $in: ['paid', 'fulfilled'] },
      });

      if (priorPaidCount >= 10) {
        totalDiscountPercent += 5;
        appliedRules.push({
          rule: 'vip_agent_loyalty',
          discountPercent: 5,
          description: `5% VIP Agent Loyalty bonus (${priorPaidCount}+ completed orders)`,
        });
      } else if (priorPaidCount >= 3) {
        totalDiscountPercent += 2.5;
        appliedRules.push({
          rule: 'repeat_agent_loyalty',
          discountPercent: 2.5,
          description: `2.5% Repeat Agent Loyalty bonus (${priorPaidCount} completed orders)`,
        });
      }
    } catch (err) {
      logger.warn('[DISCOUNT_OPTIMIZER_WARN] Loyalty check DB error:', err.message);
    }
  }

  // 3. Promo Code Evaluation
  if (promoCode) {
    const codeUpper = promoCode.trim().toUpperCase();
    if (codeUpper === 'AGENT50') {
      totalDiscountPercent += 10;
      appliedRules.push({
        rule: 'promo_code_AGENT50',
        discountPercent: 10,
        description: '10% Agent Exclusive Promo Code AGENT50 applied',
      });
    } else if (codeUpper === 'WELCOME10') {
      totalDiscountPercent += 5;
      appliedRules.push({
        rule: 'promo_code_WELCOME10',
        discountPercent: 5,
        description: '5% Welcome Promo Code WELCOME10 applied',
      });
    }
  }

  // 4. Enforce Max Discount Margin Cap
  let finalDiscountPercent = totalDiscountPercent;
  let cappedByMarginGuardrail = false;

  if (totalDiscountPercent > maxDiscountCapPercent) {
    finalDiscountPercent = maxDiscountCapPercent;
    cappedByMarginGuardrail = true;
  }

  const rawDiscountAmount = (originalAmount * finalDiscountPercent) / 100;
  const discountAmount = Math.round(rawDiscountAmount * 100) / 100;
  const finalAmount = Math.max(0, originalAmount - discountAmount);

  logger.info(`[DISCOUNT_OPTIMIZER] Original: ₹${originalAmount} | Discount: ₹${discountAmount} (${finalDiscountPercent}%) | Final: ₹${finalAmount}`);

  return {
    protocol: 'AP2/x402',
    merchantId,
    agentId,
    originalAmount,
    discountAmount,
    finalAmount,
    totalDiscountPercent,
    appliedDiscountPercent: finalDiscountPercent,
    maxDiscountCapPercent,
    cappedByMarginGuardrail,
    appliedRules,
    optimizedAt: new Date().toISOString(),
  };
}

module.exports = {
  optimizeDiscount,
};
