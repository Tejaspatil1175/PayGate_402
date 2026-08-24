const Order = require('../models/Order');
const logger = require('../utils/logger');

/**
 * Get comprehensive revenue analytics and GMV breakdown for a merchant
 * @param {string} [merchantId] - Optional merchant filter
 * @param {Date} [startDate]
 * @param {Date} [endDate]
 * @returns {Promise<Object>} Aggregated revenue analytics
 */
async function getRevenueAnalytics(merchantId = null, startDate = null, endDate = null) {
  const matchFilter = {};

  if (merchantId) {
    matchFilter.merchant = typeof merchantId === 'string' ? new (require('mongoose').Types.ObjectId)(merchantId) : merchantId;
  }

  if (startDate || endDate) {
    matchFilter.createdAt = {};
    if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
    if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
  }

  // 1. Overall Order & GMV Metrics
  const orders = await Order.find(matchFilter).lean();

  const totalOrdersCount = orders.length;
  const statusBreakdown = {
    created: 0,
    paid: 0,
    fulfilled: 0,
    failed: 0,
    cancelled: 0,
  };

  let totalGMV = 0;
  let paidOrdersCount = 0;

  orders.forEach((o) => {
    if (statusBreakdown[o.status] !== undefined) {
      statusBreakdown[o.status] += 1;
    }
    if (o.status === 'paid' || o.status === 'fulfilled') {
      totalGMV += o.amount || 0;
      paidOrdersCount += 1;
    }
  });

  const averageOrderValue = paidOrdersCount > 0 ? Math.round((totalGMV / paidOrdersCount) * 100) / 100 : 0;
  const conversionRate = totalOrdersCount > 0 ? Math.round((paidOrdersCount / totalOrdersCount) * 10000) / 100 : 0;

  // 2. Daily Revenue Trend Data
  const dailyMap = {};
  orders.forEach((o) => {
    if (o.status === 'paid' || o.status === 'fulfilled') {
      const dateKey = new Date(o.createdAt).toISOString().split('T')[0];
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { date: dateKey, gmv: 0, orders: 0 };
      }
      dailyMap[dateKey].gmv += o.amount || 0;
      dailyMap[dateKey].orders += 1;
    }
  });

  const dailyTrends = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  logger.info(`[ANALYTICS] Generated revenue analytics: GMV ₹${totalGMV} across ${paidOrdersCount} paid orders`);

  return {
    protocol: 'AP2/x402',
    merchantId,
    summary: {
      totalGMV,
      totalOrdersCount,
      paidOrdersCount,
      averageOrderValue,
      conversionRatePercent: conversionRate,
      currency: 'INR',
    },
    statusBreakdown,
    dailyTrends,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Get AI Buyer Agent analytics and agent breakdown metrics
 * @param {string} [merchantId]
 * @returns {Promise<Object>} Agent performance analytics
 */
async function getAgentAnalytics(merchantId = null) {
  const matchFilter = {};
  if (merchantId) {
    matchFilter.merchant = typeof merchantId === 'string' ? new (require('mongoose').Types.ObjectId)(merchantId) : merchantId;
  }

  const agentSummary = await Order.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: '$agentId',
        totalOrders: { $sum: 1 },
        paidOrders: {
          $sum: {
            $cond: [{ $in: ['$status', ['paid', 'fulfilled']] }, 1, 0],
          },
        },
        totalSpend: {
          $sum: {
            $cond: [{ $in: ['$status', ['paid', 'fulfilled']] }, '$amount', 0],
          },
        },
        lastActive: { $max: '$createdAt' },
      },
    },
    { $sort: { totalSpend: -1 } },
  ]);

  const formattedAgents = agentSummary.map((a) => ({
    agentId: a._id || 'agent_anonymous',
    totalOrders: a.totalOrders,
    paidOrders: a.paidOrders,
    totalSpend: a.totalSpend,
    averageSpendPerOrder: a.paidOrders > 0 ? Math.round((a.totalSpend / a.paidOrders) * 100) / 100 : 0,
    lastActive: a.lastActive,
  }));

  return {
    protocol: 'AP2/x402',
    merchantId,
    agentsCount: formattedAgents.length,
    agents: formattedAgents,
    evaluatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getRevenueAnalytics,
  getAgentAnalytics,
};
