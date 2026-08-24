const express = require('express');
const router = express.Router();

/**
 * GET /api — API Directory & Protocol Specification Index
 */
router.get('/', (req, res) => {
  res.status(200).json({
    protocol: 'AP2/x402',
    name: 'PayGate 402 — Agentic Settlement Gateway',
    version: '1.0.0',
    documentation: '/docs/openapi.yaml',
    modules: {
      merchantAuth: '/api/merchant/auth',
      catalog: '/api/catalog',
      merchantOrders: '/api/merchant/orders',
      registry: '/api/registry',
      agentIntent: '/api/agent/intent',
      agentNegotiation: '/api/agent/negotiation',
      agentContract: '/api/agent/contract',
      agentPayment: '/api/agent/payment',
      agentFulfillment: '/api/agent/fulfillment',
      analytics: '/api/analytics',
      adminOverview: '/api/admin/overview',
      adminMonitoring: '/api/admin/monitoring',
      adminSystem: '/api/admin/system',
      adminConfig: '/api/admin/config',
      wellKnownAgentwell: '/.well-known/agentwell.json',
      wellKnownCatalog: '/.well-known/agent-catalog.json',
      wellKnownPolicy: '/.well-known/agent-policy.json',
      webhooks: '/api/webhooks/razorpay',
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
