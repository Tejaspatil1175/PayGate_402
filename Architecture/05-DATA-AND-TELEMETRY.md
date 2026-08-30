# 05. Ledger Data Integrity, Audit Logging & Telemetry

## Overview

A core requirement of the Razorpay Buildathon is that **"every money action is explainable, bounded, and gated."** This document details the immutable audit log data model, correlation tracking, and platform telemetry architecture.

---

## Audit Log Data Model

Every gate evaluation, mandate signature, wallet movement, and fulfillment milestone generates an immutable `AuditLog` record in MongoDB:

| Field | Type | Description | Example |
|---|---|---|---|
| `correlationId` | String | Unique trace ID linking intent, mandate, gate checks, and settlement. | `corr_9f8e7d6c5b4a` |
| `agentId` | String | Identifier of the autonomous buyer agent. | `agent_bargain_hunter_01` |
| `merchant` | ObjectId | Reference to the merchant storefront. | `66a01234b567890cd1234567` |
| `action` | String | Action event type. | `GATEWAY_SETTLEMENT_EXECUTED` |
| `decision` | Enum | Gate verdict: `ALLOW`, `BLOCK`, `REQUIRE_APPROVAL`, `PAYOUT_HOLD`. | `ALLOW` |
| `ruleId` | String | Structured identifier of the rule evaluated. | `RULE_SPEND_CAP_01` |
| `reasonCode` | String | Machine-readable outcome code. | `SETTLEMENT_SUCCESSFUL` |
| `mandateHash` | String | Deterministic SHA-256 digest of the Cart Mandate payload. | `e3b0c44298fc1c149afbf4c8...` |
| `razorpayOrderId` | String | Associated Razorpay order reference ID (if applicable). | `order_ONgK7pL5wQ4j` |
| `executionTimeMs` | Number | Gate evaluation latency in milliseconds. | `12` |
| `createdAt` | Date | Immutable timestamp (UTC). | `2026-08-30T10:45:00.000Z` |

---

## Telemetry Aggregation

The platform exposes real-time administrative telemetry via `GET /api/admin/monitoring`:
* **Live Audit Stream**: Real-time chronological audit decisions queryable by merchant, agent ID, and decision status.
* **Gate Pass/Block Rates**: Heuristic metrics displaying the distribution of blocks by `ruleId` (e.g. velocity limits vs category restrictions).
* **Execution Latencies**: P50, P95, and P99 gate evaluation latency tracking.
