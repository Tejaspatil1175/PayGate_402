# CryptGate

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Razorpay-0C2451?style=for-the-badge&logo=razorpay&logoColor=white" />
  <img src="https://img.shields.io/badge/Cryptography-RSA%2FECDSA-6E56CF?style=for-the-badge" />
</p>

<p align="center">
  <b>AI agent wants to pay? Show the signed slip or get a 402.</b><br/>
  Built for the Razorpay AI Buildathon — Track 1: AI Growth & Agentic Commerce
</p>

---

## What this is

AI agents cannot pay safely today. Give them your card = they can overspend. Don't give it = they cannot buy anything.

CryptGate is a cryptographic payment gate. It sits in front of Razorpay. An AI agent can only pay if it brings a digitally signed permission slip from the user. The slip has a hard spending limit and expiry.

- No signature? 402 Payment Required.
- Fake signature? 402 Payment Required.
- Over budget? 402 Payment Required.

Only real + valid + bounded = gate opens, Razorpay pays.

---

## The 4 Steps

| Step | What Happens |
|---|---|
| **1. Sign** | User creates a permission slip: "Max ₹300, Zomato, 1 hour" and signs it with their private key |
| **2. Verify** | AI agent hits `/agent-pay` with the slip. CryptGate checks the digital signature using math (RSA/ECDSA). Impossible to fake. |
| **3. Bound** | Gate checks: amount ≤ cap? merchant allowed? time not expired? Any fail = BLOCKED |
| **4. Pay** | All checks pass → Razorpay order created → payment captured → audit log saved |

---

## Architecture

```
External AI Agent (any bot, any company)
        ↓
   Signed Permission Slip
        ↓
┌─────────────────────────────────┐
│         CryptGate               │
│      (Node.js + Express)        │
│                                 │
│   • RSA/ECDSA Signature Verify  │
│   • Spend Cap Enforcement       │
│   • Merchant + Expiry Check     │
│   • 402 Challenge Response      │
└──────────────┬──────────────────┘
               ↓
      Razorpay Test API
               ↓
      Order Created
               ↓
┌─────────────────────────────────┐
│      Audit Ledger (MongoDB)     │
│                                 │
│   Mandate Hash → Razorpay ID    │
│   Every allow / block recorded  │
└─────────────────────────────────┘
               ↓
      React Dashboard (Live log)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Gateway API | Node.js + Express |
| Cryptography | Node.js crypto (built-in RSA/ECDSA) |
| Database | MongoDB |
| Dashboard | React |
| Payments | Razorpay Test Mode + Official Node SDK |
| Webhooks | payment.captured |

---

## Razorpay APIs Used

- `orders.create` — create order after gate opens
- `orders.fetch` — verify status
- Webhooks: `payment.captured` — confirm success
