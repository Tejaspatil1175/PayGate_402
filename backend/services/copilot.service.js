const Order = require('../models/Order');
const PolicyRule = require('../models/PolicyRule');
const AuditLog = require('../models/AuditLog');
const Product = require('../models/Product');
const logger = require('../utils/logger');

/**
 * Generate AI Co-pilot suggestions and intelligence for a merchant
 * @param {string} merchantId - MongoDB ObjectId or string
 * @returns {Promise<Object>} Merchant AI Co-pilot insights and actionable suggestions
 */
async function generateCopilotSuggestions(merchantId) {
  if (!merchantId) {
    throw new Error('Merchant ID is required for AI Co-pilot suggestions');
  }

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
      merchant: merchantId,
      status: { $in: ['paid', 'fulfilled', 'created'] },
    }).lean();

    metrics.totalOrdersCount = orders.length;
    metrics.totalRevenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);

    const paidOrders = orders.filter((o) => o.status === 'paid' || o.status === 'fulfilled');
    const avgOrderValue = paidOrders.length > 0 ? Math.round(metrics.totalRevenue / paidOrders.length) : 0;

    if (paidOrders.length > 5 && avgOrderValue > 0) {
      suggestions.push({
        id: 'copilot_aov_insight',
        type: 'REVENUE_OPTIMIZATION',
        severity: 'INFO',
        title: 'Average Order Value Insight',
        message: `Your current Average Order Value (AOV) is ₹${avgOrderValue}. Consider offering a ₹${Math.round(avgOrderValue * 1.2)} bundle offer to increase AOV by 20%.`,
        recommendedAction: {
          actionType: 'CREATE_BUNDLE',
          targetAmount: Math.round(avgOrderValue * 1.2),
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
      merchant: merchantId,
      decision: 'BLOCK',
      createdAt: { $gte: past7Days },
    }).lean();

    metrics.blockedAuditLogsCount = blockedLogs.length;

    if (blockedLogs.length > 0) {
      // Group by reason
      const reasonCounts = {};
      blockedLogs.forEach((log) => {
        const key = log.reason || 'Policy Block';
        reasonCounts[key] = (reasonCounts[key] || 0) + 1;
      });

      const topReason = Object.keys(reasonCounts).reduce((a, b) => (reasonCounts[a] > reasonCounts[b] ? a : b));
      const topCount = reasonCounts[topReason];

      suggestions.push({
        id: 'copilot_policy_friction',
        type: 'POLICY_OPTIMIZATION',
        severity: topCount >= 5 ? 'HIGH' : 'MEDIUM',
        title: 'Transaction Policy Friction Warning',
        message: `${topCount} transaction(s) blocked in the past 7 days due to: "${topReason}". Adjusting your spend caps or category rules could unlock lost revenue.`,
        recommendedAction: {
          actionType: 'REVIEW_POLICY_RULES',
          blockedReason: topReason,
          affectedCount: topCount,
        },
      });
    }
  } catch (err) {
    logger.warn('[COPILOT_AUDIT_LOG_WARN] Audit log analysis failed:', err.message);
  }

  // 3. Inventory & Low Stock Alerts
  try {
    const lowStockItems = await Product.find({
      merchant: merchantId,
      isAvailable: true,
      stock: { $lte: 5 },
    }).lean();

    metrics.lowStockProductsCount = lowStockItems.length;

    if (lowStockItems.length > 0) {
      suggestions.push({
        id: 'copilot_low_stock_alert',
        type: 'INVENTORY_ALERT',
        severity: 'MEDIUM',
        title: 'Low Stock Inventory Alert',
        message: `${lowStockItems.length} product(s) (e.g. "${lowStockItems[0].title}") have 5 or fewer items remaining in stock. Restock to prevent missed agent transactions.`,
        recommendedAction: {
          actionType: 'RESTOCK_PRODUCTS',
          products: lowStockItems.map((p) => ({ id: p._id, title: p.title, stock: p.stock })),
        },
      });
    }
  } catch (err) {
    logger.warn('[COPILOT_INVENTORY_WARN] Inventory check failed:', err.message);
  }

  // Fallback default suggestion if catalog is fresh
  if (suggestions.length === 0) {
    suggestions.push({
      id: 'copilot_general_setup',
      type: 'GROWTH_SETUP',
      severity: 'INFO',
      title: 'AI Co-pilot Ready',
      message: 'Your AP2/x402 merchant AI Co-pilot is monitoring live transactions. Suggestions will populate automatically as agent volume increases.',
      recommendedAction: {
        actionType: 'MONITOR',
      },
    });
  }

  logger.info(`[COPILOT_ENGINE] Generated ${suggestions.length} suggestions for merchant ${merchantId}`);

  return {
    protocol: 'AP2/x402',
    merchantId,
    metrics,
    suggestionsCount: suggestions.length,
    suggestions,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  generateCopilotSuggestions,
};
