const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { handleMcpRequest } = require('../mcp/server');
const { MCP_TOOLS } = require('../mcp/tools');

describe('Model Context Protocol (MCP) Server & Tool Suite', () => {
  it('should respond to initialize method with valid MCP server capabilities', async () => {
    const initRequest = {
      jsonrpc: '2.0',
      id: 'req_001',
      method: 'initialize',
      params: {},
    };

    const response = await handleMcpRequest(initRequest);
    assert.strictEqual(response.jsonrpc, '2.0');
    assert.strictEqual(response.id, 'req_001');
    assert.ok(response.result.capabilities.tools);
    assert.strictEqual(response.result.serverInfo.name, 'paygate-402-mcp-server');
  });

  it('should list all available PayGate 402 commerce tools on tools/list', async () => {
    const listRequest = {
      jsonrpc: '2.0',
      id: 'req_002',
      method: 'tools/list',
    };

    const response = await handleMcpRequest(listRequest);
    assert.strictEqual(response.id, 'req_002');
    assert.ok(Array.isArray(response.result.tools));
    assert.ok(response.result.tools.length >= 4);

    const toolNames = response.result.tools.map((t) => t.name);
    assert.ok(toolNames.includes('discover_merchant_catalog'));
    assert.ok(toolNames.includes('sign_cart_mandate'));
    assert.ok(toolNames.includes('execute_settlement'));
    assert.ok(toolNames.includes('check_wallet_balance'));
  });

  it('should execute sign_cart_mandate tool and produce valid RSA-PSS signed payload', async () => {
    const callRequest = {
      jsonrpc: '2.0',
      id: 'req_003',
      method: 'tools/call',
      params: {
        name: 'sign_cart_mandate',
        arguments: {
          merchantId: 'merchant_acme_123',
          productId: 'prod_headphones_456',
          agreedAmount: 2499,
          agentId: 'claude_desktop_buyer',
        },
      },
    };

    const response = await handleMcpRequest(callRequest);
    assert.strictEqual(response.id, 'req_003');
    assert.ok(response.result.content);
    assert.strictEqual(response.result.isError, false);

    const parsedResult = JSON.parse(response.result.content[0].text);
    assert.strictEqual(parsedResult.protocol, 'AP2/x402');
    assert.strictEqual(parsedResult.status, 'SIGNED_READY_FOR_SETTLEMENT');
    assert.strictEqual(parsedResult.mandate.agreedAmount, 2499);
    assert.ok(parsedResult.signature);
    assert.ok(parsedResult.publicKey);
    assert.ok(parsedResult.nonce);
    assert.strictEqual(parsedResult.nonce.length, 64);
  });

  it('should return error on unknown MCP method', async () => {
    const invalidRequest = {
      jsonrpc: '2.0',
      id: 'req_004',
      method: 'non_existent_method',
    };

    const response = await handleMcpRequest(invalidRequest);
    assert.strictEqual(response.id, 'req_004');
    assert.ok(response.error);
    assert.strictEqual(response.error.code, -32601);
  });
});
