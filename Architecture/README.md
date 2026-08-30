# PayGate 402 — System Architecture Specification

Welcome to the comprehensive technical architecture specification for the **AP2/x402 Agentic Settlement Gateway**. This directory contains exhaustive documentation of every subsystem, security boundary, protocol translation, and data flow.

---

## Architecture Navigation & Deep Dives

| Document | Subsystem / Focus | Core Invariants & Topics |
|---|---|---|
| **[01. Sequential Pipeline](01-SEQUENTIAL-PIPELINE.md)** | 5-Checkpoint Settlement Pipeline | Gate 1–5 execution order, deterministic precedence, HTTP 402 exit paths, auto-rollback. |
| **[02. Security & Cryptography](02-SECURITY-AND-CRYPTOGRAPHY.md)** | Trust Boundaries & Cryptographic Mesh | RSA-PSS 2048-bit mandates, SHA-256 hashing, 32-byte anti-replay nonces, AES-256 vault, integer paise math. |
| **[03. MCP Protocol Bridge](03-MCP-PROTOCOL-BRIDGE.md)** | Model Context Protocol Layer | JSON-RPC 2.0 stdio/HTTP server, tool schemas (`sign_cart_mandate`, `execute_settlement`, `discover_catalog`). |
| **[04. Voice & AI Commerce](04-VOICE-AND-AI-COMMERCE.md)** | Multimodal Ingress & Negotiation | Groq Whisper (`whisper-large-v3`), Gemini 2.5 Flash intent parsing, multi-round negotiation engine. |
| **[05. Data & Telemetry](05-DATA-AND-TELEMETRY.md)** | Ledger Integrity & Audit Stream | Double-entry isolation ledger model, correlation tracking, immutable audit log schemas. |

---

## High-Level System Topology

```mermaid
graph TB
    subgraph TIER1["Tier 1: Client Ingress & Agent Discovery Layer"]
        A1["Autonomous AI Buyer Agent<br/>(LLM / Prompt Runner)"]
        A2["MCP Client Integration<br/>(Claude Desktop / Cursor)"]
        A3["Voice AI Commerce<br/>(Groq Whisper + Gemini 2.5 Flash)"]
        MF["Machine-Readable AP2 Manifest<br/>(/.well-known/agent-catalog.json)"]
    end

    subgraph TIER2["Tier 2: Cryptographic Protocol Boundary"]
        C1["RSA-PSS 2048-bit Digital Signing<br/>(Private Key in User Isolation Vault)"]
        C2["SHA-256 Cart Mandate Digest<br/>(Deterministic Payload Hash)"]
        C3["Single-Use 32-Byte Nonce Generator<br/>(Anti-Replay Protection)"]
    end

    subgraph TIER3["Tier 3: Five-Checkpoint Sequential Policy Engine"]
        G1["Checkpoint 1: Signature & Nonce Gating<br/>(GATE_01_CRYPTO_VERIFICATION)"]
        G2["Checkpoint 2: Velocity & Spend Guardrails<br/>(GATE_02_SPEND_GUARDRAIL)"]
        G3["Checkpoint 3: Manual Approval Threshold<br/>(GATE_03_APPROVAL_THRESHOLD)"]
        G4["Checkpoint 4: Deterministic Policy Engine<br/>(Precedence-Sorted Merchant Rules)"]
        G5["Checkpoint 5: Anomaly & Fraud Scoring<br/>(GATE_05_FRAUD_HEURISTIC)"]
    end

    subgraph TIER4["Tier 4: Settlement & Isolation Boundary"]
        L1["Pre-Funded Isolation Ledger<br/>(Integer Paise Precision Math)"]
        RB["Automatic Compensation Engine<br/>(Rollback on Order Failure)"]
        RZP["Razorpay Checkout & Webhooks<br/>(HMAC-SHA256 Signed Top-Up Rails)"]
    end

    subgraph TIER5["Tier 5: Immutable Audit & Telemetry"]
        AUDIT["Structured Cryptographic Audit Stream<br/>(correlation_id, rule_id, reason_code, mandate_hash)"]
        DB[("MongoDB Atlas Enterprise Cluster")]
    end

    A1 -->|Intent & Parameters| MF
    A2 -->|JSON-RPC 2.0 /tools| MF
    A3 -->|Audio Transcription & NLP| MF
    MF -->|Agreed Cart & Terms| C1
    C1 --> C2
    C2 --> C3
    C3 -->|AP2 Signed Mandate| G1

    G1 -->|Pass| G2
    G1 -.->|Invalid Signature / Replay| BLK["HTTP 402 / Block Decision"]
    G2 -->|Pass| G3
    G2 -.->|Cap Exceeded| BLK
    G3 -->|Auto-Approved| G4
    G3 -.->|High Value Hold| HLD["REQUIRE_APPROVAL"]
    G4 -->|Pass| G5
    G4 -.->|Policy Block| BLK
    G5 -->|Pass| L1
    G5 -.->|Fraud Suspicion| BLK

    L1 -->|Atomic Debit| ORD["Order Fulfillment & Digital Receipt"]
    L1 -.->|Order Creation Failure| RB
    RB -->|Reversal Credit| L1

    RZP -->|Verified Top-Up Funds| L1

    G1 & G2 & G3 & G4 & G5 & L1 & RB & BLK --> AUDIT
    AUDIT --> DB
```

---

## Core System Invariants

1. **Zero Raw Credential Exposure**: AI agents never receive API keys, card numbers, or UPI PINs. All authorization flows via RSA-PSS signed Cart Mandates.
2. **Fail-Closed Gate Execution**: If any checkpoint in the 5-stage pipeline fails or encounters network degradation, the pipeline immediately halts with a structured HTTP 402 challenge.
3. **Atomic Automatic Compensation**: If an order creation or fulfillment step fails after a wallet debit, a compensation credit (`rollback_{contractId}`) reverses the debit automatically.
4. **Deterministic Arithmetic**: All internal financial operations execute using integer paise integers, strictly preventing floating-point rounding drift.
5. **Complete Auditability**: Every gate evaluation and money action emits a structured audit record containing `correlationId`, `ruleId`, `reasonCode`, and `mandateHash`.
