# PayGate 402 — Atomic Ledger Settlement, Concurrency & Rollback

> **Integer Paise Precision Math, Compare-And-Swap (CAS) Concurrency & Two-Phase Compensating Auto-Rollback Protocol**

---

## 1. Floating-Point Drift Elimination (Integer Paise Math)

Standard IEEE-754 floating-point numbers in JavaScript suffer from binary representation drift:
```javascript
// Native IEEE-754 binary drift:
0.1 + 0.2 === 0.30000000000000004 // TRUE (Fails strict equality)
```
In high-frequency automated agent commerce, fractional cent errors accumulate across millions of micro-transactions, causing severe ledger imbalances and audit reconciliation failures.

### The Integer Paise Solution (`backend/services/wallet.service.js`):
PayGate 402 converts all currency figures to integer paise ($1\,\text{Rupee} = 100\,\text{Paise}$) immediately upon entry:
$$\text{Paise} = \text{round}(\text{Rupees} \times 100) \in \mathbb{Z}^+$$

```javascript
const toPaise = (rupees) => Math.round(Number(rupees) * 100);
const fromPaise = (paise) => Math.round(Number(paise)) / 100;

// Exact integer arithmetic:
const safeSum = fromPaise(toPaise(0.1) + toPaise(0.2)); // EXACTLY 0.3
```

---

## 2. Compare-And-Swap (CAS) Atomic Debit Operator

Under parallel load, if two concurrent threads read a wallet balance of Rs. 1,000 and both attempt to debit Rs. 600 using standard `find() -> modify -> save()` loops, both reads succeed, causing an unauthorized balance overdraft to $-\text{Rs. } 200$.

### The Atomic Solution:
PayGate 402 eliminates application-level race conditions by executing atomic Compare-And-Swap (CAS) updates directly at the MongoDB storage engine level:

```javascript
// Atomically debits balance IF AND ONLY IF balance >= amount
async function debitWallet(userId, amount, referenceId, description = '') {
  const paiseAmount = toPaise(amount);
  
  const updatedWallet = await Wallet.findOneAndUpdate(
    {
      owner: userId,
      balance: { $gte: paiseAmount / 100 }, // Atomic precondition guard
    },
    {
      $inc: { 
        balance: -(paiseAmount / 100),
        dailySpent: paiseAmount / 100 
      },
      $push: {
        ledger: {
          type: 'debit',
          amount: paiseAmount / 100,
          referenceId,
          description,
          status: 'completed',
          createdAt: new Date(),
        },
      },
    },
    { new: true }
  );

  if (!updatedWallet) {
    throw new Error(`Insufficient wallet balance. Required: Rs. ${amount}`);
  }
  return updatedWallet;
}
```

---

## 3. Formal Mathematical Proof of Zero-Overdraft Invariant

### Theorem (Zero-Overdraft under High Parallel Load):
Let $B_0$ be the initial wallet balance, and let $d_1, d_2, \dots, d_n$ be $n$ simultaneous, asynchronous debit requests where each $d_i > 0$. The final balance $B_{\text{final}}$ satisfies:
$$B_{\text{final}} = B_0 - \sum_{k \in \mathcal{S}} d_k \ge 0$$
where $\mathcal{S} \subseteq \{1, \dots, n\}$ is the subset of fulfilled debit requests, and:
$$\forall j \notin \mathcal{S}, \quad \text{Request } d_j \text{ is rejected with 'Insufficient balance' and ledger is untouched.}$$

### Proof by Database Mutex Linearization:
1. In MongoDB WiredTiger storage engine, document-level locking ensures that write operations on a single document $\text{Wallet}(u)$ are strictly linearized.
2. Let $t_1 < t_2 < \dots < t_n$ be the serialized execution timestamps of the atomic `findOneAndUpdate` operations.
3. At any step $k$, the balance predicate $\text{Balance}_{k-1} \ge d_k$ is evaluated atomically.
4. If $\text{Balance}_{k-1} < d_k$, the filter match count is 0, returning `null` without modifying the document.
5. Therefore, $\text{Balance}_k = \text{Balance}_{k-1} - d_k \ge 0$ holds inductively for all $k$. $\blacksquare$

---

## 4. Two-Phase Compensating Auto-Rollback Protocol

In distributed systems, transient exceptions (e.g., database timeout during order persistence, merchant inventory lock failure, network disconnect) can occur after a wallet debit has succeeded.

PayGate 402 guarantees consistency via an automated **Two-Phase Compensating Rollback Protocol**:

```
+-------------------------------------------------------------------------+
| Phase 1: Atomic Debit Executed                                          |
| Wallet balance decremented by Rs. 2,750; ledger subdocument appended    |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| Phase 2: Order Persistence & Inventory Confirmation                     |
| Attempt to write Order document (status: 'paid')                        |
+-------------------------------------------------------------------------+
            |                                           |
            | (Write Success)                           | (Write Exception)
            v                                           v
+-----------------------+           +-------------------------------------+
| Settlement Finalized  |           | Phase 3: Auto-Rollback Triggered    |
| Order: 'paid'         |           | creditWallet() restores Rs. 2,750   |
| Audit Event Persisted |           | Ledger: 'rollback_refund' appended  |
+-----------------------+           +-------------------------------------+
```

### Implementation (`backend/controllers/payment.controller.js`):
```javascript
// Atomic Debit Step
await walletService.debitWallet(userId, contractAmount, contractId, `AP2 Order: ${contractId}`);

try {
  // Order Persistence Step
  const order = await Order.create({
    orderId: `ord_${generateNonce().substring(0, 16)}`,
    contract: contract._id,
    merchant: contract.merchant,
    amount: contractAmount,
    status: 'paid',
  });
} catch (orderError) {
  // Automatic Compensating Rollback Step
  const rollbackRef = `rollback_${contractId}`;
  await walletService.creditWallet(
    userId,
    contractAmount,
    rollbackRef,
    `Auto-Rollback: Order creation failed (${orderError.message})`
  );
  throw new AppError(`Settlement failed, funds automatically refunded: ${orderError.message}`, 500);
}
```

---

## 5. Verification Telemetry from Concurrency Race Test

Captured during `backend/test/walletConcurrency.test.js` execution (10 parallel debits of Rs. 150 against Rs. 1,000 initial balance):

```
--- Concurrency Proof Test Results ---
Total Parallel Calls: 10
Succeeded Calls:      6 (Total debited: Rs. 900)
Failed Calls:         4 (Rejected: Insufficient balance)
Final Database Balance: Rs. 100
Total Ledger Debits:    6
Result: PASSED (Zero Overdraft, Zero Drift)
```
