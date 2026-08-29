const Negotiation = require('../models/Negotiation');
const Product = require('../models/Product');
const Intent = require('../models/Intent');
const PolicyRule = require('../models/PolicyRule');
const Campaign = require('../models/Campaign');
const { logAuditEvent } = require('../middleware/auditLogger');

/**
 * Initiate negotiation / counter-offer flow with policy auto-accept/reject rules
 * @param {Object} params - { intentId, productId, proposedPrice, quantity, agentId }
 * @returns {Promise<Object>} Created/Evaluated Negotiation document
 */
async function initiateNegotiation(params) {
  const { intentId, productId, proposedPrice, quantity = 1 } = params;

  const intent = await Intent.findById(intentId);
  if (!intent) {
    throw new Error('Intent not found');
  }

  const product = await Product.findById(productId).populate('merchant');
  if (!product) {
    throw new Error('Product not found');
  }

  const merchantId = product.merchant._id;
  const originalPrice = product.price;

  // Calculate discount requested
  const discountAmount = Math.max(0, originalPrice - proposedPrice);
  const discountPercentage = Math.round((discountAmount / originalPrice) * 100);

  // Check budget cap
  const totalProposed = proposedPrice * quantity;
  if (totalProposed > intent.budgetCap) {
    throw new Error(`Proposed price ₹${totalProposed} exceeds intent budget cap ₹${intent.budgetCap}`);
  }

  // Fetch active merchant policy rules
  const policyRules = await PolicyRule.find({ merchant: merchantId, isActive: true }).lean();

  let initialStatus = 'open';
  let rejectionReason = '';
  let note = `Initial offer submitted by agent: ₹${proposedPrice} (${discountPercentage}% discount)`;

  // 1. Check for Active Matching Campaigns (Bulk/Promo discounts)
  const now = new Date();
  const activeCampaign = await Campaign.findOne({
    merchant: merchantId,
    isActive: true,
    minQuantity: { $lte: quantity },
    $and: [
      { $or: [{ startDate: { $lte: now } }, { startDate: null }] },
      { $or: [{ endDate: { $gte: now } }, { endDate: null }] },
    ],
  }).sort({ discountPercent: -1 });

  // 2. Policy Engine Evaluation against active merchant PolicyRules:
  const maxSpendRule = policyRules.find((r) => r.ruleType === 'max_spend_cap');
  const activeRule = maxSpendRule || policyRules[0];

  const autoAcceptPct =
    activeRule && activeRule.autoAcceptDiscountPercent !== undefined
      ? activeRule.autoAcceptDiscountPercent
      : 10;
  const maxAllowedPct =
    activeRule && activeRule.maxAllowedDiscountPercent !== undefined
      ? activeRule.maxAllowedDiscountPercent
      : 25;

  if (maxSpendRule && totalProposed > maxSpendRule.maxAmount) {
    initialStatus = 'rejected';
    rejectionReason = `Total proposed price ₹${totalProposed} exceeds merchant max single transaction cap ₹${maxSpendRule.maxAmount}`;
    note = `Auto-rejected by policy engine: ${rejectionReason}`;
  } else if (discountPercentage <= 0) {
    initialStatus = 'accepted';
    note = 'Auto-accepted by policy engine: Full list price offered.';
  } else if (activeCampaign && discountPercentage <= activeCampaign.discountPercent) {
    initialStatus = 'accepted';
    note = `Auto-accepted via Campaign "${activeCampaign.name}": ${activeCampaign.discountPercent}% promo discount applied for ≥${activeCampaign.minQuantity} units (requested ${discountPercentage}% off).`;
  } else if (discountPercentage <= autoAcceptPct) {
    initialStatus = 'accepted';
    note = `Auto-accepted by policy engine: Discount of ${discountPercentage}% is within merchant ${autoAcceptPct}% auto-approval policy.`;
  } else if (discountPercentage > maxAllowedPct) {
    initialStatus = 'rejected';
    rejectionReason = `Discount request of ${discountPercentage}% exceeds merchant max allowed ${maxAllowedPct}% policy threshold`;
    note = `Auto-rejected by policy engine: ${rejectionReason}`;
  }

  const negotiation = await Negotiation.create({
    intent: intent._id,
    merchant: merchantId,
    product: product._id,
    agentId: params.agentId || intent.agentId,
    originalPrice,
    proposedPrice,
    quantity,
    discountPercentage,
    status: initialStatus,
    rejectionReason,
    rounds: [
      {
        sender: 'agent',
        proposedPrice,
        note: `Agent proposed ₹${proposedPrice}`,
      },
      {
        sender: 'policy_engine',
        proposedPrice: initialStatus === 'accepted' ? proposedPrice : originalPrice,
        note,
      },
    ],
  });

  await logAuditEvent({
    correlationId: intent.nonce,
    agentId: params.agentId || intent.agentId,
    merchant: merchantId,
    action: 'NEGOTIATION_INITIATED',
    decision: initialStatus === 'rejected' ? 'BLOCK' : 'ALLOW',
    reason: note,
    metadata: {
      negotiationId: negotiation._id,
      originalPrice,
      proposedPrice,
      status: initialStatus,
    },
  });

  return negotiation;
}

/**
 * Respond to an active negotiation (counter-offer, accept, reject)
 * @param {string} negotiationId
 * @param {Object} response - { sender, action, counterPrice, note }
 */
async function respondToNegotiation(negotiationId, response) {
  const negotiation = await Negotiation.findById(negotiationId);
  if (!negotiation) {
    throw new Error('Negotiation not found');
  }

  if (negotiation.status !== 'open') {
    throw new Error(`Negotiation is already ${negotiation.status}`);
  }

  const { sender, action, counterPrice, note } = response;

  if (action === 'accept') {
    negotiation.status = 'accepted';
    negotiation.proposedPrice = counterPrice || negotiation.proposedPrice;
    negotiation.rounds.push({
      sender,
      proposedPrice: negotiation.proposedPrice,
      note: note || `${sender} accepted the offer of ₹${negotiation.proposedPrice}`,
    });
  } else if (action === 'reject') {
    negotiation.status = 'rejected';
    negotiation.rejectionReason = note || 'Offer rejected by counterparty';
    negotiation.rounds.push({
      sender,
      proposedPrice: negotiation.proposedPrice,
      note: negotiation.rejectionReason,
    });
  } else if (action === 'counter') {
    if (!counterPrice || counterPrice <= 0) {
      throw new Error('Counter price is required for counter-offer');
    }
    negotiation.proposedPrice = counterPrice;
    negotiation.discountPercentage = Math.round(
      ((negotiation.originalPrice - counterPrice) / negotiation.originalPrice) * 100
    );
    negotiation.rounds.push({
      sender,
      proposedPrice: counterPrice,
      note: note || `${sender} counter-offered ₹${counterPrice}`,
    });
  }

  await negotiation.save();

  return negotiation;
}

module.exports = {
  initiateNegotiation,
  respondToNegotiation,
};
