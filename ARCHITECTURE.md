# Architecture

## Diagram

```
   Razorpay (Test Mode)
   Webhooks: payment.authorized · refund.created · payment.dispute.created
                    │
                    ▼
   ┌─────────────────────────────┐
   │  Webhook Receiver (Node.js)  │  verifies signature, routes event
   └───────────────┬─────────────┘
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
 ┌───────────────┐      ┌─────────────────────┐
 │ Fraud Guard    │      │ Refund Ring Hunter   │   (Python microservices)
 │ (payment risk) │      │ (graph/link analysis)│
 └───────┬────────┘      └──────────┬───────────┘
         │   every tool call goes through the proxy — never direct
         ▼                          ▼
 ┌─────────────────────────────────────────────┐
 │        MCP Tool-Call Proxy (Node.js)          │
 │  Policy Sentinel: allowlist / blocklist /      │
 │  flag-rate cap / business-hours rule           │
 └───────────────────┬───────────────────────────┘
                     ▼
     Razorpay MCP Server (hosted, remote — mcp.razorpay.com/mcp)
     Read-only tools only
                     │
                     ▼
        Audit Ledger (MongoDB) → React + Socket.io Dashboard
```

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Webhook receiver + MCP proxy | Node.js + Express | Best-documented Razorpay SDK/webhook support; natural fit for an interception middleware |
| Detection agents | Python (FastAPI, scikit-learn, networkx) | Graph clustering and lightweight scoring are more direct here |
| Audit ledger | MongoDB | Document-shaped data, one record per decision |
| Dashboard | React + Socket.io | Real-time push for the live event feed and live-block demo |

## Razorpay MCP tools used (read-only only)

`fetch_payment` · `fetch_payment_card_details` · `fetch_order_payments` · `fetch_all_refunds` · `fetch_multiple_refunds_for_payment` · `fetch_specific_refund_for_payment`

**Never called, blocked at the proxy regardless of agent:** `create_refund`, `capture_payment`, and every other write-capable tool.

**Webhooks subscribed:** `payment.authorized` · `refund.created` · `payment.dispute.created`

## Data needed

A labeled, held-out test set — Razorpay's test mode gives transactions, not fraud labels, so this has to be generated:
- ~70 "clean" transactions/refunds — distinct cards, distinct contacts, spread over time.
- ~30 "abuse-pattern" refunds — deliberately clustered by shared card BIN or shared contact within a tight time window.

Labels recorded before running any detection, so precision/recall numbers are real, not circular.

## Evaluation

Precision, recall, false-positive count, and estimated false-positive cost, measured against the labeled set above. A stated limitation belongs alongside the numbers: synthetic, non-adversarial, 100-item test set — real-world performance will differ.
