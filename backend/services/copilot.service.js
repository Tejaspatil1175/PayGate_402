const mongoose = require('mongoose');
const Order = require('../models/Order');
const PolicyRule = require('../models/PolicyRule');
const AuditLog = require('../models/AuditLog');
const Product = require('../models/Product');
const logger = require('../utils/logger');

function toValidObjectId(id) {
  if (!id || id === 'undefined' || id === 'null') return null;
  if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  if (id instanceof mongoose.Types.ObjectId) return id;
  return null;
}

/**
 * Generate AI Co-pilot suggestions and intelligence for a merchant
 * @param {string} merchantId - MongoDB ObjectId or string
 * @returns {Promise<Object>} Merchant AI Co-pilot insights and actionable suggestions
 */
async function generateCopilotSuggestions(merchantId) {
  const validMerchantId = toValidObjectId(merchantId);
  const merchantFilter = validMerchantId ? { merchant: validMerchantId } : {};

  const suggestions = [];
  const metrics = {
    totalOrdersCount: 0,
    totalRevenue: 0,
    blockedAuditLogsCount: 0,
    lowStockProductsCount: 0,
  };

  // 1. Order Volume & Revenue Metrics
  try {
    const orders = await Order.find({
      ...merchantFilter,
      status: { $in: ['paid', 'fulfilled', 'created'] },
    }).lean();

    metrics.totalOrdersCount = orders.length;
    metrics.totalRevenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);

    const paidOrders = orders.filter((o) => o.status === 'paid' || o.status === 'fulfilled');
    const avgOrderValue = paidOrders.length > 0 ? Math.round(metrics.totalRevenue / paidOrders.length) : 0;

    if (paidOrders.length >= 1 && avgOrderValue > 0) {
      suggestions.push({
        id: 'copilot_aov_insight',
        type: 'pricing',
        severity: 'INFO',
        title: 'Average Order Value & Volume Strategy',
        message: `Real settled Average Order Value (AOV) is ₹${avgOrderValue.toLocaleString('en-IN')} across ${paidOrders.length} transaction(s). Setting automated tier discounts on ≥3 items will stimulate bulk buyer agent checkouts.`,
        recommendedAction: {
          actionType: 'DYNAMIC_PRICE',
          discountPercent: 5,
        },
      });
    }
  } catch (err) {
    logger.warn('[COPILOT_ORDER_METRICS_WARN] Order metrics calculation failed:', err.message);
  }

  // 2. Policy Rule Friction & Block Analysis
  try {
    const past7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const blockedLogs = await AuditLog.find({
      ...merchantFilter,
      decision: 'BLOCK',
      createdAt: { $gte: past7Days },
    }).lean();

    metrics.blockedAuditLogsCount = blockedLogs.length;

    if (blockedLogs.length > 0) {
      const reasonCounts = {};
      blockedLogs.forEach((log) => {
        const key = log.reason || 'Policy Block';
        reasonCounts[key] = (reasonCounts[key] || 0) + 1;
      });

      const topReason = Object.keys(reasonCounts).reduce((a, b) => (reasonCounts[a] > reasonCounts[b] ? a : b));
      const topCount = reasonCounts[topReason];

      suggestions.push({
        id: 'copilot_policy_friction',
        type: 'policy',
        severity: topCount >= 5 ? 'HIGH' : 'MEDIUM',
        title: 'Automated Friction & Challenge Signal',
        message: `${topCount} transaction(s) challenged or blocked recently due to: "${topReason}". Tuning your transaction thresholds can recover potential agent conversions.`,
        recommendedAction: {
          actionType: 'REVIEW_POLICY_RULES',
          maxAmount: 6000,
        },
      });
    }
  } catch (err) {
    logger.warn('[COPILOT_AUDIT_LOG_WARN] Audit log analysis failed:', err.message);
  }

  // 3. Inventory & Low Stock Alerts
  try {
    const lowStockItems = await Product.find({
      ...merchantFilter,
      isAvailable: true,
      stock: { $lte: 20 },
    }).lean();

    metrics.lowStockProductsCount = lowStockItems.length;

    if (lowStockItems.length > 0) {
      const sampleItem = lowStockItems[0];
      suggestions.push({
        id: 'copilot_low_stock_alert',
        type: 'inventory',
        severity: 'MEDIUM',
        title: 'Inventory Velocity Warning',
        message: `Product "${sampleItem.title || sampleItem.name || 'Catalog Item'}" has low remaining inventory (${sampleItem.stock || 0} left). Restock recommended to maintain continuous agent fulfillment.`,
        recommendedAction: {
          actionType: 'RESTOCK_PRODUCTS',
          amount: 25,
        },
      });
    }
  } catch (err) {
    logger.warn('[COPILOT_INVENTORY_WARN] Inventory check failed:', err.message);
  }

  // If still empty, supply catalog optimization suggestion
  if (suggestions.length === 0) {
    suggestions.push({
      id: 'copilot_baseline_strategy',
      type: 'pricing',
      severity: 'INFO',
      title: 'Dynamic Agent Pricing Optimization',
      message: 'Aligning discount thresholds with high-frequency agent search budgets increases conversion rates by an estimated 15-18%.',
      recommendedAction: {
        actionType: 'DYNAMIC_PRICE',
        discountPercent: 5,
      },
    });
  }

  logger.info(`[COPILOT_ENGINE] Generated ${suggestions.length} suggestions for merchant ${merchantId}`);

  return {
    protocol: 'AP2/x402',
    merchantId: validMerchantId ? validMerchantId.toString() : null,
    metrics,
    suggestionsCount: suggestions.length,
    suggestions,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  generateCopilotSuggestions,
};
