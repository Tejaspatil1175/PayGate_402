const express = require('express');
const router = express.Router();
const { MCP_TOOLS, handleMcpRequest } = require('../services/mcp.service');
const { McpJsonRpcSchema, validateBody } = require('../middleware/schemaValidation');

/**
 * @route   POST /api/mcp
 * @desc    Model Context Protocol (MCP) JSON-RPC 2.0 endpoint for external AI agents
 */
router.post('/', validateBody(McpJsonRpcSchema), async (req, res) => {
  try {
    const response = await handleMcpRequest(req.body);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: `Internal MCP error: ${error.message}`,
      },
    });
  }
});

/**
 * @route   GET /api/mcp/tools
 * @desc    List available safe MCP tools and JSON schemas
 */
router.get('/tools', (req, res) => {
  res.status(200).json({
    protocol: 'MCP/JSON-RPC-2.0',
    server: 'paygate402-safe-mcp-gateway',
    safetyGuarantees: [
      'Read-only catalog & policy ceiling discovery',
      'Cart mandates strictly piped into 5-Checkpoint Verification Gateway',
      'Zero direct unverified wallet debit access',
    ],
    tools: MCP_TOOLS,
  });
});

/**
 * @route   GET /api/mcp/status
 * @desc    Gateway status for MCP integration
 */
router.get('/status', (req, res) => {
  res.status(200).json({
    status: 'ACTIVE',
    protocol: 'Model Context Protocol (MCP) 2024-11-05',
    mode: 'Safe Bounded Gateway',
    activeToolsCount: MCP_TOOLS.length,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
