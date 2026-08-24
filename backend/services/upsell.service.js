const Product = require('../models/Product');
const { generateNonce } = require('../utils/crypto');
const logger = require('../utils/logger');

/**
 * Generate intelligent bundle and upsell suggestions for AI Buyer / Agent
 * @param {Object} params - { merchantId, currentItems, budgetCap, category }
 * @returns {Promise<Object>} Upsell and bundle suggestions
 */
async function generateUpsellSuggestions(params = {}) {
  const {
    merchantId = null,
    currentItems = [],
    budgetCap = Infinity,
    category = null,
  } = params;

  if (!merchantId) {
    throw new Error('Merchant ID is required to generate upsell suggestions');
  }

  // Calculate current cart total
  const currentTotal = currentItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  const remainingBudget = Math.max(0, budgetCap - currentTotal);

  // Extract current product IDs and categories
  const currentProductIds = currentItems
    .filter((item) => item.product || item._id)
    .map((item) => String(item.product || item._id));

  // Query available catalog products from the merchant excluding items already in cart
  const catalogQuery = {
    merchant: merchantId,
    isAvailable: true,
    stock: { $gt: 0 },
  };

  if (currentProductIds.length > 0) {
    catalogQuery._id = { $nin: currentProductIds };
  }

  const availableProducts = await Product.find(catalogQuery).lean();

  const suggestedBundles = [];
  const premiumUpsells = [];

  // 1. Cross-Sell / Bundle Suggestions (Accessories, Add-ons, Complementary items)
  const affordableAddons = availableProducts.filter((p) => p.price <= remainingBudget && p.price <= currentTotal * 0.5);

  if (affordableAddons.length > 0) {
    // Group into bundle suggestions with a 10% bundle discount
    const bundleDiscountRate = 0.10;
    
    affordableAddons.slice(0, 3).forEach((addon) => {
      const grossPrice = currentTotal + addon.price;
      const bundlePrice = Math.round(grossPrice * (1 - bundleDiscountRate));
      const savings = grossPrice - bundlePrice;

      if (bundlePrice <= budgetCap) {
        suggestedBundles.push({
          bundleId: `bundle_${generateNonce().substring(0, 12)}`,
          title: `Smart Bundle: Current Items + ${addon.title}`,
          description: `Add ${addon.title} to your order and save ${Math.round(bundleDiscountRate * 100)}% on the total bundle price!`,
          addonProduct: {
            id: addon._id,
            title: addon.title,
            category: addon.category,
            standalonePrice: addon.price,
          },
          standaloneTotal: grossPrice,
          bundlePrice,
          savings,
          discountPercent: Math.round(bundleDiscountRate * 100),
          withinBudgetCap: bundlePrice <= budgetCap,
        });
      }
    });
  }

  // 2. Premium Upsell Suggestions (Higher tier replacement items in same category)
  if (category || currentItems.length > 0) {
    const mainCategory = category || (currentItems[0] && currentItems[0].category) || 'General';
    
    const higherTierProducts = availableProducts.filter(
      (p) => p.category === mainCategory && p.price > currentTotal && p.price <= budgetCap
    );

    higherTierProducts.slice(0, 2).forEach((premium) => {
      const priceDifference = premium.price - currentTotal;
      premiumUpsells.push({
        upsellId: `upsell_${generateNonce().substring(0, 12)}`,
        title: `Upgrade to Premium: ${premium.title}`,
        description: `Upgrade your selection to ${premium.title} for just ₹${priceDifference} more!`,
        premiumProduct: {
          id: premium._id,
          title: premium.title,
          description: premium.description,
          price: premium.price,
          category: premium.category,
        },
        priceDifference,
        withinBudgetCap: premium.price <= budgetCap,
      });
    });
  }

  logger.info(`[UPSELL_ENGINE] Generated ${suggestedBundles.length} bundles and ${premiumUpsells.length} upsells for merchant ${merchantId}`);

  return {
    protocol: 'AP2/x402',
    merchantId,
    currentCartTotal: currentTotal,
    budgetCap: budgetCap === Infinity ? null : budgetCap,
    remainingBudget: remainingBudget === Infinity ? null : remainingBudget,
    bundlesCount: suggestedBundles.length,
    upsellsCount: premiumUpsells.length,
    suggestedBundles,
    premiumUpsells,
    evaluatedAt: new Date().toISOString(),
  };
}

module.exports = {
  generateUpsellSuggestions,
};
