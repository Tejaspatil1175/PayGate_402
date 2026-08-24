const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Memory store for dynamic runtime feature flags and maintenance mode configuration
const platformConfigStore = {
  maintenanceMode: false,
  maintenanceMessage: 'System is currently undergoing scheduled maintenance. Please retry shortly.',
  featureFlags: {
    enableFraudScoring: true,
    enableUpsellEngine: true,
    enableDiscountOptimizer: true,
    enableGatedActions: true,
    enableTransactionGuardrails: true,
    enableAbandonedCartRecovery: true,
  },
  globalLimits: {
    maxSingleTransactionAmount: 100000,
    defaultManualApprovalThreshold: 25000,
    firstTimeBuyerSpendLimit: 10000,
  },
  updatedAt: new Date().toISOString(),
};

/**
 * GET /api/admin/config — Fetch current platform config and feature flags
 */
router.get('/', (req, res) => {
  res.status(200).json({
    protocol: 'AP2/x402',
    config: platformConfigStore,
  });
});

/**
 * PUT /api/admin/config — Update feature flags, maintenance mode, or global limits
 */
router.put('/', (req, res) => {
  const { maintenanceMode, maintenanceMessage, featureFlags, globalLimits } = req.body;

  if (typeof maintenanceMode === 'boolean') {
    platformConfigStore.maintenanceMode = maintenanceMode;
  }
  if (maintenanceMessage && typeof maintenanceMessage === 'string') {
    platformConfigStore.maintenanceMessage = maintenanceMessage;
  }
  if (featureFlags && typeof featureFlags === 'object') {
    platformConfigStore.featureFlags = {
      ...platformConfigStore.featureFlags,
      ...featureFlags,
    };
  }
  if (globalLimits && typeof globalLimits === 'object') {
    platformConfigStore.globalLimits = {
      ...platformConfigStore.globalLimits,
      ...globalLimits,
    };
  }

  platformConfigStore.updatedAt = new Date().toISOString();

  logger.warn(`[ADMIN_CONFIG_UPDATE] Platform configuration updated. Maintenance mode: ${platformConfigStore.maintenanceMode}`);

  res.status(200).json({
    protocol: 'AP2/x402',
    message: 'Platform configuration successfully updated',
    config: platformConfigStore,
  });
});

/**
 * Middleware helper to check if system is in maintenance mode
 */
function maintenanceModeCheck(req, res, next) {
  if (platformConfigStore.maintenanceMode && !req.originalUrl.startsWith('/api/admin')) {
    return res.status(503).json({
      protocol: 'AP2/x402',
      error: 'MAINTENANCE_MODE',
      message: platformConfigStore.maintenanceMessage,
    });
  }
  next();
}

module.exports = router;
module.exports.platformConfigStore = platformConfigStore;
module.exports.maintenanceModeCheck = maintenanceModeCheck;
