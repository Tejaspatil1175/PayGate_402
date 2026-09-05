const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const walletService = require('../services/wallet.service');

describe('Wallet Concurrency & Overdraft Protection Suite', () => {
  let testWalletId = null;

  before(async () => {
    if (mongoose.connection.readyState !== 1) {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/paygate402';
      await mongoose.connect(mongoUri);
    }
  });

  after(async () => {
    if (testWalletId) {
      await Wallet.deleteOne({ _id: testWalletId });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it('should maintain strict mathematical balance and prevent overdraft during 10 parallel debit calls', async () => {
    const initialBalance = 1000;
    const debitAmount = 150;
    const referenceId = 'ref_race_tx_001';
    const parallelCallsCount = 10;

    // 1. Create a wallet with initial balance 1000 via existing Wallet model
    const testOwnerId = new mongoose.Types.ObjectId();
    const wallet = await Wallet.create({
      owner: testOwnerId,
      balance: initialBalance,
      currency: 'INR',
      perTransactionCap: 10000,
      perDayCap: 50000,
      dailySpent: 0,
      lastSpentResetDate: new Date(),
      ledger: [],
    });
    testWalletId = wallet._id;

    assert.strictEqual(wallet.balance, 1000, 'Initial wallet balance must be exactly 1000');

    // 2. Fire 10 parallel calls to walletService.debitWallet() with same amount (150) and referenceId
    const debitPromises = Array.from({ length: parallelCallsCount }, (_, index) =>
      walletService.debitWallet(
        testOwnerId,
        debitAmount,
        referenceId,
        `Concurrent Debit Worker #${index + 1}`
      )
    );

    const results = await Promise.allSettled(debitPromises);

    // 3. Separate and count fulfilled vs rejected calls
    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    // Log how many succeeded vs failed
    console.log(`\n--- Concurrency Proof Test Results ---`);
    console.log(`Total Parallel Calls: ${parallelCallsCount}`);
    console.log(`Succeeded Calls:      ${succeeded.length}`);
    console.log(`Failed Calls:         ${failed.length}`);
    failed.forEach((f, idx) => {
      console.log(`  Fail Reason #${idx + 1}: ${f.reason?.message}`);
    });

    // 4. Fetch the final wallet state from the database
    const finalWallet = await Wallet.findById(testWalletId);
    console.log(`Final Database Balance: ₹${finalWallet.balance}`);
    console.log(`Total Ledger Debits:    ${finalWallet.ledger.length}`);
    console.log(`--------------------------------------\n`);

    // 5. Mathematical & Integrity Assertions
    // Total executed promises must equal 10
    assert.strictEqual(
      succeeded.length + failed.length,
      parallelCallsCount,
      'All 10 parallel promises must have settled'
    );

    // No overdraft below 0
    assert.ok(
      finalWallet.balance >= 0,
      `Wallet balance must never drop below 0 (current: ${finalWallet.balance})`
    );

    // Mathematical correctness: final balance = initialBalance - (succeededCount * debitAmount)
    const expectedFinalBalance = initialBalance - (succeeded.length * debitAmount);
    assert.strictEqual(
      finalWallet.balance,
      expectedFinalBalance,
      `Final wallet balance (₹${finalWallet.balance}) must exactly match expected balance (₹${expectedFinalBalance}) with zero drift`
    );

    // Ledger audit count must match succeeded count
    assert.strictEqual(
      finalWallet.ledger.length,
      succeeded.length,
      'Ledger must record exactly one debit entry per succeeded call'
    );
  });
});
