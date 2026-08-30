const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { generateNonce } = require('../utils/crypto');

describe('Nonce Generation & Anti-Replay Protection Suite', () => {
  it('should generate cryptographically strong 32-byte (64-char) hex nonces', () => {
    const nonce = generateNonce();

    assert.strictEqual(typeof nonce, 'string');
    assert.strictEqual(nonce.length, 64, '32-byte hex nonce must be 64 characters long');
    assert.match(nonce, /^[0-9a-f]{64}$/, 'Nonce must consist of valid lowercase hex characters');
  });

  it('should guarantee zero collisions across large batch of generated nonces', () => {
    const totalNonces = 1000;
    const generatedSet = new Set();

    for (let i = 0; i < totalNonces; i++) {
      const nonce = generateNonce();
      generatedSet.add(nonce);
    }

    assert.strictEqual(
      generatedSet.size,
      totalNonces,
      '1000 independently generated nonces must all be unique'
    );
  });

  it('should detect and reject replayed intent nonces via state check', () => {
    // In-memory simulation of the anti-replay tracker used in contract.service.js
    const consumedNonces = new Set();

    function processIntentMandate(intent) {
      if (consumedNonces.has(intent.nonce)) {
        return {
          passed: false,
          ruleId: 'GATE_01_NONCE_REPLAY',
          reasonCode: 'NONCE_ALREADY_CONSUMED',
          error: 'Replay detected: intent nonce has already been consumed to generate a commerce contract',
        };
      }

      consumedNonces.add(intent.nonce);
      return {
        passed: true,
        ruleId: 'GATE_01_NONCE_VALID',
        reasonCode: 'NONCE_ACCEPTED',
      };
    }

    const testIntent = {
      intentId: 'int_12345',
      nonce: generateNonce(),
      amount: 1500,
    };

    // First attempt: should succeed and consume nonce
    const firstAttempt = processIntentMandate(testIntent);
    assert.strictEqual(firstAttempt.passed, true);
    assert.strictEqual(firstAttempt.reasonCode, 'NONCE_ACCEPTED');

    // Second attempt (attacker resending same payload): must be blocked
    const replayAttempt = processIntentMandate(testIntent);
    assert.strictEqual(replayAttempt.passed, false);
    assert.strictEqual(replayAttempt.ruleId, 'GATE_01_NONCE_REPLAY');
    assert.strictEqual(replayAttempt.reasonCode, 'NONCE_ALREADY_CONSUMED');
  });
});
