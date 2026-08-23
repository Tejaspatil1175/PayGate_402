const fs = require('fs');
const path = require('path');
const PolicyRule = require('../models/PolicyRule');
const Merchant = require('../models/Merchant');

/**
 * Evaluate transaction details against active policy rules for a merchant
 * @param {string} merchantId
 * @param {Object} transaction - { amount, category, agentId }
 * @returns {Promise<Object>} { passed: boolean, reason: string, rule: Object }
 */
async function evaluatePolicy(merchantId, transaction) {
  const { amount = 0, category = 'General' } = transaction;

  const rules = await PolicyRule.find({ merchant: merchantId, isActive: true }).lean();

  if (rules.length === 0) {
    // Default fallback safety check if no rules exist
    if (amount > 10000) {
      return {
        passed: false,
        reason: 'Order amount exceeds default safety cap of ₹10,000',
        rule: 'default_safety_cap',
      };
    }
    return {
      passed: true,
      reason: 'No restrictive policy rules configured. Transaction allowed under default bounds.',
    };
  }

  for (const rule of rules) {
    // Check max spend cap per transaction
    if (rule.ruleType === 'max_spend_cap' && amount > rule.maxAmount) {
      return {
        passed: false,
        reason: `Transaction amount ₹${amount} exceeds single transaction cap of ₹${rule.maxAmount}`,
        rule: rule.name,
      };
    }

    // Check category restriction
    if (
      rule.ruleType === 'allowed_categories' &&
      rule.allowedCategories.length > 0 &&
      !rule.allowedCategories.includes(category)
    ) {
      return {
        passed: false,
        reason: `Category '${category}' is not in allowed categories list`,
        rule: rule.name,
      };
    }

    // Check manual approval threshold
    if (rule.ruleType === 'require_manual_approval' && amount > rule.requireApprovalThreshold) {
      return {
        passed: false,
        requiresApproval: true,
        reason: `Transaction amount ₹${amount} exceeds manual approval threshold of ₹${rule.requireApprovalThreshold}`,
        rule: rule.name,
      };
    }
  }

  return {
    passed: true,
    reason: 'All active policy checks passed successfully',
  };
}

/**
 * Generate agent-policy.json for a merchant or default policy specs
 * @param {string} [merchantId]
 * @returns {Promise<Object>} AP2/x402 agent-policy specification
 */
async function generateAgentPolicy(merchantId = null) {
  let merchantInfo = null;
  let activeRules = [];

  if (merchantId) {
    const merchantDoc = await Merchant.findById(merchantId).lean();
    if (merchantDoc) {
      merchantInfo = {
        id: merchantDoc._id,
        businessName: merchantDoc.businessName,
      };
    }
    activeRules = await PolicyRule.find({ merchant: merchantId, isActive: true }).lean();
  }

  const defaultSpendCap = activeRules.find((r) => r.ruleType === 'max_spend_cap')?.maxAmount || 5000;
  const defaultDailyCap = activeRules.find((r) => r.ruleType === 'daily_velocity_limit')?.dailyCap || 25000;
  const approvalThreshold = activeRules.find((r) => r.ruleType === 'require_manual_approval')?.requireApprovalThreshold || 10000;

  return {
    protocol: 'AP2/x402',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    merchant: merchantInfo,
    policy: {
      singleTransactionCap: {
        amount: defaultSpendCap,
        currency: 'INR',
      },
      dailyVelocityLimit: {
        amount: defaultDailyCap,
        currency: 'INR',
      },
      approvalThreshold: {
        amount: approvalThreshold,
        currency: 'INR',
      },
      supportedProtocols: ['AP2/CartMandate', 'x402/BaseRPC'],
      enforcementMode: 'strict_proxy_gated',
    },
    activeRules: activeRules.map((r) => ({
      id: r._id.toString(),
      name: r.name,
      ruleType: r.ruleType,
      maxAmount: r.maxAmount,
    })),
  };
}

/**
 * Write agent-policy.json to public/.well-known directory
 * @param {string} [merchantId]
 * @param {string} [customPath]
 */
async function writePolicyToFile(merchantId = null, customPath = null) {
  const policyData = await generateAgentPolicy(merchantId);
  const targetDir = customPath || path.join(__dirname, '..', 'public', '.well-known');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filePath = path.join(targetDir, 'agent-policy.json');
  fs.writeFileSync(filePath, JSON.stringify(policyData, null, 2), 'utf8');

  return {
    filePath,
    policyData,
  };
}

module.exports = {
  evaluatePolicy,
  generateAgentPolicy,
  writePolicyToFile,
};
