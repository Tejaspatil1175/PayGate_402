# ADR 003: Integer Paise Arithmetic & CAS Atomic Ledger Concurrency

## Status
**Accepted** (Implemented in `backend/services/wallet.service.js`)

## Context
In agentic commerce, AI agents execute high-frequency micro-transactions. Standard IEEE-754 binary floating-point representation in JavaScript causes representation drift (e.g. $0.1 + 0.2 = 0.30000000000000004$). Additionally, concurrent asynchronous debit operations can race to read the same balance, leading to double-spending and balance overdrafts below 0.

## Decision
1. **Integer Paise Representation:** All internal calculations, ledger entries, velocity accumulators, and spend limits operate strictly in integer paise ($\text{paise} = \text{round}(\text{amount} \times 100)$).
2. **Atomic Compare-And-Swap (CAS):** Ledger debits are executed using a single atomic MongoDB operation:
   `Wallet.findOneAndUpdate({ owner: userId, balance: { $gte: amount } }, { $inc: { balance: -amount }, $push: { ledger: ... } })`.

## Consequences
- **Positive:** Mathematical balance drift is reduced to 0.00% across infinite transactions.
- **Positive:** Zero overdraft invariant is guaranteed by database-level document mutex locking.
- **Negative:** Currency values must be converted to float rupees at display boundaries.
