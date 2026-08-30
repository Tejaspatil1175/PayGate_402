# 03. Model Context Protocol (MCP) Server & Tools

## Overview

PayGate 402 provides a native **Model Context Protocol (MCP)** server layer (`backend/mcp/server.js`) conforming to the official `2024-11-05` specification. This allows external AI agent runtimes (such as Claude Desktop, Cursor, and custom agentic frameworks) to interact directly with merchant catalogs and execute cryptographically gated settlements.

---

## Supported Transports

1. **Stdio Interface (`node mcp/server.js` / `npm run mcp`)**:
   - For local CLI and desktop agent integrations (e.g. Claude Desktop configuration).
2. **HTTP Streamable JSON-RPC Endpoint (`POST /api/mcp` & `GET /api/mcp/tools`)**:
   - For remote web agent callers and microservice architectures.

---

## Exposed MCP Tools Catalog

### 1. `discover_merchant_catalog`
* **Description**: Queries live merchant product catalogs filtered by category, keyword query, and maximum budget cap.
* **Input Schema**:
  ```json
  {
    "query": "string (optional)",
    "category": "string (optional)",
    "maxPrice": "number (optional)"
  }
  ```

### 2. `sign_cart_mandate`
* **Description**: Cryptographically signs an AP2 Cart Mandate with RSA-PSS 2048-bit keys and generates a single-use 32-byte nonce.
* **Input Schema**:
  ```json
  {
    "merchantId": "string (required)",
    "productId": "string (required)",
    "agreedAmount": "number (required)",
    "agentId": "string (optional)"
  }
  ```

### 3. `execute_settlement`
* **Description**: Submits the signed mandate through the 5-checkpoint settlement pipeline (`GATE_01` to `GATE_05`) and debits the isolation ledger.
* **Input Schema**:
  ```json
  {
    "mandate": "object (required)",
    "userId": "string (required)"
  }
  ```

### 4. `check_wallet_balance`
* **Description**: Inspects remaining wallet balance, per-transaction spending caps, and rolling 24-hour daily spend limits.
* **Input Schema**:
  ```json
  {
    "userId": "string (required)"
  }
  ```

---

## Integration with Claude Desktop

To connect Claude Desktop to PayGate 402, add the following to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "paygate402": {
      "command": "node",
      "args": ["d:/projects/razorpay/backend/mcp/server.js"],
      "env": {
        "MONGODB_URI": "your_mongodb_connection_string"
      }
    }
  }
}
```
