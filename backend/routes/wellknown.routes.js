const express = require('express');
const router = express.Router();
const { generateAgentCatalog } = require('../services/catalogFile.service');
const { generateAgentPolicy } = require('../services/policyFile.service');
const logger = require('../utils/logger');

/**
 * GET /.well-known/agentwell.json — AP2/x402 Protocol Compliance Manifest
 */
router.get('/agentwell.json', async (req, res, next) => {
  try {
    res.status(200).json({
      protocol: 'AP2/x402',
      version: '1.0.0',
      gateway: 'PayGate 402 Agentic Settlement Gateway',
      specification: 'https://github.com/Tejaspatil1175/Payment-Integrity-Mesh',
      features: {
        rsaPssSigning: true,
        intentSubmission: true,
        smartMerchantMatching: true,
        automatedNegotiation: true,
        realtimePolicyPrecheck: true,
        razorpayMcpBridge: true,
        postPaymentFulfillment: true,
        transactionGuardrails: true,
        gatedActions: true,
        fraudDetectionScoring: true,
        dataEncryptionAES256: true,
      },
      endpoints: {
        intent: '/api/agent/intent',
        negotiation: '/api/agent/negotiation',
        contract: '/api/agent/contract',
        payment: '/api/agent/payment',
        fulfillment: '/api/agent/fulfillment',
        agentCatalog: '/.well-known/agent-catalog.json',
        agentPolicy: '/.well-known/agent-policy.json',
      },
      supportedCurrencies: ['INR'],
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /.well-known/agent-catalog.json — Machine-readable Product Catalog Manifest (delegated to catalogFile.service.js)
 */
router.get('/agent-catalog.json', async (req, res, next) => {
  try {
    const merchantId = req.query.merchantId || null;
    const catalogData = await generateAgentCatalog(merchantId);
    logger.info(`[WELL_KNOWN] Served agent-catalog.json with ${catalogData.itemCount || 0} products`);
    res.status(200).json(catalogData);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /.well-known/agent-policy.json — Machine-readable Policy Rules & Guardrails Manifest (delegated to policyFile.service.js)
 */
router.get('/agent-policy.json', async (req, res, next) => {
  try {
    const merchantId = req.query.merchantId || null;
    const policyData = await generateAgentPolicy(merchantId);
    logger.info(`[WELL_KNOWN] Served agent-policy.json manifest`);
    res.status(200).json(policyData);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
