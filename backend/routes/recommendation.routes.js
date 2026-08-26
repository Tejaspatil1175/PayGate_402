const express = require('express');
const router = express.Router();
const { getRecommendationsForUser } = require('../services/recommendation.service');

// @desc    Get catalog recommendations for user based on purchase history and affinity
// @route   GET /api/recommendations
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'] || null;
    const limit = req.query.limit || 10;

    const recommendations = await getRecommendationsForUser(userId, { limit });

    res.status(200).json({
      success: true,
      count: recommendations.length,
      recommendations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
