const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const Order = require('../models/Order');
const Contract = require('../models/Contract');
const Intent = require('../models/Intent');
const AuditLog = require('../models/AuditLog');
const Negotiation = require('../models/Negotiation');
const Campaign = require('../models/Campaign');
const ScheduledTask = require('../models/ScheduledTask');
const Wishlist = require('../models/Wishlist');
const Wallet = require('../models/Wallet');
const Product = require('../models/Product');
const Merchant = require('../models/Merchant');
const User = require('../models/User');
const PolicyRule = require('../models/PolicyRule');
const UserAgent = require('../models/UserAgent');
const UserPersona = require('../models/UserPersona');
const Registry = require('../models/Registry');
const AgentType = require('../models/AgentType');

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

/**
 * POST /api/admin/system/reset — Full Database Reset & Clean Purge across ALL collections (Preserving Schemas)
 */
router.post('/reset', async (req, res, next) => {
  try {
    const {
      purgeMerchants = true,
      purgeProducts = true,
      purgeUsers = true,
      purgeOrders = true,
      purgeContracts = true,
      purgeIntents = true,
      purgeAuditLogs = true,
      purgeNegotiations = true,
      purgeCampaigns = true,
      purgePolicyRules = true,
      purgeScheduledTasks = true,
      purgeWishlists = true,
      purgeWallets = true,
      purgeUserAgents = true,
      purgeUserPersonas = true,
      purgeRegistries = true,
      purgeAgentTypes = false, // Keep default agent templates unless specified
    } = req.body || {};

    const deletedCounts = {};

    // 1. Merchants & Catalog
    if (purgeMerchants) {
      const r = await Merchant.deleteMany({});
      deletedCounts.merchants = r.deletedCount;
    }
    if (purgeProducts) {
      const r = await Product.deleteMany({});
      deletedCounts.products = r.deletedCount;
    }

    // 2. Users & Wallets
    if (purgeUsers) {
      const r = await User.deleteMany({});
      deletedCounts.users = r.deletedCount;
    }
    if (purgeWallets) {
      const r = await Wallet.deleteMany({});
      deletedCounts.wallets = r.deletedCount;
    }
    if (purgeUserAgents) {
      const r = await UserAgent.deleteMany({});
      deletedCounts.userAgents = r.deletedCount;
    }
    if (purgeUserPersonas) {
      const r = await UserPersona.deleteMany({});
      deletedCounts.userPersonas = r.deletedCount;
    }

    // 3. Transactions & AP2 Mandates
    if (purgeOrders) {
      const r = await Order.deleteMany({});
      deletedCounts.orders = r.deletedCount;
    }
    if (purgeContracts) {
      const r = await Contract.deleteMany({});
      deletedCounts.contracts = r.deletedCount;
    }
    if (purgeIntents) {
      const r = await Intent.deleteMany({});
      deletedCounts.intents = r.deletedCount;
    }
    if (purgeNegotiations) {
      const r = await Negotiation.deleteMany({});
      deletedCounts.negotiations = r.deletedCount;
    }

    // 4. Governance & Telemetry
    if (purgeAuditLogs) {
      const r = await AuditLog.deleteMany({});
      deletedCounts.auditLogs = r.deletedCount;
    }
    if (purgeCampaigns) {
      const r = await Campaign.deleteMany({});
      deletedCounts.campaigns = r.deletedCount;
    }
    if (purgePolicyRules) {
      const r = await PolicyRule.deleteMany({});
      deletedCounts.policyRules = r.deletedCount;
    }
    if (purgeScheduledTasks) {
      const r = await ScheduledTask.deleteMany({});
      deletedCounts.scheduledTasks = r.deletedCount;
    }
    if (purgeWishlists) {
      const r = await Wishlist.deleteMany({});
      deletedCounts.wishlists = r.deletedCount;
    }
    if (purgeRegistries) {
      const r = await Registry.deleteMany({});
      deletedCounts.registries = r.deletedCount;
    }
    if (purgeAgentTypes) {
      const r = await AgentType.deleteMany({});
      deletedCounts.agentTypes = r.deletedCount;
    }

    logger.warn(`[DATABASE_FULL_RESET] Admin executed full database purge across all collections: ${JSON.stringify(deletedCounts)}`);

    res.status(200).json({
      protocol: 'AP2/x402',
      success: true,
      message: 'Database fully purged across all collections (Merchants, Products, Users, Orders, Mandates & Logs wiped). Schemas preserved.',
      deletedCounts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
