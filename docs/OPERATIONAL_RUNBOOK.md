# PayGate 402 — Operational Runbook & Incident Response

> **Production Monitoring, Telemetry Streams, Automated Maintenance Cron Jobs & Incident Triage Procedures**

---

## 1. System Health Monitoring & Telemetry

PayGate 402 provides production endpoints for real-time infrastructure and security telemetry:

### 1.1 Health Check: `GET /health`
- **Purpose:** Liveness and readiness probe for load balancers (Render, AWS ALB).
- **Sample Output:**
  ```json
  {
    "status": "ok",
    "service": "paygate-402-backend",
    "timestamp": "2026-09-04T12:00:00.000Z",
    "uptime": 3600.42,
    "environment": "production",
    "mongoConnectionState": 1
  }
  ```

### 1.2 Security Telemetry Stream: `GET /api/admin/monitoring`
- **Purpose:** Real-time stream of audit events, checkpoint decisions, and risk scores for security operations centers.
- **Fields Emitted:** `correlationId`, `agentId`, `action`, `decision`, `reason`, `riskScore`, `executionTimeMs`, `timestamp`.

---

## 2. Background Maintenance Cron Jobs

The backend executes automated background maintenance via `node-cron`:

### 2.1 Abandoned Cart & Contract Expiration Job (`backend/jobs/abandonedCart.job.js`)
- **Schedule:** `*/15 * * * *` (Every 15 minutes)
- **Operational Task:**
  1. Queries the `Contract` collection for documents where:
     $$\text{status} = \text{'active'} \quad \land \quad \text{expiresAt} < \text{Date.now()}$$
  2. Transitions matched contracts to `status: 'expired'`.
  3. Releases reserved merchant catalog inventory back to stock.
  4. Writes cleanup audit record: `Action: ABANDONED_CONTRACT_CLEANUP`.

### 2.2 Scheduled Agent Purchase Job (`backend/jobs/scheduledTasks.job.js`)
- **Schedule:** `* * * * *` (Every minute)
- **Operational Task:**
  1. Queries `ScheduledTask` collection for pending tasks where `scheduleTime <= Date.now()` and `status === 'pending'`.
  2. Executes full discovery $\to$ negotiation $\to$ contract $\to$ 5-checkpoint settlement pipeline.
  3. Updates task status to `completed` or `failed` with error logs.

---

## 3. Incident Triage Runbook

### Incident Type A: Gated Order Triggered (`REQUIRE_APPROVAL`)
- **Trigger:** High transaction value ($\ge \text{Rs. } 25,000$) or first-time buyer order ($> \text{Rs. } 10,000$).
- **System State:** Order created with `status: 'gated'`, wallet funds held in escrow.
- **Resolution Procedure:**
  1. Merchant receives real-time notification on Dashboard (`/merchant/orders`).
  2. Merchant reviews buyer intent, contract terms, and customer phone/email.
  3. **Approve:** Merchant clicks "Approve" $\implies$ Calls `POST /api/orders/:id/approve`. The gateway finalizes wallet debit and updates order status to `paid`.
  4. **Reject:** Merchant clicks "Reject" $\implies$ Calls `POST /api/orders/:id/reject`. The gateway releases escrow, marks contract `revoked`, and logs audit reason.

---

### Incident Type B: Fraud Alert & Payout Hold (`PAYOUT_HOLD`)
- **Trigger:** Anomaly engine calculates $S_{\text{risk}} \ge 70$.
- **System State:** Execution halted with HTTP 400; audit event marked `PAYOUT_HOLD`.
- **Resolution Procedure:**
  1. Admin opens `/admin/monitoring` to review risk factor weights (e.g. `HIGH_VALUE_TRANSACTION: +35`, `EXTREME_VELOCITY_SPIKE: +30`).
  2. If legitimate burst: Admin can temporarily adjust merchant policy ceilings in `/admin/config`.
  3. If hostile bot: Admin suspends agent ID in `/api/admin/system`.

---

## 4. Disaster Recovery & Compensating Rollback Procedures

### Automated Database Rollback
If the server experiences an unhandled exception or database disconnect during payment settlement, the gateway's built-in **Two-Phase Compensating Auto-Rollback Protocol** automatically invokes `walletService.creditWallet()` to refund the user balance before terminating the request.

### Manual Ledger Reconciliation Query:
To verify ledger balance consistency across all users:
```javascript
// MongoDB Aggregation Script for Balance Reconciliation
db.wallets.aggregate([
  {
    $project: {
      owner: 1,
      balance: 1,
      calculatedBalance: {
        $reduce: {
          input: "$ledger",
          initialValue: 0,
          in: {
            $cond: [
              { $in: ["$$this.type", ["credit", "topup", "rollback_refund"]] },
              { $add: ["$$value", "$$this.amount"] },
              { $subtract: ["$$value", "$$this.amount"] }
            ]
          }
        }
      }
    }
  },
  {
    $match: {
      $expr: { $ne: ["$balance", "$calculatedBalance"] }
    }
  }
]);
// Expected Output: 0 mismatched documents (Zero drift)
```
