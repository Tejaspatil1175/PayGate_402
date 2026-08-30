# PayGate 402 — Evaluator Verification & Demo Walkthrough

This document provides a fast, reproducible 2-minute walkthrough for hackathon judges, interviewers, and system evaluators to verify all core claims of PayGate 402.

---

## 1. Quick Launch (30 Seconds)

### Live Hosted Deployment
The complete stack is live and accessible without local setup:
- **Web App**: [https://pay-gate-402.vercel.app/](https://pay-gate-402.vercel.app/)

### Local Setup (Alternative)
```bash
# Terminal 1: Backend
cd backend
npm install
npm test          # Runs 18 unit/integration tests (0 failures)
npm run seed      # Seeds demo buyer, merchant, products, and policies
npm run dev       # Starts API server on http://localhost:4000

# Terminal 2: Frontend
cd frontend
npm install
npm run dev       # Starts UI on http://localhost:5173
```

---

## 2. Pre-Seeded Evaluation Credentials

| Role | Email | Password | Pre-Loaded State |
|---|---|---|---|
| Buyer | `buyer@demo.com` | `Password123!` | ₹5,000 Pre-Funded AP2 Wallet |
| Merchant | `merchant@demo.com` | `Password123!` | 5 Products + 3 Active Governance Rules |
| Admin | `admin@demo.com` | `Password123!` | Platform Telemetry & Live Audit Stream |

---

## 3. Step-by-Step Evaluator Test Scenarios

### Scenario A: Autonomous Cart Mandate Signing & 5-Checkpoint Settlement
1. Log in as Buyer (`buyer@demo.com` / `Password123!`).
2. Navigate to **Catalog** (`/user/catalog`) or **Dashboard**.
3. Select **Sony WH-1000XM5 Headphones** (₹2,999).
4. Click **Start Agent Negotiation**:
   - The AI Agent initiates an autonomous negotiation round.
   - Merchant policy evaluates the margin floor (`RULE_DISCOUNT_AUTO_03`) and counters with a discounted price.
5. Accept the deal:
   - Client generates an RSA-PSS 2048-bit cryptographic Cart Mandate with a unique single-use 32-byte nonce.
   - The gateway routes the mandate through the 5-checkpoint settlement engine:
     1. Signature & Nonce Verification (Anti-Replay)
     2. Velocity Guardrails
     3. Manual Approval Threshold Check
     4. Merchant Policy Pre-check
     5. Fraud Risk Scoring
   - The pre-funded wallet ledger is debited atomically.
6. Verify under **Wallet** (`/user/wallet`):
   - Balance decreases by exact purchase amount (using integer paise arithmetic).
   - Ledger displays transaction entry with SHA-256 correlation hash.

---

### Scenario B: Policy Violation & Replay Attack Defense
1. **Replay Rejection**: If an agent attempts to submit a mandate with an already consumed nonce or altered payload, the gateway halts execution immediately with `400 Bad Request` / `GATE_01_NONCE_REPLAY`.
2. **Spend Cap Exceeded**: Attempting to order an item above the merchant single-order cap (₹15,000) or user wallet balance returns `402 Payment Required` with `RULE_SPEND_CAP_01` and `MERCHANT_SPEND_CAP_EXCEEDED`.

---

### Scenario C: Voice AI Assistant (Hands-Free Commerce)
1. In the Buyer dashboard, click **Voice AI** in the navigation bar.
2. Speak or type: `"Check my wallet balance"` or `"Find headphones under 3000 rupees"`.
3. The pipeline streams audio via Groq Whisper (`whisper-large-v3`), extracts structured JSON intent via Gemini 2.5 Flash, and presents catalog matches with synthesized voice feedback.

---

### Scenario D: Merchant Governance & Machine-Readable Manifest
1. Log in as Merchant (`merchant@demo.com` / `Password123!`).
2. Navigate to **Policy Builder** (`/merchant/policy`):
   - View active governance rules with numeric precedence (`RULE_SPEND_CAP_01`, `RULE_DAILY_VELOCITY_02`).
   - Create or adjust discount floors and spend thresholds.
3. Open `http://localhost:4000/.well-known/agent-catalog.json` or `https://pay-gate-402.vercel.app/api/.well-known/agent-catalog.json`:
   - Verify the auto-published AP2 machine-readable JSON manifest consumed by external AI buyer agents.

---

### Scenario E: Admin Security Mesh & Telemetry
1. Log in as Admin (`admin@demo.com` / `Password123!`).
2. Navigate to **Audit Monitoring** (`/admin/monitoring`):
   - Review the immutable audit log feed.
   - Notice each entry records `correlationId`, `ruleId`, `reasonCode`, `decision`, and `executionTimeMs`.

---

## 4. CLI Verification Commands

Run these cURL commands to verify backend endpoints directly:

```bash
# 1. Health Check
curl -s http://localhost:4000/health

# 2. Machine-Readable AP2 Manifest
curl -s http://localhost:4000/.well-known/agent-catalog.json

# 3. Automated Test Suite Execution
npm test --prefix backend
```
