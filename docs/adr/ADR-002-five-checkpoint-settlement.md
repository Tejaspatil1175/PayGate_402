# ADR-002: Sequential Five-Checkpoint Settlement Pipeline and Automatic Rollback

## Status
Accepted

## Context
When processing agent-initiated payment mandates, transactions must satisfy multiple distinct governance layers: merchant commercial policies, buyer velocity bounds, high-value approval thresholds, anti-fraud heuristics, and cryptographic authenticity. If any check fails midway or network errors occur after wallet debit, the system must guarantee zero fund loss and complete explainability.

## Decision
1. **Sequential Five-Checkpoint Settlement Pipeline**:
   All incoming signed mandates must pass through five discrete checkpoints in strict order before money moves:
   - **Checkpoint 1 (Cryptographic & Nonce Verification)**: Verifies RSA-PSS digital signature and ensures single-use nonce has not been consumed (`GATE_01_CRYPTO_VERIFICATION`).
   - **Checkpoint 2 (Velocity & Spend Guardrails)**: Verifies transaction does not exceed buyer per-transaction or daily velocity caps (`GATE_02_SPEND_GUARDRAIL`).
   - **Checkpoint 3 (Manual Approval Thresholds)**: Evaluates whether order amount exceeds merchant threshold requiring explicit merchant sign-off (`GATE_03_APPROVAL_THRESHOLD`).
   - **Checkpoint 4 (Merchant Policy Pre-Check)**: Evaluates merchant spend caps, category allowlists, and pricing constraints in deterministic precedence order (`GATE_04_MERCHANT_POLICY`).
   - **Checkpoint 5 (Anomaly Detection & Fraud Scoring)**: Evaluates order size, frequency, and customer metadata against deterministic heuristic thresholds (`GATE_05_FRAUD_HEURISTIC`).

2. **Deterministic Precedence Resolution**:
   Merchant governance rules specify a numeric `precedence` (lower numbers execute first) to eliminate ambiguity when multiple discount or category rules apply to the same cart.

3. **Atomic Automatic Rollback Compensation**:
   If an order settlement fails after the wallet has been debited (e.g. inventory exhaustion or database write failure), the engine automatically executes a reverse credit transaction labeled `rollback_{contractId}` and logs a rollback audit event.

## Consequences
### Positive
- **Deterministic Explainability**: Every gate decision includes a specific `ruleId` (e.g. `RULE_SPEND_CAP_01`) and `reasonCode` (e.g. `MERCHANT_SPEND_CAP_EXCEEDED`).
- **Zero Loss Guarantee**: Auto-rollback prevents orphaned debits without requiring manual reconciliation.
- **Fail-Closed Security**: Any failure at any single checkpoint halts the entire transaction immediately.
