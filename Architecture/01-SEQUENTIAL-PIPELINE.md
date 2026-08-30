# 01. Five-Checkpoint Sequential Settlement Pipeline

## Overview

The Sequential Settlement Pipeline is the core policy and security enforcement engine of PayGate 402. Every transaction submitted by an autonomous AI agent must traverse five discrete checkpoints in strict linear order before any funds move from the buyer's isolation ledger.

---

## Execution Flow & Decision Paths

![Sequential Authorization Pipeline](sequentialpipeline.png)

---

## Checkpoint Specifications

### Checkpoint 1: Cryptographic & Nonce Verification
* **Gate Identifier**: `GATE_01_CRYPTO_VERIFICATION`
* **Implementation**: `backend/utils/crypto.js` & `backend/controllers/payment.controller.js`
* **Checks**:
  1. Validates the RSA-PSS 2048-bit digital signature on the Cart Mandate payload using the buyer agent's registered public key.
  2. Ensures the 32-byte cryptographic nonce has not been consumed (anti-replay defense).
* **Failure Code**: `GATE_01_NONCE_REPLAY` / `INVALID_MANDATE_SIGNATURE` (HTTP 400 / 402)

### Checkpoint 2: Buyer Velocity & Spending Guardrails
* **Gate Identifier**: `GATE_02_SPEND_GUARDRAIL`
* **Implementation**: `backend/services/wallet.service.js`
* **Checks**:
  1. Verifies order amount does not exceed the buyer's configured single-transaction cap (e.g. ₹10,000).
  2. Verifies rolling 24-hour cumulative spend does not breach the daily spend cap (e.g. ₹50,000).
* **Failure Code**: `BUYER_TRANSACTION_CAP_EXCEEDED` / `BUYER_DAILY_LIMIT_EXCEEDED` (HTTP 402)

### Checkpoint 3: Merchant Manual Approval Gating
* **Gate Identifier**: `GATE_03_APPROVAL_THRESHOLD`
* **Implementation**: `backend/services/policyPreCheck.service.js`
* **Checks**:
  1. Evaluates whether the cart amount exceeds the merchant's high-value transaction threshold requiring explicit human sign-off.
* **Result**: Transitions order into `REQUIRE_APPROVAL` state with pending approval timer.

### Checkpoint 4: Merchant Policy Precedence Engine
* **Gate Identifier**: `GATE_04_MERCHANT_POLICY`
* **Implementation**: `backend/services/policyPreCheck.service.js`
* **Checks**:
  1. Retrieves all active merchant governance rules sorted in ascending order of `precedence` (lower numeric number executes first).
  2. Validates product categories against merchant category allowlists/blocklists.
  3. Validates order value against merchant maximum single-order spend caps (`RULE_SPEND_CAP_01`).
* **Failure Code**: `MERCHANT_SPEND_CAP_EXCEEDED` / `CATEGORY_RESTRICTED` (HTTP 402)

### Checkpoint 5: Heuristic Fraud Risk Scoring
* **Gate Identifier**: `GATE_05_FRAUD_HEURISTIC`
* **Implementation**: `backend/controllers/payment.controller.js`
* **Checks**:
  1. Calculates a composite risk score (0–100) based on velocity anomaly, purchase frequency, order size divergence, and IP/agent metadata.
  2. Blocks transactions with risk score exceeding 85.
* **Failure Code**: `FRAUD_SCORE_THRESHOLD_EXCEEDED` (HTTP 402)

---

## Settlement Execution & Automatic Rollback

Once all five checkpoints return `ALLOW`:
1. **Atomic Debit**: The isolation ledger executes an atomic `$inc` debit on the buyer's wallet in integer paise.
2. **Order Creation & Digital Receipt**: The order record is persisted with status `paid` and an AP2 Digital Receipt (`rcpt_...`) is minted.
3. **Rollback Compensation**: If order persistence or receipt generation throws an unhandled exception post-debit, the engine catches the error, credits back the exact amount labeled `rollback_{contractId}`, and writes a `ROLLBACK_COMPENSATED` audit log.
