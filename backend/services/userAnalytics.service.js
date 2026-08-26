const Wallet = require('../models/Wallet');
const Order = require('../models/Order');
const { getWalletBalance } = require('./wallet.service');
const logger = require('../utils/logger');

/**
 * Generate user spending analytics: category breakdown, monthly trends, and AI insights
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Spending analytics summary
 */
async function getUserSpendingAnalytics(userId) {
  if (!userId) {
    throw new Error('User ID is required for spending analytics');
  }

  // 1. Fetch wallet data
  const walletData = await getWalletBalance(userId);
  const ledger = walletData.ledger || [];

  // 2. Fetch paid/fulfilled orders for detailed category breakdown
  let userOrders = [];
  try {
    userOrders = await Order.find({
      $or: [{ 'customer.email': userId }, { agentId: userId }, { userId }],
      status: { $in: ['paid', 'fulfilled'] },
    })
      .sort({ createdAt: -1 })
      .lean();
  } catch (err) {
    logger.warn('[USER_ANALYTICS] Order lookup failed:', err.message);
  }

  // 3. Category Breakdown Calculation
  const categoryTotals = {};
  let totalOrderSpend = 0;

  userOrders.forEach((order) => {
    totalOrderSpend += order.amount || 0;
    (order.items || []).forEach((item) => {
      const cat = item.category || 'General';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (item.price * (item.quantity || 1) || order.amount || 0);
    });
  });

  const categoryBreakdown = Object.keys(categoryTotals).map((cat) => {
    const totalAmount = categoryTotals[cat];
    const percentage = totalOrderSpend > 0 ? Math.round((totalAmount / totalOrderSpend) * 100) : 0;
    return {
      category: cat,
      totalAmount,
      percentage,
    };
  });

  // 4. Monthly Trends Calculation (Last 6 Months)
  const monthlyData = {};
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    monthlyData[monthKey] = { month: monthKey, totalSpent: 0, totalTopUp: 0, transactionCount: 0 };
  }

  ledger.forEach((entry) => {
    const date = new Date(entry.createdAt);
    const monthKey = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });

    if (monthlyData[monthKey]) {
      monthlyData[monthKey].transactionCount += 1;
      if (entry.type === 'debit') {
        monthlyData[monthKey].totalSpent += entry.amount || 0;
      } else if (entry.type === 'topup' || entry.type === 'credit') {
        monthlyData[monthKey].totalTopUp += entry.amount || 0;
      }
    }
  });

  const monthlyTrends = Object.values(monthlyData);

  // 5. Generate Smart Insight Bullets
  const insights = [];
  if (categoryBreakdown.length > 0) {
    const topCategory = categoryBreakdown.sort((a, b) => b.totalAmount - a.totalAmount)[0];
    insights.push(`Your highest spending category is ${topCategory.category} (${topCategory.percentage}% of total spend).`);
  }

  if (walletData.dailySpent > 0) {
    const dailyCapUsage = Math.round((walletData.dailySpent / walletData.perDayCap) * 100);
    insights.push(`You have utilized ${dailyCapUsage}% of your daily spending cap (₹${walletData.dailySpent} / ₹${walletData.perDayCap}).`);
  } else {
    insights.push(`Your wallet is fully within your daily guardrail cap of ₹${walletData.perDayCap.toLocaleString('en-IN')}.`);
  }

  const totalTopUps = ledger.filter((l) => l.type === 'topup').reduce((sum, l) => sum + (l.amount || 0), 0);
  const totalDebits = ledger.filter((l) => l.type === 'debit').reduce((sum, l) => sum + (l.amount || 0), 0);

  if (totalTopUps > 0) {
    insights.push(`Total lifetime wallet top-ups: ₹${totalTopUps.toLocaleString('en-IN')}. Current balance: ₹${walletData.balance.toLocaleString('en-IN')}.`);
  }

  return {
    userId,
    summary: {
      currentBalance: walletData.balance,
      currency: walletData.currency || 'INR',
      perTransactionCap: walletData.perTransactionCap,
      perDayCap: walletData.perDayCap,
      dailySpent: walletData.dailySpent,
      availableDailyCap: walletData.availableDailyCap,
      totalTopUps,
      totalDebits,
      totalOrders: userOrders.length,
    },
    categoryBreakdown,
    monthlyTrends,
    insights,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getUserSpendingAnalytics,
};
