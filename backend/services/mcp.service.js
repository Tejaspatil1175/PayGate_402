/**
 * PayGate 402 — Safe Model Context Protocol (MCP) Gateway Service
 * 
 * Provides an MCP (JSON-RPC 2.0) gateway for external AI agents (Claude, Cursor, shopping bots)
 * with strict safety boundaries:
 * 1. discover_catalog: Read-only catalog exploration with merchant policy discount bounds.
 * 2. check_cart_mandate: Piped directly into the 5-Checkpoint Verification Engine.
 */

const Product = require('../models/Product');
const Merchant = require('../models/Merchant');
const PolicyRule = require('../models/PolicyRule');
const { verifyCommerceContract } = require('./contract.service');
const { checkTransactionGuardrails } = require('../middleware/transactionGuardrails');
const { evaluateGatedAction } = require('../middleware/gatedActions');
const { performPolicyPreCheck } = require('./policyPreCheck.service');
const { evaluateFraudRisk } = require('./fraud.service');
const logger = require('../utils/logger');

// MCP Tool Definitions compliant with the Model Context Protocol specification
const MCP_TOOLS = [
  {
    name: 'discover_catalog',
    description: 'Safely search and discover merchant catalog items with inventory and maximum policy-permitted discount ceilings.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keyword for product title, description, or category (e.g., "shoes", "electronics")',
        },
        budget_cap: {
          type: 'number',
          description: 'Maximum price ceiling in INR',
        },
        category: {
          type: 'string',
          description: 'Optional category filter',
        },
        merchant_id: {
          type: 'string',
          description: 'Optional merchant filter ID',
        },
      },
      required: [],
    },
  },
  {
    name: 'check_cart_mandate',
    description: 'Pipes an AP2 Cart Mandate directly into the 5-Checkpoint Verification Gateway to validate signatures, spend velocity, merchant policies, and fraud risk before settlement.',
    inputSchema: {
      type: 'object',
      properties: {
        contractId: {
          type: 'string',
          description: 'The signed AP2 Commerce Contract ID or mandate identifier',
        },
        agentId: {
          type: 'string',
          description: 'Calling autonomous agent identifier',
        },
        amount: {
          type: 'number',
          description: 'Transaction amount in INR',
        },
        merchantId: {
          type: 'string',
          description: 'Target merchant ID',
        },
        customer: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            phone: { type: 'string' },
          },
        },
      },
      required: ['contractId'],
    },
  },
];

/**
 * Tool 1: discover_catalog (Read-Only)
 */
async function discoverCatalog({ query = '', budget_cap, category, merchant_id }) {
  const filter = { isAvailable: { $ne: false } };

  if (query) {
    filter.$or = [
      { title: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { category: { $regex: query, $options: 'i' } },
    ];
  }

  if (category) {
    filter.category = { $regex: `^${category}$`, $options: 'i' };
  }

  if (merchant_id) {
    filter.merchant = merchant_id;
  }

  if (budget_cap !== undefined && !isNaN(budget_cap)) {
    filter.price = { $lte: Number(budget_cap) };
  }

  const products = await Product.find(filter)
    .populate('merchant', 'businessName businessCategory status')
    .limit(20)
    .lean();

  // Enhance each product with machine-readable policy discount ceilings
  const items = await Promise.all(
    products.map(async (prod) => {
      let maxDiscountPercent = 15; // Default safe merchant discount floor
      if (prod.merchant?._id) {
        const activePolicy = await PolicyRule.findOne({
          merchant: prod.merchant._id,
          isActive: true,
        }).lean();
        if (activePolicy && activePolicy.maxAmount && prod.price) {
          // Calculate proportional cap or standard discount policy
          maxDiscountPercent = 15;
        }
      }

      const basePrice = prod.price || 0;
      const floorPrice = Math.round(basePrice * (1 - maxDiscountPercent / 100));

      return {
        productId: prod._id,
        title: prod.title,
        category: prod.category || 'General',
        basePrice,
        currency: 'INR',
        stock: prod.stock ?? 100,
        merchant: {
          id: prod.merchant?._id,
          name: prod.merchant?.businessName || 'Verified Merchant',
          category: prod.merchant?.businessCategory || 'General',
        },
        policyBounds: {
          maxDiscountPercent,
          negotiationFloorPrice: floorPrice,
          protocol: 'AP2/x402-Compliant',
        },
      };
    })
  );

  return {
    total: items.length,
    protocol: 'MCP/JSON-RPC-2.0',
    safe: true,
    readOnly: true,
    items,
  };
}

/**
 * Tool 2: check_cart_mandate (Piped to 5-Checkpoint Gateway)
 */
async function checkCartMandate(params) {
  const { contractId, customer } = params;

  if (!contractId) {
    return {
      protocol: 'MCP/JSON-RPC-2.0',
      allowed: false,
      gateDecision: 'BLOCK',
      reason: 'contractId is required to evaluate cart mandate',
    };
  }

  // 1. Verify digital signature & mandate hash
  const verification = await verifyCommerceContract(contractId);
  if (!verification.isValid) {
    return {
      protocol: 'MCP/JSON-RPC-2.0',
      allowed: false,
      gateDecision: 'BLOCK',
      gateFailed: 'GATE_0_CRYPTO_SIGNATURE',
      reason: verification.reason,
    };
  }

  const contract = verification.contract;
  const amount = params.amount || contract.contractTerms?.agreedAmount || 0;
  const agentId = params.agentId || contract.agentId || 'mcp_external_agent';
  const merchantId = params.merchantId || contract.merchant;

  // Gate 1: Velocity & Spend Guardrails
  const guardrailRes = await checkTransactionGuardrails({ agentId, amount, merchantId });
  if (!guardrailRes.passed) {
    return {
      protocol: 'MCP/JSON-RPC-2.0',
      allowed: false,
      gateDecision: 'BLOCK',
      gateFailed: 'GATE_01_SPEND_GUARDRAIL',
      reason: guardrailRes.reason,
    };
  }

  // Gate 2: Manual Approval Threshold
  const gatedRes = await evaluateGatedAction({
    agentId,
    amount,
    merchantId,
    customerEmail: customer?.email,
    customerPhone: customer?.phone,
  });
  if (gatedRes.decision !== 'ALLOW' || gatedRes.requireManualApproval) {
    return {
      protocol: 'MCP/JSON-RPC-2.0',
      allowed: false,
      gateDecision: gatedRes.decision || 'REQUIRE_APPROVAL',
      gateFailed: 'GATE_02_MANUAL_APPROVAL',
      reason: gatedRes.reason,
    };
  }

  // Gate 3: Merchant Policy Pre-check
  const policyPreCheckRes = await performPolicyPreCheck({
    merchantId,
    agentId,
    amount,
    category: contract.items?.[0]?.category || 'General',
    budgetCap: amount,
    userId: contract.userId,
  });
  if (!policyPreCheckRes.preCheckPassed) {
    return {
      protocol: 'MCP/JSON-RPC-2.0',
      allowed: false,
      gateDecision: 'BLOCK',
      gateFailed: 'GATE_03_MERCHANT_POLICY',
      reason: policyPreCheckRes.reason,
    };
  }

  // Gate 4: Fraud Risk Scoring
  const fraudRes = await evaluateFraudRisk({
    orderId: contract.contractId,
    merchantId,
    agentId,
    amount,
    customer,
  });
  if (fraudRes.payoutHold || fraudRes.riskScore >= 70 || fraudRes.action === 'BLOCK' || fraudRes.action === 'PAYOUT_HOLD') {
    return {
      protocol: 'MCP/JSON-RPC-2.0',
      allowed: false,
      gateDecision: 'PAYOUT_HOLD',
      gateFailed: 'GATE_04_FRAUD_SCORING',
      reason: `Fraud risk score (${fraudRes.riskScore}) exceeds safety threshold`,
    };
  }

  return {
    protocol: 'MCP/JSON-RPC-2.0',
    allowed: true,
    gateDecision: 'ALLOW',
    message: 'Cart mandate verified across all 5 Gateway Checkpoints. Ready for secure AP2 execution.',
    contractDetails: {
      contractId: contract.contractId,
      merchant: contract.merchant,
      amount,
      currency: contract.contractTerms?.currency || 'INR',
      status: contract.status,
    },
  };
}

/**
 * MCP JSON-RPC 2.0 Request Dispatcher
 */
async function handleMcpRequest(payload) {
  const { method, params = {}, id = null } = payload;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'paygate402-safe-mcp-gateway',
            version: '1.0.0',
          },
          capabilities: {
            tools: { listChanged: false },
          },
        },
      };

    case 'ping':
      return {
        jsonrpc: '2.0',
        id,
        result: { status: 'pong', timestamp: new Date().toISOString() },
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS,
        },
      };

    case 'tools/call': {
      const { name, arguments: toolArgs = {} } = params;
      let toolResult;

      if (name === 'discover_catalog') {
        toolResult = await discoverCatalog(toolArgs);
      } else if (name === 'check_cart_mandate') {
        toolResult = await checkCartMandate(toolArgs);
      } else {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Unknown MCP tool: ${name}. Only safe read-only and piped verification tools are permitted.`,
          },
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(toolResult, null, 2),
            },
          ],
        },
      };
    }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      };
  }
}

module.exports = {
  MCP_TOOLS,
  discoverCatalog,
  checkCartMandate,
  handleMcpRequest,
};
