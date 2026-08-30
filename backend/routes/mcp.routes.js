const express = require('express');
const router = express.Router();
const { handleMcpRequest } = require('../mcp/server');
const { MCP_TOOLS } = require('../mcp/tools');

// GET /api/mcp/tools — List all available MCP tools
router.get('/tools', (req, res) => {
  res.status(200).json({
    protocol: 'mcp/2024-11-05',
    success: true,
    count: MCP_TOOLS.length,
    tools: MCP_TOOLS,
  });
});

// POST /api/mcp — JSON-RPC 2.0 endpoint for MCP clients
router.post('/', async (req, res, next) => {
  try {
    const response = await handleMcpRequest(req.body);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
