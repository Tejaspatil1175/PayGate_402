# PayGate 402 — The 5-Checkpoint Verification Gateway

> **Sequential Verification Firewall Specification, Deterministic Precedence Rules & Multi-Factor Fraud Risk Engine**

---

## 1. Overview & Verification Pipeline Topology

The cornerstone of the PayGate 402 security architecture is its **5-Checkpoint Verification Gateway**. Implemented in `backend/controllers/payment.controller.js` and exposed to LLMs via `backend/services/mcp.service.js`, every agent-initiated payment request must successfully pass through five sequential checkpoints **in strict mathematical order** before any funds can be deducted from the user's pre-funded wallet.

If a transaction fails at any checkpoint, execution halts immediately:
- Downstream checkpoints are never evaluated.
- The wallet ledger is never touched.
- An immutable audit log entry is written to MongoDB with structured `ruleId`, `reasonCode`, `decision`, and `correlationId`.

```
[ Signed AP2 Cart Mandate ]
            |
            v
+-------------------------------------------------------------------------+
| CHECKPOINT 1: CRYPTOGRAPHIC IDENTITY & NONCE ANTI-REPLAY               |
| File: utils/crypto.js, services/contract.service.js                     |
| Verifies: RSA-PSS 2048-bit signature + Single-use 32-byte CSPRNG nonce |
+-------------------------------------------------------------------------+
            | (Pass)
            v
+-------------------------------------------------------------------------+
| CHECKPOINT 2: VELOCITY GUARDRAILS & SLIDING WINDOW SPEND CAPS           |
| File: middleware/transactionGuardrails.js                               |
| Verifies: Single cap <= 100k, 15-min freq <= 10, 15-min spend <= 200k   |
+-------------------------------------------------------------------------+
            | (Pass)
            v
+-------------------------------------------------------------------------+
| CHECKPOINT 3: GATED ACTIONS & FIRST-TIME BUYER HARD-LIMITS             |
| File: middleware/gatedActions.js                                        |
| Verifies: Amount < 25k (or manual approval), First-time buyer <= 10k    |
+-------------------------------------------------------------------------+
            | (Pass)
            v
+-------------------------------------------------------------------------+
| CHECKPOINT 4: MERCHANT POLICY PRE-CHECK & PRECEDENCE EVALUATION         |
| File: services/policyPreCheck.service.js                                |
| Verifies: Wallet balance >= amount, Precedence-ordered merchant rules   |
+-------------------------------------------------------------------------+
            | (Pass)
            v
+-------------------------------------------------------------------------+
| CHECKPOINT 5: MULTI-FACTOR FRAUD ANOMALY RISK SCORING                   |
| File: services/fraud.service.js                                         |
| Verifies: Dynamic Risk Score S_risk < 70 (No payout hold trigger)       |
+-------------------------------------------------------------------------+
            | (Pass)
            v
[ Atomic Compare-And-Swap Ledger Settlement ]
```

---

## 2. Checkpoint-by-Checkpoint Technical Specification

### Checkpoint 1: Cryptographic Identity & Anti-Replay Validator
- **Implementation:** `backend/utils/crypto.js` (`verifySignature()`), `backend/services/contract.service.js` (`verifyCommerceContract()`)
- **Primary Mechanism:**
  1. Retrieves the contract document by `contractId` and populates the parent `Intent` and `Merchant` models.
  2. Extracts the buyer's public key (`userPublicKey`) in SPKI PEM format.
  3. Canonicalizes the contract items and agreed terms into a deterministic JSON string and verifies the digital signature using RSASSA-PSS with SHA-256 digest:
     $$\text{Verify}(\text{Payload}, \sigma, K_{\text{pub}}) \implies \text{true}$$
  4. Checks intent status: If the intent nonce was already consumed or intent status is not `submitted`/`contract_created`, the request is flagged as an unauthorized replay attempt.
- **Decision on Failure:** Returns `400 Bad Request` with `ruleId: 'GATE_0_CRYPTO_SIGNATURE'` or `ruleId: 'GATE_01_NONCE_REPLAY'`.

---

### Checkpoint 2: Velocity Guardrails & Spend Ceilings
- **Implementation:** `backend/middleware/transactionGuardrails.js` (`checkTransactionGuardrails()`)
- **Primary Mechanism:**
  1. **Single-Transaction Cap:** Rejects any automated transaction where:
     $$\text{Amount} > \text{Rs. } 1,00,000$$
  2. **Sliding Window Frequency Ceiling:** Tracks request timestamps in an in-memory sliding window `velocityStore`. Rejects if:
     $$\text{Count}(t \in [t_{\text{now}} - 900\,\text{s}, t_{\text{now}}]) > 10$$
  3. **Cumulative Velocity Ceiling:** Calculates total spend within the 15-minute sliding window. Rejects if:
     $$\sum \text{Amount}(t \in [t_{\text{now}} - 900\,\text{s}, t_{\text{now}}]) > \text{Rs. } 2,00,000$$
  4. **Dual-Tier State Synchronization:** Queries historical MongoDB aggregation over the `Order` collection to prevent evasion via process restarts.
- **Decision on Failure:** Returns `400 Bad Request` with `ruleId: 'GATE_01_SPEND_GUARDRAIL'`.

---

### Checkpoint 3: Gated Actions & First-Time Buyer Hard-Limits
- **Implementation:** `backend/middleware/gatedActions.js` (`evaluateGatedAction()`)
- **Primary Mechanism:**
  1. **Manual Approval Threshold:** Any transaction equal to or exceeding $\text{Rs. } 25,000$ (or custom merchant `PolicyRule.requireApprovalThreshold`) triggers manual merchant escrow:
     $$\text{Amount} \ge \text{Rs. } 25,000 \implies \text{Status} \leftarrow \texttt{'REQUIRE\_APPROVAL'}$$
  2. **First-Time Buyer Hard-Cap:** Queries `Order` collection for prior completed purchases associated with the buyer's agent ID, email, or phone. If prior completed orders equal 0:
     $$\text{PriorOrders} = 0 \land \text{Amount} > \text{Rs. } 10,000 \implies \text{Status} \leftarrow \texttt{'REQUIRE\_APPROVAL'}$$
- **Decision on Gating:** Returns HTTP 200 with `gateDecision: 'REQUIRE_APPROVAL'`. Order is recorded as `gated` in MongoDB pending human merchant confirmation via the dashboard.

---

### Checkpoint 4: Merchant Policy Pre-Check & Precedence Rules
- **Implementation:** `backend/services/policyPreCheck.service.js` (`performPolicyPreCheck()`)
- **Primary Mechanism:**
  1. **Wallet Balance Pre-Flight Check:** Verifies user's internal wallet balance is strictly greater than or equal to the contract amount before initiating settlement:
     $$\text{Wallet.balance} \ge \text{Contract.agreedAmount}$$
  2. **Precedence-Ordered Policy Evaluation:** Fetches all active `PolicyRule` records for the merchant, sorted by numerical precedence:
     $$\text{Sort}(\{R_1, \dots, R_m\}, \text{by: } \text{precedence ASC}, \text{then: } \text{createdAt ASC})$$
  3. Evaluates rule types sequentially:
     - `max_spend_cap`: Blocks if transaction amount exceeds policy ceiling.
     - `allowed_categories`: Blocks if item category is not present in the merchant allowlist.
     - `daily_velocity_limit`: Blocks if projected daily spend exceeds `dailyCap`.
     - `require_manual_approval`: Gated if transaction exceeds custom threshold.
- **Decision on Failure:** Returns structured `decision: 'BLOCK'`, `ruleId`, and `reasonCode` (e.g. `MERCHANT_SPEND_CAP_EXCEEDED`).

---

### Checkpoint 5: Multi-Factor Fraud Anomaly Risk Scoring Engine
- **Implementation:** `backend/services/fraud.service.js` (`evaluateFraudRisk()`)
- **Primary Mechanism:**
  Computes a dynamic integer risk score $S_{\text{risk}} \in [0, 100]$ as the bounded linear combination:
  $$S_{\text{risk}} = \min\left(100, \sum_{i=1}^{k} w_i \cdot \mathbb{I}_i\right)$$

#### Factor Weight Distribution Matrix:
| Indicator Condition ($\mathbb{I}_i$) | Weight ($w_i$) | Heuristic Rationale |
|---|---|---|
| **Rapid Repeat Burst** | $+25$ | Identical tuple $(\text{agentId}, \text{merchantId}, \text{amount})$ within $\Delta t \le 10\,\text{s}$ |
| **High Value (Tier 1)** | $+20$ | Transaction amount $\text{Rs. } 20,000 < \text{Amount} \le \text{Rs. } 50,000$ |
| **High Value (Tier 2)** | $+35$ | Transaction amount $\text{Amount} > \text{Rs. } 50,000$ |
| **Velocity Surge (Tier 1)** | $+15$ | $5 \le \text{Orders in past 60 min} < 10$ |
| **Velocity Surge (Tier 2)** | $+30$ | $\text{Orders in past 60 min} \ge 10$ |
| **Unverified Agent Metadata** | $+15$ | Anonymous agent identifier or missing/local IP address |

#### Decision Boundaries:
- $S_{\text{risk}} \ge 70 \implies$ \textbf{\texttt{PAYOUT\_HOLD}} (Execution rejected; hold recorded).
- $35 \le S_{\text{risk}} < 70 \implies$ \textbf{\texttt{REVIEW}} (Cleared; flagged in admin dashboard).
- $S_{\text{risk}} < 35 \implies$ \textbf{\texttt{ALLOW}} (Cleared for instant settlement).

---

## 3. Comprehensive Verification Matrix & Failure Responses

| Checkpoint | Failure Trigger | HTTP Status | Decision Code | Standard Reason Message |
|---|---|---|---|---|
| **CP1** | Altered cart item payload | `400 Bad Request` | `BLOCK` | `RSA-PSS signature verification failed` |
| **CP1** | Replayed intent nonce | `400 Bad Request` | `BLOCK` | `Replay detected: intent nonce consumed` |
| **CP2** | Single transaction $> \text{Rs. } 1,00,000$ | `400 Bad Request` | `BLOCK` | `Transaction exceeds single transaction cap` |
| **CP2** | Frequency $> 10 \text{ reqs} / 15 \text{ min}$ | `400 Bad Request` | `BLOCK` | `Velocity frequency limit exceeded` |
| **CP3** | First-time buyer $> \text{Rs. } 10,000$ | `200 OK (Gated)` | `REQUIRE_APPROVAL` | `First-time buyer order exceeds Rs. 10,000` |
| **CP3** | High value $\ge \text{Rs. } 25,000$ | `200 OK (Gated)` | `REQUIRE_APPROVAL` | `Transaction requires manual approval` |
| **CP4** | Insufficient user balance | `400 Bad Request` | `BLOCK` | `Wallet balance insufficient for contract` |
| **CP4** | Disallowed merchant category | `400 Bad Request` | `BLOCK` | `Category 'Gaming' is not allowed` |
| **CP5** | Multi-factor risk score $\ge 70$ | `400 Bad Request` | `PAYOUT_HOLD` | `Fraud risk score (75/100) exceeds threshold` |

---

## 4. Sample Rejection Payloads

### Sample 1: Nonce Replay Rejection
```json
{
  "success": false,
  "error": "Replay detected: intent nonce has already been consumed to generate a commerce contract",
  "ruleId": "GATE_01_NONCE_REPLAY",
  "reasonCode": "NONCE_ALREADY_CONSUMED",
  "decision": "BLOCK",
  "correlationId": "nonce_8f7e6d5c4b3a2019"
}
```

### Sample 2: Gated High-Value Order (Escrow Hold)
```json
{
  "success": true,
  "gateDecision": "REQUIRE_APPROVAL",
  "orderId": "ord_gate_9921402",
  "requiresManualApproval": true,
  "reason": "Transaction amount of Rs. 35000 exceeds manual approval threshold Rs. 25000",
  "correlationId": "nonce_1a2b3c4d5e6f7a8b"
}
```
