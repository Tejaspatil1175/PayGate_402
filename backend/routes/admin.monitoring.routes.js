const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const Order = require('../models/Order');
const logger = require('../utils/logger');

/**
 * GET /api/admin/monitoring/feed — Live Transaction Monitoring Feed
 */
router.get('/feed', async (req, res, next) => {
  try {
    const { decision, agentId, merchantId, limit = 50, page = 1 } = req.query;

    const query = {};
    if (decision) {
      query.decision = decision.toUpperCase();
    }
    if (agentId) {
      query.agentId = agentId;
    }
    if (merchantId) {
      query.merchant = merchantId;
    }

    const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const parsedPage = Math.max(1, Number(page) || 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const [events, totalCount] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate('merchant', 'businessName email')
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    logger.info(`[MONITORING_FEED] Fetched ${events.length} audit monitoring events (Page ${parsedPage})`);

    res.status(200).json({
      protocol: 'AP2/x402',
      pagination: {
        totalEvents: totalCount,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(totalCount / parsedLimit),
      },
      events,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/monitoring/alerts — Security & High-Risk Alert Feed
 */
router.get('/alerts', async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;
    const parsedLimit = Math.min(50, Math.max(1, Number(limit) || 20));

    // Fetch high priority alerts: BLOCKED actions, Payout Holds, Guardrail Triggers
    const alertLogs = await AuditLog.find({
      $or: [
        { decision: 'BLOCK' },
        { decision: 'REQUIRE_APPROVAL' },
        { decision: 'PAYOUT_HOLD' },
        { action: { $regex: /GUARDRAIL|FRAUD/i } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .populate('merchant', 'businessName email')
      .lean();

    res.status(200).json({
      protocol: 'AP2/x402',
      alertsCount: alertLogs.length,
      alerts: alertLogs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
