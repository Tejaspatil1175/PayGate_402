const crypto = require('crypto');

/**
 * Generate an RSA-2048 keypair in PEM format for agents / merchants
 * @returns {{ publicKey: string, privateKey: string }}
 */
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { publicKey, privateKey };
}

/**
 * Create SHA-256 hash of data string or object
 * @param {string|Object} data
 * @returns {string} Hex encoded hash
 */
function hashData(data) {
  const payload = typeof data === 'object' ? JSON.stringify(data) : String(data);
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Sign payload using RSA-PSS SHA256 and a private key
 * @param {string|Object} data - Data payload to sign
 * @param {string} privateKey - RSA Private key in PEM format
 * @returns {string} Base64 encoded signature string
 */
function signData(data, privateKey) {
  const payload = typeof data === 'object' ? JSON.stringify(data) : String(data);
  const signer = crypto.createSign('SHA256');
  signer.update(payload);
  signer.end();
  return signer.sign(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    },
    'base64'
  );
}

/**
 * Verify RSA-PSS SHA256 signature against data payload and public key
 * @param {string|Object} data - Original payload
 * @param {string} signature - Base64 encoded signature
 * @param {string} publicKey - RSA Public key in PEM format
 * @returns {boolean} True if signature is valid, false otherwise
 */
function verifySignature(data, signature, publicKey) {
  try {
    const payload = typeof data === 'object' ? JSON.stringify(data) : String(data);
    const verifier = crypto.createVerify('SHA256');
    verifier.update(payload);
    verifier.end();
    return verifier.verify(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      },
      signature,
      'base64'
    );
  } catch (error) {
    return false;
  }
}

/**
 * Generate a cryptographically secure 32-byte hex nonce
 * @returns {string}
 */
function generateNonce() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  generateKeyPair,
  hashData,
  signData,
  verifySignature,
  generateNonce,
};
