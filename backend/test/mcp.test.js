const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Merchant = require('../models/Merchant');
const PolicyRule = require('../models/PolicyRule');
const { handleMcpRequest } = require('../services/mcp.service');
const { generateNonce } = require('../utils/crypto');

describe('Safe Model Context Protocol (MCP) Gateway Suite', () => {
  let testMerchantId = null;
  let testProductId = null;
  let testPolicyId = null;
  let createdMerchant = false;

  before(async () => {
    if (mongoose.connection.readyState !== 1) {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/paygate402';
      await mongoose.connect(mongoUri);
    }

    // Seed test merchant & product safely
    let merchant = await Merchant.findOne();
    if (!merchant) {
      merchant = await Merchant.create({
        businessName: 'MCP Test Store',
        email: `mcp_test_${generateNonce().substring(0, 8)}@paygate.internal`,
        phone: `+9199${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'TestPassword123!',
        businessCategory: 'Apparel',
        status: 'approved',
        apiKey: `key_${generateNonce().substring(0, 16)}`,
        apiSecret: `sec_${generateNonce().substring(0, 16)}`,
      });
      createdMerchant = true;
    }
    testMerchantId = merchant._id;

    const product = await Product.create({
      merchant: testMerchantId,
      title: 'MCP Autonomous Running Shoes',
      description: 'High-performance AI agent tested shoes',
      price: 2500,
      stock: 50,
      category: 'Footwear',
      isAvailable: true,
    });
    testProductId = product._id;

    // Create policy rule
    const rule = await PolicyRule.create({
      merchant: testMerchantId,
      name: 'Agent Max Cap Policy',
      ruleType: 'max_spend_cap',
      maxAmount: 5000,
      isActive: true,
    });
    testPolicyId = rule._id;
  });

  after(async () => {
    if (testProductId) {
      await Product.deleteOne({ _id: testProductId });
    }
    if (testPolicyId) {
      await PolicyRule.deleteOne({ _id: testPolicyId });
    }
    if (createdMerchant && testMerchantId) {
      await Merchant.deleteOne({ _id: testMerchantId });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it('should return safe MCP tool schemas on tools/list', async () => {
    const req = {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1,
    };

    const res = await handleMcpRequest(req);

    assert.strictEqual(res.jsonrpc, '2.0');
    assert.strictEqual(res.id, 1);
    assert.ok(Array.isArray(res.result.tools));
    assert.strictEqual(res.result.tools.length, 2);

    const toolNames = res.result.tools.map((t) => t.name);
    assert.ok(toolNames.includes('discover_catalog'));
    assert.ok(toolNames.includes('check_cart_mandate'));
  });

  it('should execute discover_catalog read-only tool with machine-readable policy ceilings', async () => {
    const req = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'discover_catalog',
        arguments: {
          query: 'Shoes',
          budget_cap: 3000,
        },
      },
      id: 2,
    };

    const res = await handleMcpRequest(req);
    assert.strictEqual(res.jsonrpc, '2.0');
    assert.ok(res.result.content && res.result.content[0]);

    const parsedData = JSON.parse(res.result.content[0].text);
    assert.strictEqual(parsedData.safe, true);
    assert.strictEqual(parsedData.readOnly, true);
    assert.ok(parsedData.items.length >= 1);

    const firstItem = parsedData.items[0];
    assert.ok(firstItem.productId);
    assert.ok(firstItem.basePrice > 0);
    assert.strictEqual(firstItem.currency, 'INR');
    assert.ok(firstItem.policyBounds);
    assert.ok(firstItem.policyBounds.maxDiscountPercent > 0);
    assert.ok(firstItem.policyBounds.negotiationFloorPrice > 0);
    assert.strictEqual(firstItem.policyBounds.protocol, 'AP2/x402-Compliant');
  });

  it('should reject unknown or unsafe tools with JSON-RPC error -32601', async () => {
    const req = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'direct_debit_wallet_unsafe',
        arguments: { amount: 1000 },
      },
      id: 3,
    };

    const res = await handleMcpRequest(req);
    assert.strictEqual(res.jsonrpc, '2.0');
    assert.ok(res.error);
    assert.strictEqual(res.error.code, -32601);
    assert.match(res.error.message, /Unknown MCP tool/i);
  });
});
