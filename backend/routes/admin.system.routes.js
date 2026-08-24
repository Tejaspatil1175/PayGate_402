const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * GET /api/admin/system/health — Real-time System Uptime, DB, and MCP Protocol Status
 */
router.get('/health', async (req, res, next) => {
  try {
    const uptimeSeconds = Math.floor(process.uptime());
    const memoryUsage = process.memoryUsage();

    // MongoDB connection status
    const dbStateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    const dbStatus = dbStateMap[mongoose.connection.readyState] || 'unknown';

    // Razorpay MCP / SDK credentials status
    const hasRazorpayKey = Boolean(process.env.RAZORPAY_KEY_ID);
    const hasRazorpaySecret = Boolean(process.env.RAZORPAY_KEY_SECRET);
    const mcpStatus = (hasRazorpayKey && hasRazorpaySecret) ? 'ACTIVE' : 'CONFIG_MISSING';

    const systemHealth = {
      protocol: 'AP2/x402',
      service: 'PayGate 402 Agentic Settlement Gateway',
      status: (dbStatus === 'connected') ? 'HEALTHY' : 'DEGRADED',
      uptime: {
        seconds: uptimeSeconds,
        formatted: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`,
      },
      database: {
        status: dbStatus,
        name: mongoose.connection.name || 'paygate402',
      },
      mcpIntegration: {
        protocol: 'Razorpay MCP / AP2 Bridge',
        status: mcpStatus,
        keyConfigured: hasRazorpayKey,
        secretConfigured: hasRazorpaySecret,
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        memoryUsageMB: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        },
      },
      timestamp: new Date().toISOString(),
    };

    logger.info(`[SYSTEM_HEALTH] Status: ${systemHealth.status} | DB: ${dbStatus} | Uptime: ${systemHealth.uptime.formatted}`);

    res.status(200).json(systemHealth);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
