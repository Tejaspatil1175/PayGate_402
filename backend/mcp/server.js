const readline = require('readline');
const { MCP_TOOLS, executeTool } = require('./tools');

/**
 * Handle incoming JSON-RPC 2.0 MCP Request
 * @param {Object} request
 * @returns {Promise<Object>} JSON-RPC response
 */
async function handleMcpRequest(request) {
  const { jsonrpc = '2.0', id, method, params = {} } = request;

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc,
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'paygate-402-mcp-server',
              version: '1.0.0',
            },
          },
        };

      case 'tools/list':
        return {
          jsonrpc,
          id,
          result: {
            tools: MCP_TOOLS,
          },
        };

      case 'tools/call': {
        const { name, arguments: toolArgs = {} } = params;
        const toolResult = await executeTool(name, toolArgs);
        return {
          jsonrpc,
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(toolResult, null, 2),
              },
            ],
            isError: toolResult.success === false,
          },
        };
      }

      case 'ping':
        return { jsonrpc, id, result: {} };

      default:
        return {
          jsonrpc,
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
    }
  } catch (error) {
    return {
      jsonrpc,
      id,
      error: {
        code: -32603,
        message: error.message || 'Internal MCP Server Error',
      },
    };
  }
}

/**
 * Run standalone stdio server for Claude Desktop / Cursor / Terminal Agents
 */
function startStdioServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', async (line) => {
    if (!line.trim()) return;
    try {
      const request = JSON.parse(line);
      const response = await handleMcpRequest(request);
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (err) {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error: invalid JSON' },
        }) + '\n'
      );
    }
  });
}

if (require.main === module) {
  startStdioServer();
}

module.exports = {
  handleMcpRequest,
  startStdioServer,
};
