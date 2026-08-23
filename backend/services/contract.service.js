const Contract = require('../models/Contract');
const Intent = require('../models/Intent');
const Merchant = require('../models/Merchant');
const Product = require('../models/Product');
const {
  generateKeyPair,
  hashData,
  signData,
  verifySignature,
  generateNonce,
} = require('../utils/crypto');
const { logAuditEvent } = require('../middleware/auditLogger');

/**
 * Generate a cryptographically signed AP2 Commerce Contract / Cart Mandate
 * @param {Object} params - { intentId, merchantId, items, agreedAmount, userPrivateKey, userPublicKey, expiresInMinutes }
 * @returns {Promise<Object>} Created Contract document
 */
async function generateCommerceContract(params) {
  const {
    intentId,
    merchantId,
    items = [],
    agreedAmount,
    userPrivateKey,
    userPublicKey: providedPubKey,
    expiresInMinutes = 60,
  } = params;

  const intent = await Intent.findById(intentId);
  if (!intent) {
    throw new Error('Intent not found');
  }

  const merchant = await Merchant.findById(merchantId);
  if (!merchant) {
    throw new Error('Merchant not found');
  }

  // Validate agreed amount against intent budget cap
  if (agreedAmount > intent.budgetCap) {
    throw new Error(`Agreed contract amount ₹${agreedAmount} exceeds intent budget cap ₹${intent.budgetCap}`);
  }

  // Handle RSA keys for signing
  let keys = { publicKey: providedPubKey, privateKey: userPrivateKey };
  if (!userPrivateKey || !providedPubKey) {
    // Ephemeral keypair generated if not supplied for sandbox demo
    const generated = generateKeyPair();
    keys = {
      publicKey: providedPubKey || generated.publicKey,
      privateKey: userPrivateKey || generated.privateKey,
    };
  }

  const contractId = `contract_${generateNonce().substring(0, 16)}`;
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  const contractTerms = {
    agreedAmount,
    currency: 'INR',
    spendCap: intent.budgetCap,
    merchantCategory: merchant.businessCategory || 'General',
  };

  // Create deterministic Mandate Hash
  const payloadToHash = {
    contractId,
    intentId: intent._id.toString(),
    merchantId: merchant._id.toString(),
    agentId: intent.agentId,
    contractTerms,
    expiresAt: expiresAt.toISOString(),
  };

  const mandateHash = hashData(payloadToHash);

  // Sign mandate hash using RSA-PSS SHA-256
  const userSignature = signData(mandateHash, keys.privateKey);

  const contract = await Contract.create({
    contractId,
    intent: intent._id,
    merchant: merchant._id,
    agentId: intent.agentId,
    userPublicKey: keys.publicKey,
    items,
    contractTerms,
    mandateHash,
    userSignature,
    expiresAt,
    status: 'signed',
  });

  // Update intent status
  intent.status = 'contract_created';
  await intent.save();

  await logAuditEvent({
    correlationId: mandateHash,
    agentId: intent.agentId,
    merchant: merchant._id,
    mandateHash,
    action: 'CONTRACT_GENERATED',
    decision: 'ALLOW',
    reason: `Signed commerce contract generated for ₹${agreedAmount}`,
    metadata: {
      contractId: contract.contractId,
      mandateHash,
      agreedAmount,
      expiresAt,
    },
  });

  return {
    contract,
    keys: {
      publicKey: keys.publicKey,
    },
  };
}

/**
 * Verify RSA-PSS signature and validity of a Commerce Contract
 * @param {string|Object} contractInput - Contract ID or Contract document
 * @returns {Promise<Object>} { isValid: boolean, reason: string, contract: Object }
 */
async function verifyCommerceContract(contractInput) {
  let contract;
  if (typeof contractInput === 'string') {
    contract = await Contract.findOne({
      $or: [{ _id: contractInput }, { contractId: contractInput }],
    });
  } else {
    contract = contractInput;
  }

  if (!contract) {
    return { isValid: false, reason: 'Contract not found' };
  }

  // Check expiration
  if (new Date() > new Date(contract.expiresAt)) {
    contract.status = 'expired';
    await contract.save();
    return { isValid: false, reason: 'Contract has expired', contract };
  }

  // Re-hash contract terms to verify integrity
  const payloadToHash = {
    contractId: contract.contractId,
    intentId: contract.intent.toString(),
    merchantId: contract.merchant.toString(),
    agentId: contract.agentId,
    contractTerms: contract.contractTerms,
    expiresAt: new Date(contract.expiresAt).toISOString(),
  };

  const recomputedHash = hashData(payloadToHash);

  if (recomputedHash !== contract.mandateHash) {
    return { isValid: false, reason: 'Mandate hash mismatch — payload tampered', contract };
  }

  // Verify RSA-PSS signature
  const isSignatureValid = verifySignature(
    contract.mandateHash,
    contract.userSignature,
    contract.userPublicKey
  );

  if (!isSignatureValid) {
    return { isValid: false, reason: 'Invalid RSA-PSS digital signature', contract };
  }

  contract.status = 'verified';
  await contract.save();

  return {
    isValid: true,
    reason: 'RSA-PSS Digital Signature and Mandate Hash verified successfully',
    contract,
  };
}

module.exports = {
  generateCommerceContract,
  verifyCommerceContract,
};
