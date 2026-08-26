const Product = require('../models/Product');
const { matchIntentToMerchants } = require('./matching.service');
const logger = require('../utils/logger');

/**
 * Perform flexible product search using MongoDB text index and price filter with attribute-drop fallback
 * @param {Object} params - { query, category, maxPrice, minPrice, page, limit }
 * @returns {Promise<Object>} Search results with metadata
 */
async function searchProducts(params = {}) {
  const {
    query = '',
    category,
    maxPrice,
    minPrice,
    page = 1,
    limit = 20,
  } = params;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, parseInt(limit, 10));
  const skip = (pageNum - 1) * limitNum;

  // Base availability filter
  const baseFilter = { isAvailable: true };

  // Price bounds
  if (maxPrice !== undefined && Number(maxPrice) > 0) {
    baseFilter.price = { ...(baseFilter.price || {}), $lte: Number(maxPrice) };
  }
  if (minPrice !== undefined && Number(minPrice) >= 0) {
    baseFilter.price = { ...(baseFilter.price || {}), $gte: Number(minPrice) };
  }
  if (category && category !== 'General' && category !== 'All') {
    baseFilter.category = category;
  }

  let products = [];
  let fallbackUsed = false;
  let searchedKeywords = query;

  if (query && query.trim()) {
    const rawTokens = query.trim().split(/\s+/).filter(Boolean);

    // Attempt 1: Search using all keywords
    const textSearchFilter = {
      ...baseFilter,
      $text: { $search: rawTokens.join(' ') },
    };

    try {
      products = await Product.find(
        textSearchFilter,
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limitNum)
        .populate('merchant', 'businessName businessCategory')
        .lean();
    } catch (err) {
      logger.warn('[PRODUCT_DISCOVERY] Text search query error:', err.message);
    }

    // Attempt 2: If 0 results and multiple keywords exist (e.g. "black shirt"), drop attribute/color token and retry with core item token (e.g. "shirt")
    if (products.length === 0 && rawTokens.length > 1) {
      fallbackUsed = true;
      // Keep last token(s) assuming last token is the core item noun
      const coreTokens = rawTokens.slice(-1);
      searchedKeywords = coreTokens.join(' ');

      const fallbackTextFilter = {
        ...baseFilter,
        $text: { $search: searchedKeywords },
      };

      try {
        products = await Product.find(
          fallbackTextFilter,
          { score: { $meta: 'textScore' } }
        )
          .sort({ score: { $meta: 'textScore' } })
          .skip(skip)
          .limit(limitNum)
          .populate('merchant', 'businessName businessCategory')
          .lean();
        
        logger.info(`[PRODUCT_DISCOVERY] Fallback triggered: dropped attributes, searched core keyword "${searchedKeywords}". Found ${products.length} item(s).`);
      } catch (err) {
        logger.warn('[PRODUCT_DISCOVERY] Fallback text search error:', err.message);
      }
    }
  } else {
    // No text query: browse mode by category/price
    products = await Product.find(baseFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('merchant', 'businessName businessCategory')
      .lean();
  }

  const totalCount = products.length;

  return {
    query,
    searchedKeywords,
    fallbackUsed,
    count: totalCount,
    page: pageNum,
    limit: limitNum,
    products: products.map((p) => ({
      id: p._id,
      title: p.title,
      description: p.description,
      price: p.price,
      currency: p.currency || 'INR',
      category: p.category,
      stock: p.stock,
      images: p.images || [],
      tags: p.tags || [],
      merchant: {
        id: p.merchant?._id,
        name: p.merchant?.businessName || 'Merchant',
      },
      textScore: p.score || 0,
    })),
  };
}

/**
 * Initiate commerce matching pipeline directly from a product search result
 * Feeds search selection into matching.service.js (Step 19)
 */
async function initiateSearchMatchingPipeline(params) {
  const { query, category, maxPrice, merchantId } = params;

  const keywords = query ? query.trim().split(/\s+/).filter(Boolean) : [];
  const syntheticIntent = {
    category: category || 'General',
    keywords,
    budgetCap: Number(maxPrice) || 50000,
    merchantPreferences: merchantId ? [merchantId.toString()] : [],
  };

  const matches = await matchIntentToMerchants(syntheticIntent);
  return {
    pipeline: 'AP2/x402 Search-Originated Commerce',
    syntheticIntent,
    matches,
  };
}

module.exports = {
  searchProducts,
  initiateSearchMatchingPipeline,
};
