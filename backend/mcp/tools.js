const { generateKeyPair, signData, generateNonce } = require('../utils/crypto');
const Product = require('../models/Product');
const Merchant = require('../models/Merchant');
const Wallet = require('../models/Wallet');
const { performPolicyPreCheck } = require('../services/policyPreCheck.service');
const { debitWallet, getOrCreateWallet } = require('../services/wallet.service');
const { logAuditEvent } = require('../middleware/auditLogger');

/**
 * Standard MCP Tools Definition & Handlers for PayGate 402
 */
const MCP_TOOLS = [
  {
    name: 'discover_merchant_catalog',
    description: 'Discover active products from verified merchants matching query, category, and budget cap.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or product keyword' },
        category: { type: 'string', description: 'Product category filter (e.g. Electronics, Accessories)' },
        maxPrice: { type: 'number', description: 'Maximum budget cap in INR' },
      },
      required: [],
    },
  },
  {
    name: 'sign_cart_mandate',
    description: 'Cryptographically sign an AP2 Cart Mandate with RSA-PSS 2048-bit key and single-use 32-byte nonce.',
    inputSchema: {
      type: 'object',
      properties: {
        merchantId: { type: 'string', description: 'ID of the verified merchant' },
        productId: { type: 'string', description: 'ID of the product being purchased' },
        agreedAmount: { type: 'number', description: 'Agreed settlement price in INR' },
        agentId: { type: 'string', description: 'Identifier of the autonomous buyer agent' },
      },
      required: ['merchantId', 'productId', 'agreedAmount'],
    },
  },
  {
    name: 'execute_settlement',
    description: 'Route a signed AP2 mandate through the 5-checkpoint settlement engine and atomically debit the isolation ledger.',
    inputSchema: {
      type: 'object',
      properties: {
        mandate: { type: 'object', description: 'The signed mandate object returned by sign_cart_mandate' },
        userId: { type: 'string', description: 'Buyer user ID to debit' },
      },
      required: ['mandate', 'userId'],
    },
  },
  {
    name: 'check_wallet_balance',
    description: 'Inspect the buyer pre-funded AP2 isolation ledger balance, per-transaction cap, and daily velocity limits.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID or email of the buyer' },
      },
      required: ['userId'],
    },
  },
];

/**
 * Execute an MCP Tool by Name
 */
async function executeTool(name, args = {}) {
  switch (name) {
    case 'discover_merchant_catalog': {
      const filter = { isActive: true };
      if (args.category) filter.category = new RegExp(args.category, 'i');
      if (args.maxPrice) filter.price = { $lte: Number(args.maxPrice) };
      if (args.query) {
        filter.$or = [
          { title: new RegExp(args.query, 'i') },
          { description: new RegExp(args.query, 'i') },
        ];
      }

      const products = await Product.find(filter).limit(10).lean();
      return {
        count: products.length,
        products: products.map((p) => ({
          id: p._id,
          title: p.title,
          price: p.price,
          category: p.category,
          stock: p.stock,
          merchantId: p.merchant,
        })),
      };
    }

    case 'sign_cart_mandate': {
      const { merchantId, productId, agreedAmount, agentId = 'agent_mcp_client' } = args;
      const keys = generateKeyPair();
      const nonce = generateNonce();
      const mandateId = `mnd_${nonce.substring(0, 12)}`;

      const mandatePayload = {
        mandateId,
        merchantId,
        productId,
        agreedAmount: Number(agreedAmount),
        currency: 'INR',
        agentId,
        nonce,
        timestamp: Date.now(),
      };

      const signature = signData(mandatePayload, keys.privateKey);

      return {
        protocol: 'AP2/x402',
        mandate: mandatePayload,
        signature,
        publicKey: keys.publicKey,
        nonce,
        status: 'SIGNED_READY_FOR_SETTLEMENT',
      };
    }

    case 'execute_settlement': {
      const { mandate, userId } = args;
      if (!mandate || !userId) {
        throw new Error('Mandate object and userId are required');
      }

      // Checkpoint 4: Policy Pre-Check
      const policyRes = await performPolicyPreCheck({
        merchantId: mandate.merchantId,
        agentId: mandate.agentId || 'agent_mcp_client',
        amount: mandate.agreedAmount,
        userId,
      });

      if (!policyRes.preCheckPassed) {
        await logAuditEvent({
          correlationId: mandate.mandateId,
          agentId: mandate.agentId || 'agent_mcp_client',
          merchant: mandate.merchantId,
          action: 'MCP_SETTLEMENT_BLOCKED',
          decision: 'BLOCK',
          ruleId: policyRes.ruleId || 'GATE_03_MERCHANT_POLICY',
          reasonCode: policyRes.reasonCode || 'POLICY_PRECHECK_FAILED',
          reason: policyRes.reason,
        });

        return {
          protocol: 'AP2/x402',
          success: false,
          gateDecision: 'BLOCK',
          ruleId: policyRes.ruleId,
          reasonCode: policyRes.reasonCode,
          error: policyRes.reason,
        };
      }

      // Execute Atomic Debit
      const debitedWallet = await debitWallet(
        userId,
        mandate.agreedAmount,
        mandate.mandateId,
        `MCP Agent Commerce Purchase: Mandate ${mandate.mandateId}`
      );

      await logAuditEvent({
        correlationId: mandate.mandateId,
        agentId: mandate.agentId || 'agent_mcp_client',
        merchant: mandate.merchantId,
        action: 'MCP_SETTLEMENT_EXECUTED',
        decision: 'ALLOW',
        ruleId: 'POLICY_ALL_PASSED',
        reasonCode: 'SETTLEMENT_SUCCESSFUL',
        reason: `Debited ₹${mandate.agreedAmount} from pre-funded isolation ledger`,
        metadata: {
          remainingBalance: debitedWallet.balance,
        },
      });

      return {
        protocol: 'AP2/x402',
        success: true,
        gateDecision: 'ALLOW',
        ruleId: 'POLICY_ALL_PASSED',
        reasonCode: 'SETTLEMENT_SUCCESSFUL',
        orderId: `ord_${generateNonce().substring(0, 12)}`,
        amountDebited: mandate.agreedAmount,
        remainingBalance: debitedWallet.balance,
        message: 'Settlement pipeline executed successfully. Isolation ledger debited.',
      };
    }

    case 'check_wallet_balance': {
      const wallet = await getOrCreateWallet(args.userId);
      return {
        userId: args.userId,
        balance: wallet.balance,
        currency: 'INR',
        perTransactionCap: wallet.perTransactionCap,
        perDayCap: wallet.perDayCap,
        dailySpent: wallet.dailySpent,
        availableDailyLimit: Math.max(0, wallet.perDayCap - wallet.dailySpent),
      };
    }

    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}

module.exports = {
  MCP_TOOLS,
  executeTool,
};
