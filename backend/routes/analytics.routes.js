const express = require('express');
const router = express.Router();
const { getRevenueAnalytics, getAgentAnalytics } = require('../services/analytics.service');

// GET /api/analytics/revenue — Revenue and GMV Analytics
router.get('/revenue', async (req, res, next) => {
  try {
    const { merchantId, startDate, endDate } = req.query;
    const analytics = await getRevenueAnalytics(merchantId, startDate, endDate);
    res.status(200).json(analytics);
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/agents — AI Buyer Agent Performance Analytics
router.get('/agents', async (req, res, next) => {
  try {
    const { merchantId } = req.query;
    const analytics = await getAgentAnalytics(merchantId);
    res.status(200).json(analytics);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
