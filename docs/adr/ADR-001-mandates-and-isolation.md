# ADR-001: Cryptographic Mandates and Agent Isolation Ledger

## Status
Accepted

## Context
Autonomous AI agents interacting with commerce endpoints cannot be directly entrusted with raw payment credentials (such as UPI PINs, credit card numbers, or live payment gateway API keys). Exposing raw credentials to LLM-driven agents introduces severe risks:
1. **Prompt Injection & Unbounded Spend**: Malicious or manipulated prompt contexts could coerce an agent into draining funds or authorizing fraudulent transactions.
2. **Non-Deterministic Model Actions**: LLMs may generate duplicate or out-of-policy purchase requests without strict deterministic constraints.
3. **Regulatory Authorization Constraints**: India's domestic payment rails (such as RBI cardholder authorization and NPCI guidelines) require bounded, verifiable customer intent.

## Decision
1. **AP2 RSA-PSS Cart Mandates**:
   - Every purchase intent is cryptographically signed by the user's agent key using 2048-bit RSA with RSA-PSS padding (`RSA_PKCS1_PSS_PADDING`) and SHA-256 digests.
   - Each mandate payload includes a single-use 32-byte cryptographic nonce, merchant ID, item SKUs, and agreed amount. Replay attacks are rejected outright.

2. **Pre-Funded Isolation Ledger**:
   - Instead of routing agent requests directly to live bank rails per transaction, agents operate inside a capped, pre-funded internal ledger.
   - Users fund the ledger explicitly via real Razorpay Checkout.
   - The ledger enforces per-transaction spending caps and 24-hour velocity limits before any debit executes.

## Consequences
### Positive
- **Security Boundary**: The agent has zero access to bank accounts, cards, or gateway secrets. The maximum blast radius of any agent failure is strictly bounded by the pre-funded wallet balance and daily velocity cap.
- **Explainability & Verification**: Every money movement corresponds to a verifiable RSA signature and SHA-256 mandate hash stored in the immutable audit trail.
- **Fail-Closed Design**: If signature verification, nonce checks, or velocity limits fail, the gateway aborts settlement before funds move.

### Negative / Trade-offs
- Users must pre-fund their wallet balance rather than streaming direct bank debits per micro-purchase.
