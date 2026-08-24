const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const PolicyRule = require('../models/PolicyRule');
const Merchant = require('../models/Merchant');
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
 * GET /.well-known/agent-catalog.json — Machine-readable Product Catalog Manifest
 */
router.get('/agent-catalog.json', async (req, res, next) => {
  try {
    const products = await Product.find({ isAvailable: true, stock: { $gt: 0 } })
      .select('title description price currency category stock sku tags merchant')
      .populate('merchant', 'businessName email')
      .lean();

    const catalogItems = products.map((p) => ({
      productId: p._id,
      title: p.title,
      description: p.description,
      price: p.price,
      currency: p.currency || 'INR',
      category: p.category || 'General',
      stock: p.stock,
      sku: p.sku,
      merchant: {
        id: p.merchant?._id,
        name: p.merchant?.businessName || 'Merchant',
      },
    }));

    logger.info(`[WELL_KNOWN] Served agent-catalog.json with ${catalogItems.length} products`);

    res.status(200).json({
      protocol: 'AP2/x402',
      manifestType: 'agent-catalog',
      totalItems: catalogItems.length,
      products: catalogItems,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /.well-known/agent-policy.json — Machine-readable Policy Rules & Guardrails Manifest
 */
router.get('/agent-policy.json', async (req, res, next) => {
  try {
    const activeRules = await PolicyRule.find({ isActive: true })
      .populate('merchant', 'businessName')
      .lean();

    const formattedRules = activeRules.map((r) => ({
      ruleId: r._id,
      merchant: r.merchant?.businessName || 'Platform Global',
      name: r.name,
      ruleType: r.ruleType,
      maxAmount: r.maxAmount,
      dailyCap: r.dailyCap,
      allowedCategories: r.allowedCategories,
      requireApprovalThreshold: r.requireApprovalThreshold,
    }));

    logger.info(`[WELL_KNOWN] Served agent-policy.json with ${formattedRules.length} active rules`);

    res.status(200).json({
      protocol: 'AP2/x402',
      manifestType: 'agent-policy',
      globalGuardrails: {
        maxSingleTransactionAmount: 100000,
        maxRequestsPerWindow: 10,
        windowMinutes: 15,
        defaultManualApprovalThreshold: 25000,
        firstTimeBuyerLimit: 10000,
      },
      merchantRulesCount: formattedRules.length,
      merchantRules: formattedRules,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
