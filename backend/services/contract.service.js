const mongoose = require('mongoose');
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

  // Replay Attack Nonce Protection: an Intent's nonce is single-use for contract generation.
  // Transition intent status to 'contract_created' atomically with findOneAndUpdate so that
  // concurrent requests cannot race past the status check.
  const intent = await Intent.findOneAndUpdate(
    {
      _id: intentId,
      status: { $nin: ['contract_created', 'completed'] },
    },
    {
      $set: { status: 'contract_created' },
    },
    { new: false }
  );

  if (!intent) {
    const existingIntent = await Intent.findById(intentId);
    if (!existingIntent) {
      throw new Error('Intent not found');
    }
    throw new Error(`[SECURITY_GATE_REJECTED] Replay detected: intent nonce has already been consumed to generate a commerce contract`);
  }

  const merchant = await Merchant.findById(merchantId);
  if (!merchant) {
    throw new Error('Merchant not found');
  }

  // Validate agreed amount against intent budget cap
  if (agreedAmount > intent.budgetCap) {
    throw new Error(`Agreed contract amount ₹${agreedAmount} exceeds intent budget cap ₹${intent.budgetCap}`);
  }

const logger = require('../utils/logger');

// Handle RSA keys for signing
  let keys = { publicKey: providedPubKey, privateKey: userPrivateKey };
  if (!userPrivateKey || !providedPubKey) {
    const isDemoAllowed = process.env.NODE_ENV === 'demo' || params.allowDemoKeys === true;
    if (!isDemoAllowed) {
      logger.error('[SECURITY_FATAL] Buyer keys required for contract generation');
      throw new Error('[SECURITY_FATAL] Buyer keys required');
    }
    // Ephemeral keypair generated if supplied for sandbox demo mode
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

  let contract;
  try {
    contract = await Contract.create({
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
  } catch (err) {
    await Intent.findByIdAndUpdate(intentId, { status: intent.status });
    throw err;
  }

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
    const isObjectId = mongoose.Types.ObjectId.isValid(contractInput) && String(new mongoose.Types.ObjectId(contractInput)) === contractInput;
    contract = await Contract.findOne(
      isObjectId
        ? { $or: [{ _id: contractInput }, { contractId: contractInput }] }
        : { contractId: contractInput }
    );
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
