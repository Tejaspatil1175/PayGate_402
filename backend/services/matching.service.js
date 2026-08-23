const Product = require('../models/Product');
const Registry = require('../models/Registry');
const Intent = require('../models/Intent');

/**
 * Match a purchase intent against available merchant catalogs and policy constraints
 * @param {string|Object} intentInput - Intent document ID or Intent object
 * @param {Object} [options] - { limit }
 * @returns {Promise<Array<Object>>} Ranked list of matches with explainable scores
 */
async function matchIntentToMerchants(intentInput, options = {}) {
  let intentDoc;

  if (typeof intentInput === 'string') {
    intentDoc = await Intent.findById(intentInput).lean();
    if (!intentDoc) {
      throw new Error('Intent not found');
    }
  } else {
    intentDoc = intentInput;
  }

  const { category, keywords = [], budgetCap = 0, merchantPreferences = [] } = intentDoc;
  const maxResults = options.limit || 10;

  // Build MongoDB query filter
  const productFilter = {
    isAvailable: true,
    price: { $lte: budgetCap }, // Bounded price constraint
  };

  if (category && category !== 'General') {
    productFilter.category = category;
  }

  // Fetch candidate products matching basic price and category criteria
  let candidateProducts = await Product.find(productFilter)
    .populate('merchant', 'businessName email phone businessCategory razorpayKeyId')
    .lean();

  if (candidateProducts.length === 0 && category && category !== 'General') {
    // Fallback: broaden search if exact category yielded no results within budget
    delete productFilter.category;
    candidateProducts = await Product.find(productFilter)
      .populate('merchant', 'businessName email phone businessCategory razorpayKeyId')
      .lean();
  }

  // Fetch registry entries for trust scores
  const merchantIds = candidateProducts.map((p) => p.merchant?._id).filter(Boolean);
  const registryEntries = await Registry.find({ merchant: { $in: merchantIds }, isListed: true }).lean();
  const registryMap = new Map(registryEntries.map((r) => [r.merchant.toString(), r]));

  const scoredMatches = candidateProducts.map((product) => {
    let score = 0;
    const explanations = [];

    // 1. Price vs Budget Cap Score (max 35 pts)
    if (product.price <= budgetCap) {
      const priceRatio = product.price / budgetCap;
      // Closer to budget or good deal receives strong score
      const priceScore = Math.round(35 * (1 - Math.abs(0.7 - priceRatio) * 0.5));
      score += Math.max(15, priceScore);
      explanations.push(`Price ₹${product.price} fits within ₹${budgetCap} budget cap (+${priceScore} pts)`);
    } else {
      explanations.push(`Price ₹${product.price} exceeds budget cap ₹${budgetCap} (BLOCKED)`);
      return null; // Exceeds budget cap, exclude
    }

    // 2. Keyword & Relevance Score (max 35 pts)
    const productText = `${product.title} ${product.description || ''} ${(product.tags || []).join(' ')}`.toLowerCase();
    let keywordHits = 0;

    keywords.forEach((kw) => {
      if (productText.includes(kw.toLowerCase())) {
        keywordHits += 1;
      }
    });

    if (keywords.length > 0) {
      const relevanceRatio = Math.min(1, keywordHits / keywords.length);
      const kwScore = Math.round(35 * relevanceRatio);
      score += kwScore;
      if (keywordHits > 0) {
        explanations.push(`Matched ${keywordHits}/${keywords.length} query keywords (+${kwScore} pts)`);
      }
    } else {
      score += 20; // Default baseline relevance
    }

    // 3. Merchant Trust Score (max 20 pts)
    const regEntry = registryMap.get(product.merchant?._id?.toString());
    const trustScore = regEntry ? regEntry.trustScore : 80;
    const trustBonus = Math.round((trustScore / 100) * 20);
    score += trustBonus;
    explanations.push(`Merchant trust score ${trustScore}/100 (+${trustBonus} pts)`);

    // 4. Preferred Merchant Bonus (max 10 pts)
    if (
      merchantPreferences.length > 0 &&
      product.merchant &&
      (merchantPreferences.includes(product.merchant._id.toString()) ||
        merchantPreferences.includes(regEntry?.slug))
    ) {
      score += 10;
      explanations.push(`Explicit user merchant preference (+10 pts)`);
    }

    // 5. In-Stock Bonus
    if ((product.stock || 0) > 0) {
      score += 5;
    }

    const finalScore = Math.min(100, score);

    return {
      matchScore: finalScore,
      product: {
        id: product._id,
        title: product.title,
        price: product.price,
        currency: product.currency || 'INR',
        category: product.category,
        stock: product.stock,
        sku: product.sku,
        images: product.images || [],
      },
      merchant: {
        id: product.merchant?._id,
        name: product.merchant?.businessName || 'Merchant',
        category: product.merchant?.businessCategory,
        trustScore,
        slug: regEntry?.slug || '',
      },
      explanation: explanations.join(' · '),
    };
  });

  // Filter out nulls and sort descending by matchScore
  const sortedMatches = scoredMatches
    .filter(Boolean)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, maxResults);

  return sortedMatches;
}

module.exports = {
  matchIntentToMerchants,
};
