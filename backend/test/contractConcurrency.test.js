const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Intent = require('../models/Intent');
const Merchant = require('../models/Merchant');
const Contract = require('../models/Contract');
const { generateCommerceContract } = require('../services/contract.service');
const { generateKeyPair, generateNonce } = require('../utils/crypto');

describe('Contract Nonce Anti-Replay & Concurrency Suite', () => {
  let testIntentId = null;
  let testMerchantId = null;
  let createdMerchant = false;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/paygate402';
      await mongoose.connect(mongoUri);
    }
  });

  after(async () => {
    if (testIntentId) {
      await Contract.deleteMany({ intent: testIntentId });
      await Intent.deleteOne({ _id: testIntentId });
    }
    if (createdMerchant && testMerchantId) {
      await Merchant.deleteOne({ _id: testMerchantId });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it('should allow exactly 1 contract generation and reject 9 parallel replay calls with the same intentId', async () => {
    const parallelCallsCount = 10;
    const agreedAmount = 1200;

    // 1. Get or create a merchant
    let merchant = await Merchant.findOne();
    if (!merchant) {
      merchant = await Merchant.create({
        businessName: 'AP2 Test Merchant',
        email: 'test_merchant@paygate.internal',
        businessCategory: 'Electronics',
        status: 'approved',
        apiKey: `key_${generateNonce().substring(0, 16)}`,
        apiSecret: `sec_${generateNonce().substring(0, 16)}`,
      });
      createdMerchant = true;
    }
    testMerchantId = merchant._id;

    // 2. Generate RSA keypair and create initial Intent in 'submitted' state
    const keys = generateKeyPair();
    const intent = await Intent.create({
      agentId: 'agent_concurrency_race_tester',
      userPublicKey: keys.publicKey,
      budgetCap: 5000,
      status: 'submitted',
      nonce: generateNonce(),
    });
    testIntentId = intent._id;

    assert.strictEqual(intent.status, 'submitted', 'Intent must initially be in submitted state');

    // 3. Fire 10 parallel generateCommerceContract() calls with the same intentId
    const contractPromises = Array.from({ length: parallelCallsCount }, () =>
      generateCommerceContract({
        intentId: intent._id,
        merchantId: merchant._id,
        agreedAmount,
        userPrivateKey: keys.privateKey,
        userPublicKey: keys.publicKey,
      })
    );

    const results = await Promise.allSettled(contractPromises);

    // 4. Separate and count fulfilled vs rejected calls
    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    // Log how many succeeded vs failed
    console.log(`\n--- Contract Anti-Replay Concurrency Proof Results ---`);
    console.log(`Total Parallel Calls: ${parallelCallsCount}`);
    console.log(`Succeeded Calls:      ${succeeded.length}`);
    console.log(`Failed Calls:         ${failed.length}`);
    failed.forEach((f, idx) => {
      console.log(`  Fail Reason #${idx + 1}: ${f.reason?.message}`);
    });

    // 5. Query MongoDB for contracts minted from this intent
    const contractsInDb = await Contract.find({ intent: intent._id });
    const finalIntent = await Intent.findById(testIntentId);
    console.log(`Contracts Minted in DB: ${contractsInDb.length}`);
    console.log(`Final Intent Status:    ${finalIntent.status}`);
    console.log(`----------------------------------------------------\n`);

    // 6. Assertions
    // Total settled promises must equal 10
    assert.strictEqual(
      succeeded.length + failed.length,
      parallelCallsCount,
      'All 10 parallel promises must have settled'
    );

    // Exactly 1 must succeed
    assert.strictEqual(
      succeeded.length,
      1,
      'Exactly 1 contract generation call must succeed'
    );

    // Exactly 9 must fail
    assert.strictEqual(
      failed.length,
      9,
      'Exactly 9 parallel replay calls must be rejected'
    );

    // Assert all 9 rejections explicitly mention replay
    failed.forEach((f) => {
      assert.match(
        f.reason?.message || '',
        /Replay detected/i,
        'Rejected calls must specify replay detection'
      );
    });

    // In DB, exactly 1 contract must exist for this intent
    assert.strictEqual(
      contractsInDb.length,
      1,
      'Database must contain exactly 1 contract document for the intent'
    );

    // Final intent status must be 'contract_created'
    assert.strictEqual(
      finalIntent.status,
      'contract_created',
      'Intent status must be updated to contract_created'
    );
  });
});
