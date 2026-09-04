# ADR 004: Air-Gapped Model Context Protocol (MCP) Gateway for LLMs

## Status
**Accepted** (Implemented in `backend/services/mcp.service.js`, `backend/routes/mcp.routes.js`)

## Context
Large Language Models (LLMs) executing autonomous shopping workflows require standard tool discovery interfaces. However, granting an LLM tool access that directly executes financial debits creates an unacceptable prompt injection vulnerability: an attacker could manipulate model output to drain user funds.

## Decision
1. Expose a standards-compliant **Model Context Protocol (MCP) JSON-RPC 2.0 Gateway** at `POST /api/mcp`.
2. Restrict exposed tools to:
   - `discover_catalog`: **Read-Only** catalog exploration with policy discount ceilings.
   - `check_cart_mandate`: **Verification-Only** execution through the 5-Checkpoint Verification Gateway.
3. **Air-Gapping Settlement:** The `check_cart_mandate` tool reuses all verification checks (signatures, velocity, gated actions, merchant policies, fraud scoring) but **never invokes `debitWallet()`**. Settlement is strictly gated behind authenticated REST endpoints.

## Consequences
- **Positive:** LLMs can verify whether a cart mandate would succeed without having the capability to execute unauthorized payments.
- **Positive:** Total immunity against tool-call prompt injection financial draining.
- **Negative:** Completing a purchase requires passing the verified mandate to the authenticated payment controller.
