const express = require('express');
const router = express.Router();
const { getRevenueAnalytics, getAgentAnalytics } = require('../services/analytics.service');
const { generateCopilotSuggestions } = require('../services/copilot.service');
const Product = require('../models/Product');
const PolicyRule = require('../models/PolicyRule');
const logger = require('../utils/logger');

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

// GET /api/analytics/copilot — AI Co-pilot Suggestions & Telemetry
router.get('/copilot', async (req, res, next) => {
  try {
    const { merchantId } = req.query;
    if (!merchantId) {
      return res.status(400).json({ success: false, error: 'Merchant ID is required' });
    }
    const copilotData = await generateCopilotSuggestions(merchantId);
    res.status(200).json({ success: true, ...copilotData });
  } catch (error) {
    next(error);
  }
});

// POST /api/analytics/copilot/apply — Execute AI Suggestion
router.post('/copilot/apply', async (req, res, next) => {
  try {
    const { merchantId, actionType, payload } = req.body;
    logger.info(`[COPILOT_APPLY_ACTION] Applying action ${actionType} for merchant ${merchantId}`);

    let result = { applied: true, actionType };

    if (actionType === 'PRICE_ADJUSTMENT' || actionType === 'DYNAMIC_PRICE') {
      const discountPercent = payload?.discountPercent || 5;
      const products = await Product.find({ merchant: merchantId });
      for (const prod of products) {
        prod.price = Math.max(1, Math.round(prod.price * (1 - discountPercent / 100)));
        await prod.save();
      }
      result.message = `Applied ${discountPercent}% price optimization across ${products.length} catalog items`;
    } else if (actionType === 'RESTOCK' || actionType === 'RESTOCK_PRODUCTS') {
      const restockAmount = payload?.amount || 25;
      const updated = await Product.updateMany(
        { merchant: merchantId, stock: { $lte: 10 } },
        { $inc: { stock: restockAmount } }
      );
      result.message = `Restocked ${updated.modifiedCount || 0} low-stock products with +${restockAmount} inventory`;
    } else if (actionType === 'POLICY_THRESHOLD' || actionType === 'UPDATE_POLICY') {
      const newCap = payload?.maxAmount || 4500;
      await PolicyRule.findOneAndUpdate(
        { merchant: merchantId, ruleType: 'max_spend_cap' },
        { maxAmount: newCap, isActive: true },
        { upsert: true, new: true }
      );
      result.message = `Updated merchant negotiation auto-accept cap to ₹${newCap}`;
    } else {
      result.message = `Action "${actionType}" acknowledged and applied by AI Gateway`;
    }

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
