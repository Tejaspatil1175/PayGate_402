const Merchant = require('../models/Merchant');
const Order = require('../models/Order');
const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

/**
 * Calculate operational and security health score (0-100) for a merchant
 * @param {string} merchantId
 * @returns {Promise<Object>} Detailed merchant health score and diagnostic breakdown
 */
async function calculateMerchantHealthScore(merchantId) {
  if (!merchantId) {
    throw new Error('Merchant ID is required to calculate health score');
  }

  const merchant = await Merchant.findById(merchantId).lean();
  if (!merchant) {
    throw new Error('Merchant not found');
  }

  let healthScore = 0;
  const breakdown = [];

  // 1. KYC Verification & Credentials Component (Max 30 points)
  let kycPoints = 0;
  if (merchant.isVerified || merchant.kycStatus === 'verified') {
    kycPoints = 30;
    breakdown.push({ component: 'kyc_verification', points: 30, maxPoints: 30, details: 'Full KYC verified merchant' });
  } else if (merchant.kycStatus === 'pending') {
    kycPoints = 15;
    breakdown.push({ component: 'kyc_verification', points: 15, maxPoints: 30, details: 'KYC verification pending' });
  } else {
    breakdown.push({ component: 'kyc_verification', points: 0, maxPoints: 30, details: 'Unverified or rejected KYC status' });
  }
  healthScore += kycPoints;

  // 2. Transaction Success & Settlement Rate (Max 30 points)
  try {
    const orders = await Order.find({ merchant: merchantId }).lean();
    const totalOrders = orders.length;

    if (totalOrders === 0) {
      healthScore += 20; // Default baseline for new merchant
      breakdown.push({ component: 'transaction_settlement_rate', points: 20, maxPoints: 30, details: 'New merchant baseline (0 orders processed)' });
    } else {
      const successfulOrders = orders.filter((o) => o.status === 'paid' || o.status === 'fulfilled').length;
      const successRate = successfulOrders / totalOrders;
      const settlementPoints = Math.round(successRate * 30);
      healthScore += settlementPoints;

      breakdown.push({
        component: 'transaction_settlement_rate',
        points: settlementPoints,
        maxPoints: 30,
        details: `Success rate: ${Math.round(successRate * 100)}% (${successfulOrders}/${totalOrders} successful orders)`,
      });
    }
  } catch (err) {
    logger.warn('[HEALTH_SCORE_ORDER_WARN] Order lookup failed:', err.message);
  }

  // 3. Audit Log & Policy Compliance Rate (Max 25 points)
  try {
    const totalLogs = await AuditLog.countDocuments({ merchant: merchantId });
    const blockedLogs = await AuditLog.countDocuments({ merchant: merchantId, decision: 'BLOCK' });

    if (totalLogs === 0) {
      healthScore += 25;
      breakdown.push({ component: 'policy_compliance', points: 25, maxPoints: 25, details: 'Clean compliance log (0 blocks)' });
    } else {
      const blockRate = blockedLogs / totalLogs;
      const complianceRate = Math.max(0, 1 - blockRate);
      const compliancePoints = Math.round(complianceRate * 25);
      healthScore += compliancePoints;

      breakdown.push({
        component: 'policy_compliance',
        points: compliancePoints,
        maxPoints: 25,
        details: `Compliance rate: ${Math.round(complianceRate * 100)}% (${blockedLogs}/${totalLogs} blocked events)`,
      });
    }
  } catch (err) {
    logger.warn('[HEALTH_SCORE_AUDIT_WARN] Audit log lookup failed:', err.message);
  }

  // 4. Product Catalog Health & Stocking (Max 15 points)
  try {
    const activeProducts = await Product.countDocuments({ merchant: merchantId, isAvailable: true, stock: { $gt: 0 } });

    let catalogPoints = 0;
    if (activeProducts >= 5) {
      catalogPoints = 15;
    } else if (activeProducts >= 1) {
      catalogPoints = 10;
    }

    healthScore += catalogPoints;
    breakdown.push({
      component: 'catalog_health',
      points: catalogPoints,
      maxPoints: 15,
      details: `${activeProducts} active product(s) in stock`,
    });
  } catch (err) {
    logger.warn('[HEALTH_SCORE_CATALOG_WARN] Product catalog lookup failed:', err.message);
  }

  // Cap score between 0 and 100
  healthScore = Math.min(100, Math.max(0, healthScore));

  // Determine Health Status Grade
  let healthGrade = 'POOR';
  if (healthScore >= 85) {
    healthGrade = 'EXCELLENT';
  } else if (healthScore >= 70) {
    healthGrade = 'GOOD';
  } else if (healthScore >= 50) {
    healthGrade = 'FAIR';
  }

  logger.info(`[MERCHANT_HEALTH] Merchant ${merchant.businessName} (${merchantId}): Score ${healthScore}/100 [${healthGrade}]`);

  return {
    protocol: 'AP2/x402',
    merchantId,
    businessName: merchant.businessName,
    healthScore,
    healthGrade,
    kycStatus: merchant.kycStatus,
    isVerified: merchant.isVerified,
    breakdown,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Get health scores summary across all active merchants
 * @returns {Promise<Object>} Summary of all merchant health scores
 */
async function getAllMerchantsHealthSummary() {
  const merchants = await Merchant.find({ isActive: true }).select('_id businessName email kycStatus isVerified').lean();

  const healthSummaries = await Promise.all(
    merchants.map(async (m) => {
      try {
        return await calculateMerchantHealthScore(m._id);
      } catch (err) {
        return {
          merchantId: m._id,
          businessName: m.businessName,
          healthScore: 0,
          healthGrade: 'ERROR',
          error: err.message,
        };
      }
    })
  );

  return {
    protocol: 'AP2/x402',
    merchantsCount: merchants.length,
    healthSummaries,
    evaluatedAt: new Date().toISOString(),
  };
}

module.exports = {
  calculateMerchantHealthScore,
  getAllMerchantsHealthSummary,
};
