# PayGate 402 — API Reference, AP2 / x402 Protocol & MCP Specification

> **Complete REST Endpoint Reference, AP2 Cart Mandate Schemas, Coinbase x402 Challenge Protocol & Model Context Protocol (MCP) Gateway**

---

## 1. Protocol Architecture & Base URLs

PayGate 402 exposes three distinct machine-to-machine communication interfaces:
1. **REST API Interface:** Standard JSON REST endpoints over HTTPS for buyer apps, merchant portals, and agent executors.
2. **Model Context Protocol (MCP) Gateway:** JSON-RPC 2.0 compliant tool provider at `POST /api/mcp` for LLM agents (Claude, Cursor, AutoGen).
3. **RFC 8615 Well-Known Discovery:** Static/dynamic manifests hosted at `/.well-known/agent-catalog.json` and `/.well-known/agent-policy.json`.

- **Local Base URL:** `http://localhost:4000`
- **Hosted Base URL:** `https://pay-gate-402.vercel.app` (Frontend) / Production API server

---

## 2. Model Context Protocol (MCP) JSON-RPC 2.0 Gateway

The MCP endpoint allows autonomous AI agents to discover products and test cart mandates through standard JSON-RPC 2.0 requests.

### Endpoint: `POST /api/mcp`
- **Headers:** `Content-Type: application/json`

### Supported RPC Methods:

#### 1. `initialize`
- **Request:**
  ```json
  {
    "jsonrpc": "2.0",
    "method": "initialize",
    "id": 1
  }
  ```
- **Response:**
  ```json
  {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
      "protocolVersion": "2024-11-05",
      "serverInfo": {
        "name": "paygate402-safe-mcp-gateway",
        "version": "1.0.0"
      },
      "capabilities": {
        "tools": { "listChanged": false }
      }
    }
  }
  ```

#### 2. `tools/list`
- **Request:**
  ```json
  {
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 2
  }
  ```
- **Response:**
  ```json
  {
    "jsonrpc": "2.0",
    "id": 2,
    "result": {
      "tools": [
        {
          "name": "discover_catalog",
          "description": "Safely search and discover merchant catalog items with inventory and maximum policy-permitted discount ceilings.",
          "inputSchema": {
            "type": "object",
            "properties": {
              "query": { "type": "string", "description": "Search keyword" },
              "budget_cap": { "type": "number", "description": "Max budget in INR" },
              "category": { "type": "string", "description": "Optional category" },
              "merchant_id": { "type": "string", "description": "Optional merchant ID" }
            }
          }
        },
        {
          "name": "check_cart_mandate",
          "description": "Pipes an AP2 Cart Mandate directly into the 5-Checkpoint Verification Gateway to validate signatures, spend velocity, merchant policies, and fraud risk before settlement.",
          "inputSchema": {
            "type": "object",
            "properties": {
              "contractId": { "type": "string", "description": "Signed AP2 contract ID" },
              "agentId": { "type": "string" },
              "amount": { "type": "number" },
              "merchantId": { "type": "string" }
            },
            "required": ["contractId"]
          }
        }
      ]
    }
  }
  ```

#### 3. `tools/call` — Execute `discover_catalog` (Read-Only)
- **Request:**
  ```json
  {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "discover_catalog",
      "arguments": {
        "query": "Headphones",
        "budget_cap": 3000
      }
    },
    "id": 3
  }
  ```
- **Response:**
  ```json
  {
    "jsonrpc": "2.0",
    "id": 3,
    "result": {
      "content": [
        {
          "type": "text",
          "text": "{\n  \"total\": 1,\n  \"safe\": true,\n  \"readOnly\": true,\n  \"items\": [\n    {\n      \"productId\": \"65f1a2b3c4d5e6f7a8b9c0d2\",\n      \"title\": \"Sony WH-1000XM5 Headphones\",\n      \"category\": \"Audio\",\n      \"basePrice\": 2999,\n      \"currency\": \"INR\",\n      \"stock\": 50,\n      \"policyBounds\": {\n        \"maxDiscountPercent\": 15,\n        \"negotiationFloorPrice\": 2549,\n        \"protocol\": \"AP2/x402-Compliant\"\n      }\n    }\n  ]\n}"
        }
      ]
    }
  }
  ```

#### 4. `tools/call` — Execute `check_cart_mandate` (Air-Gapped Verification)
- **Request:**
  ```json
  {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "check_cart_mandate",
      "arguments": {
        "contractId": "contract_mnd_7f8a9b0c1d2e",
        "agentId": "agent_shopping_bot_01",
        "amount": 2750,
        "merchantId": "65f1a2b3c4d5e6f7a8b9c0d1"
      }
    },
    "id": 4
  }
  ```
- **Response (Verification Success):**
  ```json
  {
    "jsonrpc": "2.0",
    "id": 4,
    "result": {
      "content": [
        {
          "type": "text",
          "text": "{\n  \"allowed\": true,\n  \"gateDecision\": \"ALLOW\",\n  \"message\": \"Cart mandate verified across all 5 Gateway Checkpoints. Ready for secure AP2 execution.\",\n  \"contractDetails\": {\n    \"contractId\": \"contract_mnd_7f8a9b0c1d2e\",\n    \"amount\": 2750,\n    \"currency\": \"INR\",\n    \"status\": \"active\"\n  }\n}"
        }
      ]
    }
  }
  ```

---

## 3. Core REST API Endpoint Reference

### 3.1 Autonomous Agent Pipeline Routes (`/api/agent/*`)

| Method | Endpoint | Description | Auth / Security |
|---|---|---|---|
| `POST` | `/api/agent/intent` | Registers buyer purchase intent & mints 32-byte nonce | Public / Agent Key |
| `GET` | `/api/agent/intent/:id` | Fetches intent status & consumed state | Public / Agent Key |
| `POST` | `/api/agent/negotiation` | Executes dynamic price negotiation round | Public / Agent Key |
| `POST` | `/api/agent/contract` | Mints signed AP2 Commerce Contract | RSA-PSS Signature |
| `GET` | `/api/agent/contract/:id` | Retrieves contract details & terms | Public / Agent Key |
| `POST` | `/api/agent/payment/execute` | Executes 5-checkpoint settlement & atomic ledger debit | RSA-PSS Signature |
| `GET` | `/api/agent/catalog` | Searches merchant catalog with filters | Public |

#### Sample Request: `POST /api/agent/payment/execute`
```json
{
  "contractId": "contract_mnd_7f8a9b0c1d2e",
  "userId": "65f1a2b3c4d5e6f7a8b9c0aa",
  "userPrivateKey": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----"
}
```

#### Sample Response: `200 OK`
```json
{
  "success": true,
  "message": "Payment executed successfully. AP2 mandate settled.",
  "orderId": "ord_8f7e6d5c4b3a2019",
  "amount": 2750,
  "currency": "INR",
  "gateDecision": "ALLOW",
  "correlationId": "nonce_7f8a9b0c1d2e3f4a",
  "timestamp": "2026-09-04T12:00:00.000Z"
}
```

---

### 3.2 User Wallet & Authentication Routes (`/api/user/*`, `/api/wallet/*`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/user/auth/register` | Buyer signup (PBKDF2 password hash) | No |
| `POST` | `/api/user/auth/login` | Buyer login & JWT issue | No |
| `GET` | `/api/wallet/balance` | Returns wallet balance & spending caps | Yes (Bearer JWT) |
| `POST` | `/api/wallet/topup/initiate` | Creates Razorpay order for wallet top-up | Yes (Bearer JWT) |
| `GET` | `/api/wallet/ledger` | Returns full ledger transaction history | Yes (Bearer JWT) |
| `PUT` | `/api/wallet/caps` | Updates per-transaction / per-day caps | Yes (Bearer JWT) |

---

### 3.3 Merchant Management Routes (`/api/merchant/*`, `/api/policy/*`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/merchant/auth/register` | Merchant registration & KYC entry | No |
| `POST` | `/api/merchant/auth/login` | Merchant login & JWT token issue | No |
| `GET` | `/api/catalog` | Lists products for authenticated merchant | Yes (Merchant JWT) |
| `POST` | `/api/catalog` | Creates new catalog item | Yes (Merchant JWT) |
| `POST` | `/api/catalog/upload-csv` | Bulk uploads products via CSV parser | Yes (Merchant JWT) |
| `GET` | `/api/policy` | Lists active security policy rules | Yes (Merchant JWT) |
| `POST` | `/api/policy` | Creates new policy rule (spend cap, approval threshold) | Yes (Merchant JWT) |
| `GET` | `/api/orders` | Lists received orders & gated orders | Yes (Merchant JWT) |
| `POST` | `/api/orders/:id/approve` | Approves a gated order held in escrow | Yes (Merchant JWT) |
| `POST` | `/api/orders/:id/reject` | Rejects a gated order and cancels contract | Yes (Merchant JWT) |

---

### 3.4 Platform Administration Routes (`/api/admin/*`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/admin/auth/login` | Administrator login | Env Seed Credentials |
| `GET` | `/api/admin/overview` | Aggregated volume, order counts & gate stats | Yes (Admin JWT) |
| `GET` | `/api/admin/monitoring` | Real-time immutable audit event stream | Yes (Admin JWT) |
| `GET` | `/api/admin/merchants` | Lists merchants & health score indices | Yes (Admin JWT) |
| `GET` | `/api/admin/system` | Platform security parameters & DB connection pool | Yes (Admin JWT) |
| `GET` | `/api/admin/config` | Platform-wide guardrail configuration | Yes (Admin JWT) |

---

### 3.5 Inbound Webhook Listener (`/api/webhooks/*`)

| Method | Endpoint | Header Requirement | Payload Type |
|---|---|---|---|
| `POST` | `/api/webhooks/razorpay` | `x-razorpay-signature` (HMAC-SHA256) | Raw JSON Buffer |

- **Verification Logic:** Recalculates HMAC-SHA256 over raw unparsed request Buffer using `RAZORPAY_WEBHOOK_SECRET` and compares via `crypto.timingSafeEqual`.
- **Handling:** If `event === 'payment.captured'`, credits internal wallet ledger and records transaction reference.

---

### 3.6 Machine-Readable Well-Known Endpoints (`/.well-known/*`)

| Method | Endpoint | Response Format | Specification |
|---|---|---|---|
| `GET` | `/.well-known/agent-catalog.json` | JSON Manifest | RFC 8615 / AP2 Discovery |
| `GET` | `/.well-known/agent-policy.json` | JSON Governance Rules | AP2 Machine-Readable Policy |
| `GET` | `/health` | JSON Health Telemetry | System Health / Uptime |
