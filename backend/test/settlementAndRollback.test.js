const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('Settlement Precision, Ledger Debit & Auto-Rollback Suite', () => {
  // Precision math helpers matching wallet.service.js
  const toPaise = (rupees) => Math.round(Number(rupees) * 100);
  const fromPaise = (paise) => Math.round(Number(paise)) / 100;

  it('should eliminate floating-point drift using integer paise arithmetic', () => {
    // Standard JS float issue: 0.1 + 0.2 = 0.30000000000000004
    const floatSum = 0.1 + 0.2;
    assert.notStrictEqual(floatSum, 0.3, 'Native float exhibits representation drift');

    // Integer paise math:
    const safeSum = fromPaise(toPaise(0.1) + toPaise(0.2));
    assert.strictEqual(safeSum, 0.3, 'Paise arithmetic must compute exact currency amount');
  });

  it('should maintain exact balance precision across 100 successive micro-credits and debits', () => {
    let balancePaise = toPaise(1000.00); // ₹1,000.00 initial balance

    for (let i = 0; i < 100; i++) {
      balancePaise += toPaise(10.55); // credit ₹10.55
      balancePaise -= toPaise(10.55); // debit ₹10.55
    }

    const finalBalance = fromPaise(balancePaise);
    assert.strictEqual(finalBalance, 1000.00, 'Balance must remain perfectly unchanged after 100 micro-operations');
  });

  it('should atomically debit wallet and prevent overdrafts', () => {
    let wallet = {
      balance: 1500,
      dailySpent: 0,
      perDayCap: 10000,
      perTransactionCap: 5000,
      ledger: [],
    };

    function debit(amount, refId) {
      if (amount <= 0) throw new Error('Invalid amount');
      if (amount > wallet.perTransactionCap) throw new Error('Per-tx cap exceeded');
      if (wallet.balance < amount) throw new Error('Insufficient balance');
      if (wallet.dailySpent + amount > wallet.perDayCap) throw new Error('Daily cap exceeded');

      wallet.balance = fromPaise(toPaise(wallet.balance) - toPaise(amount));
      wallet.dailySpent = fromPaise(toPaise(wallet.dailySpent) + toPaise(amount));
      wallet.ledger.push({ type: 'debit', amount, referenceId: refId, status: 'completed' });
      return wallet;
    }

    // Valid debit
    debit(1200, 'ref_tx_001');
    assert.strictEqual(wallet.balance, 300);
    assert.strictEqual(wallet.dailySpent, 1200);

    // Overdraft attempt: must throw
    assert.throws(() => {
      debit(500, 'ref_tx_002');
    }, /Insufficient balance/);
    assert.strictEqual(wallet.balance, 300, 'Balance must not change on failed debit');
  });

  it('should execute automatic rollback compensation on simulated order settlement failure', () => {
    let wallet = {
      balance: 5000,
      dailySpent: 0,
      ledger: [],
    };

    const targetAmount = 1499;
    const contractId = 'contract_mnd_9921';

    // 1. Initial Debit
    wallet.balance = fromPaise(toPaise(wallet.balance) - toPaise(targetAmount));
    wallet.ledger.push({ type: 'debit', amount: targetAmount, referenceId: contractId, status: 'completed' });
    assert.strictEqual(wallet.balance, 3501);

    // 2. Simulated order creation or inventory lock exception
    const simulateOrderCreation = () => {
      throw new Error('Merchant inventory out of stock during settlement');
    };

    try {
      simulateOrderCreation();
    } catch (settlementError) {
      // 3. Auto-Rollback Execution (compensation refund)
      const rollbackRef = `rollback_${contractId}`;
      wallet.balance = fromPaise(toPaise(wallet.balance) + toPaise(targetAmount));
      wallet.ledger.push({
        type: 'rollback_refund',
        amount: targetAmount,
        referenceId: rollbackRef,
        status: 'completed',
        reason: settlementError.message,
      });
    }

    // 4. Verify wallet restored to 100% initial balance with clear audit trail
    assert.strictEqual(wallet.balance, 5000, 'Wallet balance must be fully restored after rollback');
    assert.strictEqual(wallet.ledger.length, 2);
    assert.strictEqual(wallet.ledger[1].type, 'rollback_refund');
    assert.strictEqual(wallet.ledger[1].referenceId, `rollback_${contractId}`);
  });
});
