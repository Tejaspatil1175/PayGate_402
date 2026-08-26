const express = require('express');
const router = express.Router();
const { getUserSpendingAnalytics } = require('../services/userAnalytics.service');

// @desc    Get user spending analytics (category breakdown, monthly trends, and wallet insights)
// @route   GET /api/user-analytics
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'];

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required (via ?userId= or header x-user-id)',
      });
    }

    const analytics = await getUserSpendingAnalytics(userId);

    res.status(200).json({
      success: true,
      analytics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
