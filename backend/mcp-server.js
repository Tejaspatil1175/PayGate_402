#!/usr/bin/env node
/**
 * PayGate 402 — Standalone Stdio Model Context Protocol (MCP) Server
 * 
 * Run via CLI:
 * node backend/mcp-server.js
 * 
 * Connects standard agent runtimes (Claude Desktop, Cursor, local agent bots)
 * directly to PayGate 402's safe catalog and 5-gate mandate pipeline over stdio.
 */

const readline = require('readline');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const { handleMcpRequest } = require('./services/mcp.service');

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/paygate402';
  try {
    await mongoose.connect(mongoUri);
    process.stderr.write(`[PayGate-MCP] Connected to MongoDB for safe tool resolution\n`);
  } catch (err) {
    process.stderr.write(`[PayGate-MCP] Warning: MongoDB connection deferred: ${err.message}\n`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  process.stderr.write(`[PayGate-MCP] PayGate 402 Safe MCP Server ready on stdio\n`);

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const payload = JSON.parse(trimmed);
      const response = await handleMcpRequest(payload);
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (err) {
      const errorResp = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: `Parse error: ${err.message}`,
        },
      };
      process.stdout.write(JSON.stringify(errorResp) + '\n');
    }
  });
}

main();
