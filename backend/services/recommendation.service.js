const Product = require('../models/Product');
const Order = require('../models/Order');
const Registry = require('../models/Registry');
const logger = require('../utils/logger');

/**
 * Generate product recommendations based on user purchase history, category affinity, and trust score
 * @param {string} userId - User ID or customer identifier
 * @param {Object} [options] - { limit }
 * @returns {Promise<Array<Object>>} Ranked product recommendations with explanation
 */
async function getRecommendationsForUser(userId, options = {}) {
  const limit = options.limit ? parseInt(options.limit, 10) : 10;

  let pastOrders = [];
  if (userId) {
    try {
      pastOrders = await Order.find({
        $or: [{ 'customer.email': userId }, { agentId: userId }, { userId }],
        status: { $in: ['paid', 'fulfilled'] },
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
    } catch (err) {
      logger.warn('[RECOMMENDATION] Past order lookup failed:', err.message);
    }
  }

  // Extract category frequencies and average purchase price
  const categoryCounts = {};
  let totalSpent = 0;
  let purchasedProductIds = new Set();

  pastOrders.forEach((order) => {
    totalSpent += order.amount || 0;
    (order.items || []).forEach((item) => {
      if (item.product) purchasedProductIds.add(item.product.toString());
    });
  });

  const averagePrice = pastOrders.length > 0 ? totalSpent / pastOrders.length : 2500;

  // Determine top preferred category
  let preferredCategory = null;
  let maxCount = 0;
  Object.keys(categoryCounts).forEach((cat) => {
    if (categoryCounts[cat] > maxCount) {
      maxCount = categoryCounts[cat];
      preferredCategory = cat;
    }
  });

  // Fetch available products excluding already purchased ones
  const candidateProducts = await Product.find({
    isAvailable: true,
    _id: { $nin: Array.from(purchasedProductIds) },
  })
    .populate('merchant', 'businessName businessCategory')
    .limit(50)
    .lean();

  if (candidateProducts.length === 0) {
    // If no unpurchased products, fetch general available products
    const fallbackProducts = await Product.find({ isAvailable: true })
      .populate('merchant', 'businessName businessCategory')
      .limit(limit)
      .lean();

    return fallbackProducts.map((p) => ({
      recommendationScore: 75,
      reason: 'Popular product in merchant catalog',
      product: formatProduct(p),
    }));
  }

  // Fetch merchant registry trust scores
  const merchantIds = candidateProducts.map((p) => p.merchant?._id).filter(Boolean);
  const registryEntries = await Registry.find({ merchant: { $in: merchantIds } }).lean();
  const trustMap = new Map(registryEntries.map((r) => [r.merchant.toString(), r.trustScore || 80]));

  const scoredProducts = candidateProducts.map((product) => {
    let score = 50; // Baseline
    const reasons = [];

    // 1. Category Affinity Match (+25 pts)
    if (preferredCategory && product.category === preferredCategory) {
      score += 25;
      reasons.push(`Matches your preferred category '${preferredCategory}'`);
    } else {
      reasons.push(`Trending in ${product.category || 'General'}`);
    }

    // 2. Price Similarity Match (+15 pts if near user's avg spend)
    const priceDiff = Math.abs(product.price - averagePrice);
    if (priceDiff <= averagePrice * 0.5) {
      score += 15;
      reasons.push(`Fits your typical spending range (~₹${Math.round(averagePrice)})`);
    }

    // 3. Merchant Trust Rating (+10 pts)
    const trustScore = trustMap.get(product.merchant?._id?.toString()) || 80;
    const trustBonus = Math.round((trustScore / 100) * 10);
    score += trustBonus;

    // 4. Stock Availability Bonus (+5 pts)
    if ((product.stock || 0) > 0) score += 5;

    return {
      recommendationScore: Math.min(98, score),
      reason: reasons.join(' · '),
      product: formatProduct(product),
    };
  });

  return scoredProducts
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, limit);
}

function formatProduct(p) {
  return {
    id: p._id,
    title: p.title,
    description: p.description,
    price: p.price,
    currency: p.currency || 'INR',
    category: p.category,
    stock: p.stock,
    images: p.images || [],
    merchant: {
      id: p.merchant?._id,
      name: p.merchant?.businessName || 'Verified Merchant',
    },
  };
}

module.exports = {
  getRecommendationsForUser,
};
