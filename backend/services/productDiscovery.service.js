const Product = require('../models/Product');
const { matchIntentToMerchants } = require('./matching.service');
const logger = require('../utils/logger');

/**
 * Perform flexible product search using MongoDB text search + multi-field regex + tag fallback
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

  if (minPrice !== undefined && Number(minPrice) >= 0) {
    baseFilter.price = { ...(baseFilter.price || {}), $gte: Number(minPrice) };
  }

  let products = [];
  let fallbackUsed = false;
  let searchedKeywords = query;

  if (query && query.trim()) {
    const rawTokens = query.trim().split(/\s+/).filter(Boolean);
    const cleanQuery = query.trim();

    // Strategy 1: Multi-field Regex & Tag Search (Fast & Stemming-tolerant)
    // Matches title, description, category, tags, or sku
    const tokenRegexes = rawTokens.map((t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    
    // Also build category synonyms (e.g., shoes -> Footwear / Sneaker / Shoes)
    const synonyms = [];
    if (/shoe|sneaker|boot|footwear|runner/i.test(cleanQuery)) {
      synonyms.push(/shoe|sneaker|boot|footwear|runner|nike|jordan|adidas/i);
    }
    if (/headphone|earbud|earphone|audio|speaker|airpod/i.test(cleanQuery)) {
      synonyms.push(/headphone|earbud|earphone|audio|speaker|sony|bose|airpod/i);
    }
    if (/laptop|macbook|computer|pc/i.test(cleanQuery)) {
      synonyms.push(/laptop|macbook|computer|pc|apple/i);
    }
    // mobile / phone synonyms — catches "I want a mobile", "find phone", "smartphone"
    if (/mobile|phone|smartphone|iphone|android|handset/i.test(cleanQuery)) {
      synonyms.push(/mobile|phone|smartphone|iphone|android|samsung|oneplus|realme|redmi|pixel/i);
    }
    if (/mouse|keyboard|accessory/i.test(cleanQuery)) {
      synonyms.push(/mouse|keyboard|accessory|logitech|keychron/i);
    }
    if (/bottle|flask|water/i.test(cleanQuery)) {
      synonyms.push(/bottle|flask|water|hydro/i);
    }
    if (/bag|backpack|wallet/i.test(cleanQuery)) {
      synonyms.push(/bag|backpack|wallet|bellroy/i);
    }
    // cloth / apparel synonyms — catches "classic cloth", "clothes", "clothing"
    if (/cloth|clothes|clothing|apparel|shirt|tshirt|t-shirt|hoodie|jacket|pant|trouser|kurta|dress|fashion/i.test(cleanQuery)) {
      synonyms.push(/shirt|tshirt|t-shirt|hoodie|jacket|pant|trouser|kurta|dress|apparel|cloth|fashion|zara|h&m|levi/i);
    }
    if (/watch|smartwatch|wearable/i.test(cleanQuery)) {
      synonyms.push(/watch|smartwatch|wearable|fitbit|garmin|fossil|apple watch/i);
    }

    const regexClauses = [
      { title: { $regex: cleanQuery, $options: 'i' } },
      { description: { $regex: cleanQuery, $options: 'i' } },
      { tags: { $in: tokenRegexes } },
      { category: { $regex: cleanQuery, $options: 'i' } },
      ...tokenRegexes.map((r) => ({ title: r })),
      ...tokenRegexes.map((r) => ({ tags: r })),
      ...synonyms.map((s) => ({ title: s })),
      ...synonyms.map((s) => ({ category: s })),
      ...synonyms.map((s) => ({ tags: s })),
    ];

    let searchFilter = {
      ...baseFilter,
      $or: regexClauses,
    };

    if (maxPrice !== undefined && Number(maxPrice) > 0) {
      searchFilter.price = { ...(searchFilter.price || {}), $lte: Number(maxPrice) };
    }

    try {
      products = await Product.find(searchFilter)
        .sort({ price: 1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('merchant', 'businessName businessCategory')
        .lean();
    } catch (err) {
      logger.warn('[PRODUCT_DISCOVERY] Regex search error:', err.message);
    }

    // Strategy 2: If no items found strictly under maxPrice, search without strict maxPrice
    // so the agent can show the closest available product and offer to negotiate it down!
    if (products.length === 0 && maxPrice !== undefined && Number(maxPrice) > 0) {
      fallbackUsed = true;
      try {
        const relaxedFilter = {
          ...baseFilter,
          $or: regexClauses,
        };
        products = await Product.find(relaxedFilter)
          .sort({ price: 1 })
          .skip(skip)
          .limit(limitNum)
          .populate('merchant', 'businessName businessCategory')
          .lean();
        logger.info(`[PRODUCT_DISCOVERY] Relaxed budget search found ${products.length} product(s) for "${cleanQuery}"`);
      } catch (e) {
        logger.warn('[PRODUCT_DISCOVERY] Relaxed search error:', e.message);
      }
    }

    // Strategy 3: Text Index Search Fallback
    if (products.length === 0) {
      fallbackUsed = true;
      try {
        const textFilter = {
          ...baseFilter,
          $text: { $search: rawTokens.join(' ') },
        };
        products = await Product.find(textFilter, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
          .skip(skip)
          .limit(limitNum)
          .populate('merchant', 'businessName businessCategory')
          .lean();
      } catch (textErr) {
        logger.warn('[PRODUCT_DISCOVERY] Text search fallback skipped:', textErr.message);
      }
    }

    // Strategy 4: If still 0 products, return top in-stock products in catalog
    if (products.length === 0) {
      fallbackUsed = true;
      try {
        products = await Product.find({ isAvailable: true })
          .sort({ createdAt: -1 })
          .limit(limitNum)
          .populate('merchant', 'businessName businessCategory')
          .lean();
        logger.info(`[PRODUCT_DISCOVERY] Catalog fallback returned ${products.length} general product(s)`);
      } catch (catErr) {
        logger.warn('[PRODUCT_DISCOVERY] Catalog fallback error:', catErr.message);
      }
    }
  } else {
    // Browse mode by category/price
    const browseFilter = { ...baseFilter };
    if (category && category !== 'General' && category !== 'All') {
      browseFilter.category = category;
    }
    if (maxPrice !== undefined && Number(maxPrice) > 0) {
      browseFilter.price = { ...(browseFilter.price || {}), $lte: Number(maxPrice) };
    }

    products = await Product.find(browseFilter)
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
      _id: p._id,
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
        _id: p.merchant?._id,
        name: p.merchant?.businessName || 'Verified Merchant',
      },
      textScore: p.score || 0,
    })),
  };
}

/**
 * Verify on startup that ProductTextIndex exists on MongoDB collection, or sync it
 */
async function ensureProductIndexes() {
  try {
    const indexes = await Product.collection.getIndexes();
    const indexNames = Object.keys(indexes);
    const hasTextIndex = indexNames.includes('ProductTextIndex') || Object.values(indexes).some((spec) => {
      if (Array.isArray(spec)) {
        return spec.some(([field, type]) => type === 'text');
      }
      return Object.values(spec).includes('text');
    });

    if (hasTextIndex) {
      logger.info(`[PRODUCT_DISCOVERY] ProductTextIndex verified on MongoDB collection (${indexNames.join(', ')}).`);
    } else {
      logger.warn('[PRODUCT_DISCOVERY] ProductTextIndex missing on collection. Running Product.syncIndexes()...');
      await Product.syncIndexes();
      logger.info('[PRODUCT_DISCOVERY] Product.syncIndexes() completed successfully.');
    }
  } catch (err) {
    logger.error('[PRODUCT_DISCOVERY] Error verifying Product indexes:', err.message);
  }
}

/**
 * Initiate commerce matching pipeline directly from a product search result
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
  ensureProductIndexes,
  initiateSearchMatchingPipeline,
};
