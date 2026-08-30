# 02. Security Invariants & Cryptographic Architecture

## Overview

PayGate 402 establishes an end-to-end cryptographic trust boundary between autonomous LLM agents and monetary settlement systems. This document outlines the cryptographic primitives, padding schemes, key lifecycle management, and financial precision invariants.

---

## Cryptographic Primitives

| Component | Standard / Algorithm | Parameters / Configuration | Purpose |
|---|---|---|---|
| **Mandate Signing** | RSA-PSS | 2048-bit modulus, SHA-256 digest, `RSA_PKCS1_PSS_PADDING`, salt length = digest length (32 bytes) | Non-repudiable proof of buyer agent intent. |
| **Payload Integrity** | SHA-256 | Deterministic canonical JSON hashing | Tamper detection across merchant, items, and agreed price. |
| **Anti-Replay Protection** | CSPRNG | 32-byte hex entropy (64 hex characters) | Single-use nonce preventing double-spend and playback attacks. |
| **Merchant Keyring Vault** | AES-256-GCM | 32-byte secret key with 16-byte initialization vector | Secure encryption of stored Razorpay API keys and PAN numbers. |
| **Webhook Validation** | HMAC-SHA256 | Razorpay Webhook Secret signature comparison | Authentic payment capture verification from Razorpay rails. |

---

## Mandate Signing Specification

An AP2 Cart Mandate payload is canonicalized and signed as follows:

```javascript
const mandatePayload = {
  mandateId: "mnd_a1b2c3d4e5f6",
  merchantId: "merch_apex_01",
  productId: "prod_headphones_99",
  agreedAmount: 2999,
  currency: "INR",
  agentId: "agent_bargain_hunter",
  nonce: "7f8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b",
  timestamp: 1772450000000
};
```

1. **Digest Calculation**: A SHA-256 digest is generated over canonical JSON string of `mandatePayload`.
2. **RSA-PSS Signing**: Signed using the buyer's private key with PSS padding.
3. **Verification**: The gateway verifies the signature using the buyer's public key registered in MongoDB. Any field alteration invalidates the signature and halts the pipeline immediately.

---

## Pre-Funded Isolation Ledger & Integer Paise Math

To eliminate floating-point financial drift (e.g. `0.1 + 0.2 !== 0.3` in standard IEEE 754 floating-point arithmetic), PayGate 402 converts all currency values into integer paise:

```javascript
// Conversion Helpers
function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

function fromPaise(paise) {
  return Math.round(Number(paise)) / 100;
}
```

* **Storage**: Wallet balances, transaction debits, and caps are computed strictly via integer paise operations.
* **Atomic Balance Check**: Debits execute using atomic MongoDB conditional filters (`balance: { $gte: amount }`) to guarantee no overdrafts can occur under concurrent requests.
