const UserPersona = require('../models/UserPersona');
const Order = require('../models/Order');
const logger = require('../utils/logger');

// Default neutral persona for cold-start (new users with no history)
const DEFAULT_NEUTRAL_PERSONA = {
  pricePreference: 'neutral',
  preferredCategories: [],
  preferredBrands: [],
  avgOrderValue: 0,
  totalOrdersEvaluated: 0,
};

/**
 * Get persona for user, defaulting to neutral persona for cold-start
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User persona object
 */
async function getUserPersona(userId) {
  if (!userId) return DEFAULT_NEUTRAL_PERSONA;

  try {
    const persona = await UserPersona.findOne({ user: userId }).lean();
    if (persona) return persona;
  } catch (err) {
    logger.warn('[PERSONA] Error fetching persona for user:', err.message);
  }

  return DEFAULT_NEUTRAL_PERSONA;
}

/**
 * Recompute & infer lightweight preference tags from user order history
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated persona
 */
async function inferUserPersona(userId) {
  if (!userId) return DEFAULT_NEUTRAL_PERSONA;

  try {
    const orders = await Order.find({
      $or: [{ 'customer.email': userId }, { agentId: userId }, { userId }],
      status: { $in: ['paid', 'fulfilled'] },
    }).lean();

    if (orders.length === 0) {
      return DEFAULT_NEUTRAL_PERSONA;
    }

    const categoryCounts = {};
    const brandCounts = {};
    let totalSpent = 0;

    orders.forEach((o) => {
      totalSpent += o.amount || 0;
      (o.items || []).forEach((item) => {
        if (item.category) {
          categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
        }
        if (item.brand) {
          brandCounts[item.brand] = (brandCounts[item.brand] || 0) + 1;
        }
      });
    });

    const avgOrderValue = totalSpent / orders.length;

    // Infer pricePreference: budget (< ₹2,000), mid_range (₹2,000 - ₹10,000), premium (> ₹10,000)
    let pricePreference = 'mid_range';
    if (avgOrderValue < 2000) pricePreference = 'budget';
    else if (avgOrderValue > 10000) pricePreference = 'premium';

    // Top categories
    const preferredCategories = Object.keys(categoryCounts)
      .sort((a, b) => categoryCounts[b] - categoryCounts[a])
      .slice(0, 3);

    // Top brands
    const preferredBrands = Object.keys(brandCounts)
      .sort((a, b) => brandCounts[b] - brandCounts[a])
      .slice(0, 3);

    const persona = await UserPersona.findOneAndUpdate(
      { user: userId },
      {
        user: userId,
        pricePreference,
        preferredCategories,
        preferredBrands,
        avgOrderValue,
        totalOrdersEvaluated: orders.length,
        lastInferredAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return persona;
  } catch (error) {
    logger.error('[PERSONA] Failed to infer user persona:', error.message);
    return DEFAULT_NEUTRAL_PERSONA;
  }
}

/**
 * Calculate soft persona-fit score bonus (0 to 10 points) for matching engine
 * Neutral / cold-start returns baseline neutral score (5 pts)
 * @param {Object} persona - User persona record
 * @param {Object} candidateProduct - Candidate product
 * @returns {number} Persona fit score bonus (0-10)
 */
function calculatePersonaFitScore(persona = DEFAULT_NEUTRAL_PERSONA, candidateProduct = {}) {
  // Cold start baseline
  if (!persona || persona.pricePreference === 'neutral' || (persona.totalOrdersEvaluated || 0) === 0) {
    return 5;
  }

  let score = 5; // Neutral baseline

  // 1. Category Fit (+3 pts)
  if (
    candidateProduct.category &&
    persona.preferredCategories &&
    persona.preferredCategories.includes(candidateProduct.category)
  ) {
    score += 3;
  }

  // 2. Price Tier Fit (+2 pts)
  const price = candidateProduct.price || 0;
  if (persona.pricePreference === 'budget' && price <= 2000) score += 2;
  else if (persona.pricePreference === 'premium' && price >= 10000) score += 2;
  else if (persona.pricePreference === 'mid_range' && price > 2000 && price < 10000) score += 2;

  return Math.min(10, score);
}

module.exports = {
  getUserPersona,
  inferUserPersona,
  calculatePersonaFitScore,
  DEFAULT_NEUTRAL_PERSONA,
};
