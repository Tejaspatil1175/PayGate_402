# PayGate 402 — Engineering Documentation Suite

> **Production Architectural Specification, Security Invariants, Protocol Manual & Operational Runbooks**  
> **Submitted For:** Razorpay AI Buildathon 2026 (Track 1: AI Growth & Agentic Commerce)  
> **Repository:** `Payment-Integrity-Mesh / PayGate_402`  
> **Live Deployment:** [pay-gate-402.vercel.app](https://pay-gate-402.vercel.app/)  
> **Pitch & Demo Video (5 Min):** [YouTube Walkthrough](https://youtu.be/gN-8tQxaDkQ?si=fzSaNRcoQUYT64gz)  
> **Full Architecture Report (PDF):** [Google Drive PDF Report](https://drive.google.com/file/d/1kz6T__kCQHHva6TekyXSXjxkgxvBgTA2/view?usp=sharing)  
> **Status:** Production-Ready / Verified (18/18 Integration Tests Passing)

---

## 1. Documentation Map & Navigation

This documentation suite provides an exhaustive, production-grade technical breakdown of the **PayGate 402** architecture, implementation, cryptographic invariants, and operational runbooks. It is structured for system evaluators, security auditors, and backend engineers.

```
docs/
├── README.md                           # Master documentation index & architecture navigation portal
├── ARCHITECTURE.md                     # Deep-dive system architecture, multi-tier isolation & data flows
├── FIVE_CHECKPOINT_GATEWAY.md          # Complete 5-checkpoint verification pipeline & rule engine
├── SECURITY_AND_THREAT_MODEL.md        # Cryptographic specifications, STRIDE threat model & DPDP compliance
├── SETTLEMENT_AND_CONCURRENCY.md       # Integer paise arithmetic, atomic CAS ledger & auto-rollback
├── API_AND_PROTOCOLS.md                # AP2 / x402 protocols, REST endpoints & MCP JSON-RPC 2.0 gateway
├── DATABASE_AND_SCHEMAS.md             # Complete Mongoose schemas, relationships, indexes & hooks
├── TESTING_AND_VERIFICATION.md         # 7 test suites, concurrency proofs, test fixtures & CI/CD
├── OPERATIONAL_RUNBOOK.md              # Health checks, telemetry stream, cron maintenance & incident response
├── EVIDENCE.md                         # Claim-to-code traceability matrix & invariant verification
├── adr/                                # Architecture Decision Records (ADRs)
│   ├── ADR-001-mandates-and-isolation.md
│   ├── ADR-002-five-checkpoint-settlement.md
│   ├── ADR-003-integer-paise-and-cas-concurrency.md
│   ├── ADR-004-model-context-protocol-air-gapping.md
│   └── ADR-005-timing-safe-webhook-hmac.md
└── signedpipeline.png                  # Visual architecture topology diagram
```

---

## 2. Document Descriptions & Recommended Reading Order

### For System Evaluators & Judges (10-Minute Fast Track)
1. [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) — Understand the 3-tier boundary isolation and the 5 transactional lifecycle stages.
2. [`docs/FIVE_CHECKPOINT_GATEWAY.md`](./FIVE_CHECKPOINT_GATEWAY.md) — Learn how every automated agent transaction is secured before touching money.
3. [`docs/EVIDENCE.md`](./EVIDENCE.md) — Trace every hackathon claim directly to source code lines and automated test suites.

### For Security Auditors & Cryptographers
1. [`docs/SECURITY_AND_THREAT_MODEL.md`](./SECURITY_AND_THREAT_MODEL.md) — Review the RSA-PSS SHA-256 digital signature scheme, CSPRNG 32-byte nonces, AES-256-GCM PII encryption, and the STRIDE threat matrix.
2. [`docs/SETTLEMENT_AND_CONCURRENCY.md`](./SETTLEMENT_AND_CONCURRENCY.md) — Inspect the mathematical proof of the Zero-Overdraft Invariant and the Compare-And-Swap (CAS) atomic ledger mechanics.
3. [`docs/adr/`](./adr/) — Read all 5 Architecture Decision Records detailing critical security choices.

### For Backend Engineers & API Integrators
1. [`docs/API_AND_PROTOCOLS.md`](./API_AND_PROTOCOLS.md) — Complete REST endpoint reference, AP2 Cart Mandate schemas, and Model Context Protocol (MCP) JSON-RPC 2.0 tools.
2. [`docs/DATABASE_AND_SCHEMAS.md`](./DATABASE_AND_SCHEMAS.md) — Full data dictionary for all 15 Mongoose models.
3. [`docs/OPERATIONAL_RUNBOOK.md`](./OPERATIONAL_RUNBOOK.md) — Health monitoring endpoints, automated cron maintenance, and incident triage runbooks.

---

## 3. Core System Specifications Summary

| Dimension | Specification | Implementation in Codebase |
|---|---|---|
| **Core Protocol** | AP2 (Agent Payments Protocol) / x402 | `backend/services/contract.service.js`, `backend/services/mcp.service.js` |
| **Asymmetric Cryptography** | RSA-2048 (SPKI/PKCS8 PEM) | `backend/utils/crypto.js` (`generateKeyPair()`) |
| **Signature Scheme** | RSASSA-PSS (SHA-256, MGF1, SaltLen=32) | `backend/utils/crypto.js` (`signData()`, `verifySignature()`) |
| **Anti-Replay Nonce** | CSPRNG 32-byte Hex Nonce ($N \in \{0,1\}^{256}$) | `backend/utils/crypto.js` (`generateNonce()`) |
| **Data at Rest Encryption** | AES-256-GCM with Random 96-bit IV | `backend/utils/encryption.js` (`encryptText()`, `decryptText()`) |
| **Ledger Precision** | Integer Paise Math ($\text{Paise} = \lfloor 100 \times R \rfloor$) | `backend/services/wallet.service.js` (`toPaise()`, `fromPaise()`) |
| **Concurrency Operator** | Atomic CAS (`findOneAndUpdate` with balance precondition) | `backend/services/wallet.service.js` (`debitWallet()`) |
| **Payment Gateway Rail** | Razorpay SDK (Order API, HMAC-SHA256 Webhooks) | `backend/services/razorpay.service.js`, `backend/webhooks/razorpay.webhook.js` |
| **Agent Interface** | Model Context Protocol (MCP) JSON-RPC 2.0 | `backend/services/mcp.service.js`, `backend/routes/mcp.routes.js` |
| **Automated Test Coverage** | 7 test suites, 18 automated unit/race tests | `backend/test/*.test.js` (`npm test`) |

---

## 4. Quick Verification Commands

Run these commands in the `backend/` directory to verify the running system:

```bash
# 1. Execute automated integration and concurrency race test suites
npm test

# 2. Seed demo buyer, merchant, products, and governance policies
npm run seed

# 3. Start development server
npm run dev

# 4. Verify machine-readable AP2 discovery manifest
curl -s http://localhost:4000/.well-known/agent-catalog.json

# 5. Verify system health status
curl -s http://localhost:4000/health
```
