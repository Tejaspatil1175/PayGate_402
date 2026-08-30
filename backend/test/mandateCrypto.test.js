const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  generateKeyPair,
  hashData,
  signData,
  verifySignature,
  generateNonce,
} = require('../utils/crypto');

describe('AP2 Mandate Cryptography & Signature Validation Suite', () => {
  it('should generate a valid 2048-bit RSA keypair in PEM format', () => {
    const { publicKey, privateKey } = generateKeyPair();

    assert.ok(publicKey.includes('BEGIN PUBLIC KEY'), 'Public key must be in SPKI PEM format');
    assert.ok(privateKey.includes('BEGIN PRIVATE KEY'), 'Private key must be in PKCS8 PEM format');
    assert.ok(publicKey.length > 300, 'Public key length must be valid for RSA-2048');
  });

  it('should sign an AP2 Cart Mandate and verify the signature successfully', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const mandatePayload = {
      mandateId: 'mnd_' + generateNonce().substring(0, 12),
      merchantId: 'merchant_acme_corp',
      agentId: 'agent_buyer_01',
      agreedAmount: 1499,
      currency: 'INR',
      items: [
        { productId: 'prod_99', title: 'Noise Cancelling Headphones', price: 1499, quantity: 1 }
      ],
      nonce: generateNonce(),
      timestamp: Date.now(),
    };

    const signature = signData(mandatePayload, privateKey);
    assert.ok(signature, 'Signature must be generated');
    assert.strictEqual(typeof signature, 'string');

    const isValid = verifySignature(mandatePayload, signature, publicKey);
    assert.strictEqual(isValid, true, 'RSA-PSS signature verification must return true for authentic payload');
  });

  it('should reject mandate if payload fields are tampered or altered', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const originalMandate = {
      merchantId: 'merchant_acme_corp',
      agentId: 'agent_buyer_01',
      agreedAmount: 1499,
      currency: 'INR',
      nonce: generateNonce(),
    };

    const signature = signData(originalMandate, privateKey);

    // Tampered payload (attacker modified amount from 1499 to 499)
    const tamperedMandate = {
      ...originalMandate,
      agreedAmount: 499,
    };

    const isValid = verifySignature(tamperedMandate, signature, publicKey);
    assert.strictEqual(isValid, false, 'Tampered mandate must fail signature verification');
  });

  it('should reject mandate if verified against an unauthorized public key', () => {
    const userKeys = generateKeyPair();
    const rogueKeys = generateKeyPair();

    const mandatePayload = {
      merchantId: 'merchant_acme_corp',
      agreedAmount: 2500,
      nonce: generateNonce(),
    };

    const signature = signData(mandatePayload, userKeys.privateKey);

    // Verifying user's signature against rogue public key
    const isValid = verifySignature(mandatePayload, signature, rogueKeys.publicKey);
    assert.strictEqual(isValid, false, 'Verification against wrong public key must fail');
  });

  it('should deterministically generate identical SHA-256 mandate hashes for identical payloads', () => {
    const payload = {
      merchant: 'm_001',
      amount: 5000,
      nonce: 'fixed_nonce_12345',
    };

    const hash1 = hashData(payload);
    const hash2 = hashData(payload);

    assert.strictEqual(hash1, hash2, 'SHA-256 hashes must be deterministic');
    assert.strictEqual(hash1.length, 64, 'SHA-256 hex digest must be 64 characters');
  });
});
