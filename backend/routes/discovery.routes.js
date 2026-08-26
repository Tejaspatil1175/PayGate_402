const express = require('express');
const router = express.Router();
const { searchProducts, initiateSearchMatchingPipeline } = require('../services/productDiscovery.service');

// @desc    Browse & search internal merchant product catalog (flexible text search + fallback)
// @route   GET /api/discovery/search
router.get('/search', async (req, res) => {
  try {
    const { q, query, category, maxPrice, minPrice, page, limit } = req.query;

    const searchResult = await searchProducts({
      query: q || query || '',
      category,
      maxPrice,
      minPrice,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      ...searchResult,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// @desc    Feed search selection into matching/negotiation/contract pipeline
// @route   POST /api/discovery/initiate-match
router.post('/initiate-match', async (req, res) => {
  try {
    const { query, category, maxPrice, merchantId } = req.body;

    const result = await initiateSearchMatchingPipeline({
      query,
      category,
      maxPrice,
      merchantId,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
