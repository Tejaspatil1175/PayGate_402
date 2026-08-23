const PolicyRule = require('../models/PolicyRule');
const Order = require('../models/Order');
const Merchant = require('../models/Merchant');

/**
 * Perform real-time policy pre-validation before contract generation/signing
 * @param {Object} params - { merchantId, agentId, amount, category, budgetCap }
 * @returns {Promise<Object>} Detailed policy pre-check evaluation result
 */
async function performPolicyPreCheck(params) {
  const { merchantId, agentId, amount = 0, category = 'General', budgetCap } = params;

  if (!merchantId) {
    throw new Error('Merchant ID is required for policy pre-check');
  }

  const merchant = await Merchant.findById(merchantId).lean();
  if (!merchant) {
    throw new Error('Merchant not found');
  }

  const checksEvaluated = [];
  let preCheckPassed = true;
  let gateDecision = 'ALLOW';
  let failureReason = '';

  // 1. Budget Cap Check (Permission Slip Bound)
  if (budgetCap !== undefined && amount > budgetCap) {
    preCheckPassed = false;
    gateDecision = 'BLOCK';
    failureReason = `Transaction amount ₹${amount} exceeds user intent budget cap ₹${budgetCap}`;
    checksEvaluated.push({
      checkName: 'user_budget_cap',
      passed: false,
      details: failureReason,
    });
  } else {
    checksEvaluated.push({
      checkName: 'user_budget_cap',
      passed: true,
      details: `Amount ₹${amount} is within user budget cap ₹${budgetCap || 'unlimited'}`,
    });
  }

  // 2. Merchant Policy Rules Evaluation
  const activeRules = await PolicyRule.find({ merchant: merchantId, isActive: true }).lean();

  for (const rule of activeRules) {
    // Single Spend Cap Check
    if (rule.ruleType === 'max_spend_cap') {
      if (amount > rule.maxAmount) {
        preCheckPassed = false;
        gateDecision = 'BLOCK';
        failureReason = `Amount ₹${amount} exceeds merchant max single transaction cap ₹${rule.maxAmount}`;
        checksEvaluated.push({
          checkName: 'max_spend_cap',
          passed: false,
          ruleName: rule.name,
          details: failureReason,
        });
      } else {
        checksEvaluated.push({
          checkName: 'max_spend_cap',
          passed: true,
          ruleName: rule.name,
          details: `Amount ₹${amount} <= max cap ₹${rule.maxAmount}`,
        });
      }
    }

    // Category Allowlist Check
    if (rule.ruleType === 'allowed_categories' && rule.allowedCategories.length > 0) {
      if (!rule.allowedCategories.includes(category)) {
        preCheckPassed = false;
        gateDecision = 'BLOCK';
        failureReason = `Category '${category}' is not in merchant allowed list`;
        checksEvaluated.push({
          checkName: 'allowed_categories',
          passed: false,
          ruleName: rule.name,
          details: failureReason,
        });
      } else {
        checksEvaluated.push({
          checkName: 'allowed_categories',
          passed: true,
          ruleName: rule.name,
          details: `Category '${category}' allowed`,
        });
      }
    }

    // Manual Approval Threshold Check
    if (rule.ruleType === 'require_manual_approval' && amount > rule.requireApprovalThreshold) {
      gateDecision = 'REQUIRE_APPROVAL';
      checksEvaluated.push({
        checkName: 'require_manual_approval',
        passed: true,
        requiresApproval: true,
        ruleName: rule.name,
        details: `Amount ₹${amount} exceeds manual approval threshold ₹${rule.requireApprovalThreshold}`,
      });
    }

    // 24-Hour Velocity Check
    if (rule.ruleType === 'daily_velocity_limit') {
      const past24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentOrders = await Order.find({
        merchant: merchantId,
        createdAt: { $gte: past24Hours },
        status: { $in: ['paid', 'created', 'fulfilled'] },
      }).lean();

      const currentDailySpend = recentOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
      const projectedSpend = currentDailySpend + amount;

      if (projectedSpend > rule.dailyCap) {
        preCheckPassed = false;
        gateDecision = 'BLOCK';
        failureReason = `Projected 24h spend ₹${projectedSpend} exceeds merchant daily cap ₹${rule.dailyCap}`;
        checksEvaluated.push({
          checkName: 'daily_velocity_limit',
          passed: false,
          ruleName: rule.name,
          details: failureReason,
        });
      } else {
        checksEvaluated.push({
          checkName: 'daily_velocity_limit',
          passed: true,
          ruleName: rule.name,
          details: `Projected 24h spend ₹${projectedSpend} <= daily cap ₹${rule.dailyCap}`,
        });
      }
    }
  }

  return {
    protocol: 'AP2/x402',
    preCheckPassed,
    gateDecision: preCheckPassed ? gateDecision : 'BLOCK',
    reason: preCheckPassed
      ? (gateDecision === 'REQUIRE_APPROVAL' ? 'Policy pre-check requires manual merchant approval' : 'All real-time policy pre-checks PASSED')
      : failureReason,
    checksCount: checksEvaluated.length,
    checks: checksEvaluated,
    evaluatedAt: new Date().toISOString(),
  };
}

module.exports = {
  performPolicyPreCheck,
};
