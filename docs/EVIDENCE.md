# PayGate 402 — Architectural Evidence & Verification Map

This document maps every architectural claim, security invariant, and protocol specification stated in the README and project documentation to verifiable source code locations and automated tests.

---

## 1. Core Architecture & Protocol Claims

| Claim / Invariant | Source File | Key Code Lines / Implementation | Test Coverage |
|---|---|---|---|
| **RSA-PSS 2048-bit Mandate Signing** | `backend/utils/crypto.js` | `signData()`, `verifySignature()` with `RSA_PKCS1_PSS_PADDING` & `RSA_PSS_SALTLEN_DIGEST` | `backend/test/mandateCrypto.test.js` |
| **Nonce Anti-Replay Protection** | `backend/services/contract.service.js` | Intent status and single-use 32-byte hex nonce check before mandate generation | `backend/test/nonceReplay.test.js` |
| **SHA-256 Audit Integrity Hash** | `backend/utils/crypto.js` | `hashData()` computing deterministic payload digest | `backend/test/mandateCrypto.test.js` |
| **Five-Checkpoint Settlement Engine** | `backend/controllers/payment.controller.js` | Sequential execution: Signature verify -> Velocity guardrails -> Approval threshold -> Policy pre-check -> Fraud scoring | `backend/test/policyGates.test.js` |
| **Deterministic Rule Precedence** | `backend/services/policyPreCheck.service.js` | Rules sorted by `{ precedence: 1, createdAt: 1 }`; lower numeric value executes first | `backend/test/policyGates.test.js` |
| **Structured Rule IDs & Reason Codes** | `backend/models/PolicyRule.js`, `backend/models/AuditLog.js` | `ruleId` (e.g. `RULE_SPEND_CAP_01`) and `reasonCode` (e.g. `MERCHANT_SPEND_CAP_EXCEEDED`) attached to every gate decision | `backend/test/policyGates.test.js` |
| **Automatic Rollback Compensation** | `backend/controllers/payment.controller.js` | `catch (orderErr)` block invoking `walletService.creditWallet(userId, amount, rollbackRef, ...)` | `backend/test/settlementAndRollback.test.js` |
| **Integer Paise Precision Arithmetic** | `backend/services/wallet.service.js` | `toPaise()` and `fromPaise()` helpers preventing floating-point currency drift | `backend/test/settlementAndRollback.test.js` |
| **Pre-Funded Isolation Ledger** | `backend/services/wallet.service.js` | `debitWallet()` atomic filter with balance and velocity cap checks | `backend/test/settlementAndRollback.test.js` |
| **Real Razorpay Checkout Integration** | `backend/services/razorpay.service.js` | `createRazorpayOrder()` SDK client and HMAC-SHA256 webhook signature validation | `backend/webhooks/razorpay.webhook.js` |
| **Voice AI (Whisper + Gemini)** | `backend/services/voiceIntent.service.js` | Groq Whisper speech transcription + Gemini 2.5 Flash intent parameter extraction | `backend/routes/voice.routes.js` |
| **Machine-Readable AP2 Manifest** | `backend/services/policyFile.service.js` | `generateAgentPolicyManifest()` served at `/.well-known/agent-catalog.json` | `backend/routes/wellknown.routes.js` |
| **Strict CORS Lockdown** | `backend/server.js` | Origin header check against `CLIENT_URL` and authorized domains | `backend/server.js` |

---

## 2. Automated Test Suite Breakdown

All 18 automated unit and integration tests are executable via `npm test` in the `backend/` directory:

| Test Suite | File | Tests Count | Coverage Target |
|---|---|---|---|
| AP2 Mandate Cryptography | `backend/test/mandateCrypto.test.js` | 5 tests | Keypair generation, RSA-PSS signature verification, tampered payload rejection, rogue key rejection, deterministic hashing. |
| Nonce & Anti-Replay | `backend/test/nonceReplay.test.js` | 3 tests | 32-byte hex entropy, 1000-nonce zero collision guarantee, consumed nonce rejection. |
| 5-Checkpoint Policy Gates | `backend/test/policyGates.test.js` | 6 tests | Single spend cap, category allowlist, manual approval threshold, precedence resolution, daily velocity limits. |
| Settlement & Rollback | `backend/test/settlementAndRollback.test.js` | 4 tests | Floating-point drift elimination, 100-operation micro-transaction precision, overdraft prevention, automatic compensation rollback. |

---

## 3. End-to-End Execution Flow Verification

1. **Buyer Intent Submission**: `POST /api/agent/intent` (`backend/controllers/intent.controller.js`)
2. **Catalog Discovery & Matching**: `POST /api/registry/match` (`backend/services/matching.service.js`)
3. **Multi-Round Price Negotiation**: `POST /api/agent/negotiation` (`backend/services/negotiation.service.js`)
4. **RSA-PSS Mandate Signing**: `POST /api/agent/contract` (`backend/controllers/contract.controller.js`)
5. **Gated Settlement & Wallet Debit**: `POST /api/agent/payment/execute` (`backend/controllers/payment.controller.js`)
6. **Immutable Audit Event Storage**: `backend/middleware/auditLogger.js` (`logAuditEvent()`)
