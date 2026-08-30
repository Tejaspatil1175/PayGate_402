const PolicyRule = require('../models/PolicyRule');
const Order = require('../models/Order');
const Merchant = require('../models/Merchant');
const walletService = require('./wallet.service');

/**
 * Perform real-time policy pre-validation before contract generation/signing
 * @param {Object} params - { merchantId, agentId, amount, category, budgetCap, userId }
 * @returns {Promise<Object>} Detailed policy pre-check evaluation result
 */
async function performPolicyPreCheck(params) {
  const { merchantId, agentId, amount = 0, category = 'General', budgetCap, userId } = params;

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
  let activeRuleId = '';
  let activeReasonCode = '';

  // 0. User Wallet Balance & Cap Check (gated on final negotiated price)
  if (userId) {
    try {
      const wallet = await walletService.getWalletBalance(userId);

      if (wallet.balance < amount) {
        preCheckPassed = false;
        gateDecision = 'BLOCK';
        activeRuleId = 'RULE_USER_WALLET_BALANCE_00';
        activeReasonCode = 'INSUFFICIENT_WALLET_BALANCE';
        failureReason = `Insufficient wallet balance: available ₹${wallet.balance}, required ₹${amount}`;
        checksEvaluated.push({
          checkName: 'user_wallet_balance',
          ruleId: 'RULE_USER_WALLET_BALANCE_00',
          reasonCode: 'INSUFFICIENT_WALLET_BALANCE',
          precedence: 10,
          passed: false,
          details: failureReason,
        });
      } else {
        checksEvaluated.push({
          checkName: 'user_wallet_balance',
          ruleId: 'RULE_USER_WALLET_BALANCE_00',
          reasonCode: 'WALLET_BALANCE_SUFFICIENT',
          precedence: 10,
          passed: true,
          details: `Available wallet balance ₹${wallet.balance} >= required ₹${amount}`,
        });
      }

      if (amount > wallet.perTransactionCap) {
        preCheckPassed = false;
        gateDecision = 'BLOCK';
        activeRuleId = activeRuleId || 'RULE_USER_WALLET_PER_TX_00';
        activeReasonCode = activeReasonCode || 'WALLET_PER_TX_CAP_EXCEEDED';
        failureReason = failureReason || `Amount ₹${amount} exceeds wallet per-transaction cap ₹${wallet.perTransactionCap}`;
        checksEvaluated.push({
          checkName: 'wallet_per_tx_cap',
          ruleId: 'RULE_USER_WALLET_PER_TX_00',
          reasonCode: 'WALLET_PER_TX_CAP_EXCEEDED',
          precedence: 20,
          passed: false,
          details: `Amount ₹${amount} exceeds wallet per-transaction cap ₹${wallet.perTransactionCap}`,
        });
      } else {
        checksEvaluated.push({
          checkName: 'wallet_per_tx_cap',
          ruleId: 'RULE_USER_WALLET_PER_TX_00',
          reasonCode: 'WALLET_PER_TX_WITHIN_CAP',
          precedence: 20,
          passed: true,
          details: `Amount ₹${amount} <= per-transaction cap ₹${wallet.perTransactionCap}`,
        });
      }

      const availableDailyCap = Math.max(0, wallet.perDayCap - wallet.dailySpent);
      if (amount > availableDailyCap) {
        preCheckPassed = false;
        gateDecision = 'BLOCK';
        activeRuleId = activeRuleId || 'RULE_USER_WALLET_DAILY_CAP_00';
        activeReasonCode = activeReasonCode || 'WALLET_DAILY_CAP_EXCEEDED';
        failureReason = failureReason || `Amount ₹${amount} exceeds wallet remaining daily cap ₹${availableDailyCap}`;
        checksEvaluated.push({
          checkName: 'wallet_daily_cap',
          ruleId: 'RULE_USER_WALLET_DAILY_CAP_00',
          reasonCode: 'WALLET_DAILY_CAP_EXCEEDED',
          precedence: 30,
          passed: false,
          details: `Amount ₹${amount} exceeds wallet remaining daily cap ₹${availableDailyCap}`,
        });
      } else {
        checksEvaluated.push({
          checkName: 'wallet_daily_cap',
          ruleId: 'RULE_USER_WALLET_DAILY_CAP_00',
          reasonCode: 'WALLET_DAILY_CAP_WITHIN_LIMIT',
          precedence: 30,
          passed: true,
          details: `Amount ₹${amount} <= remaining daily cap ₹${availableDailyCap}`,
        });
      }
    } catch (err) {
      checksEvaluated.push({
        checkName: 'user_wallet_check',
        ruleId: 'RULE_USER_WALLET_ERR',
        reasonCode: 'WALLET_LOOKUP_ERROR',
        passed: false,
        details: `Wallet check error: ${err.message}`,
      });
    }
  }

  // 1. Budget Cap Check (Permission Slip Bound)
  if (budgetCap !== undefined && amount > budgetCap) {
    preCheckPassed = false;
    gateDecision = 'BLOCK';
    activeRuleId = activeRuleId || 'RULE_USER_BUDGET_CAP_01';
    activeReasonCode = activeReasonCode || 'USER_BUDGET_CAP_EXCEEDED';
    failureReason = failureReason || `Transaction amount ₹${amount} exceeds user intent budget cap ₹${budgetCap}`;
    checksEvaluated.push({
      checkName: 'user_budget_cap',
      ruleId: 'RULE_USER_BUDGET_CAP_01',
      reasonCode: 'USER_BUDGET_CAP_EXCEEDED',
      precedence: 40,
      passed: false,
      details: `Transaction amount ₹${amount} exceeds user intent budget cap ₹${budgetCap}`,
    });
  } else {
    checksEvaluated.push({
      checkName: 'user_budget_cap',
      ruleId: 'RULE_USER_BUDGET_CAP_01',
      reasonCode: 'USER_BUDGET_CAP_SATISFIED',
      precedence: 40,
      passed: true,
      details: `Amount ₹${amount} is within user budget cap ₹${budgetCap || 'unlimited'}`,
    });
  }

  // 2. Merchant Policy Rules Evaluation (Sorted by Precedence: Lower number runs first)
  const activeRules = await PolicyRule.find({ merchant: merchantId, isActive: true })
    .sort({ precedence: 1, createdAt: 1 })
    .lean();

  for (const rule of activeRules) {
    const currentRuleId = rule.ruleId || `RULE_${(rule.ruleType || 'CUSTOM').toUpperCase()}`;
    const rulePrecedence = rule.precedence || 100;

    // Single Spend Cap Check
    if (rule.ruleType === 'max_spend_cap') {
      if (amount > rule.maxAmount) {
        preCheckPassed = false;
        gateDecision = 'BLOCK';
        activeRuleId = activeRuleId || currentRuleId;
        activeReasonCode = activeReasonCode || 'MERCHANT_SPEND_CAP_EXCEEDED';
        failureReason = failureReason || `Amount ₹${amount} exceeds merchant max single transaction cap ₹${rule.maxAmount}`;
        checksEvaluated.push({
          checkName: 'max_spend_cap',
          ruleId: currentRuleId,
          reasonCode: 'MERCHANT_SPEND_CAP_EXCEEDED',
          precedence: rulePrecedence,
          passed: false,
          ruleName: rule.name,
          details: `Amount ₹${amount} exceeds merchant max single transaction cap ₹${rule.maxAmount}`,
        });
      } else {
        checksEvaluated.push({
          checkName: 'max_spend_cap',
          ruleId: currentRuleId,
          reasonCode: 'MERCHANT_SPEND_CAP_SATISFIED',
          precedence: rulePrecedence,
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
        activeRuleId = activeRuleId || currentRuleId;
        activeReasonCode = activeReasonCode || 'CATEGORY_DISALLOWED';
        failureReason = failureReason || `Category '${category}' is not in merchant allowed list`;
        checksEvaluated.push({
          checkName: 'allowed_categories',
          ruleId: currentRuleId,
          reasonCode: 'CATEGORY_DISALLOWED',
          precedence: rulePrecedence,
          passed: false,
          ruleName: rule.name,
          details: `Category '${category}' is not in merchant allowed list`,
        });
      } else {
        checksEvaluated.push({
          checkName: 'allowed_categories',
          ruleId: currentRuleId,
          reasonCode: 'CATEGORY_ALLOWED',
          precedence: rulePrecedence,
          passed: true,
          ruleName: rule.name,
          details: `Category '${category}' allowed`,
        });
      }
    }

    // Manual Approval Threshold Check
    if (rule.ruleType === 'require_manual_approval' && amount > rule.requireApprovalThreshold) {
      if (gateDecision !== 'BLOCK') {
        gateDecision = 'REQUIRE_APPROVAL';
        activeRuleId = activeRuleId || currentRuleId;
        activeReasonCode = activeReasonCode || 'MANUAL_APPROVAL_REQUIRED';
      }
      checksEvaluated.push({
        checkName: 'require_manual_approval',
        ruleId: currentRuleId,
        reasonCode: 'MANUAL_APPROVAL_REQUIRED',
        precedence: rulePrecedence,
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
        activeRuleId = activeRuleId || currentRuleId;
        activeReasonCode = activeReasonCode || 'MERCHANT_DAILY_VELOCITY_EXCEEDED';
        failureReason = failureReason || `Projected 24h spend ₹${projectedSpend} exceeds merchant daily cap ₹${rule.dailyCap}`;
        checksEvaluated.push({
          checkName: 'daily_velocity_limit',
          ruleId: currentRuleId,
          reasonCode: 'MERCHANT_DAILY_VELOCITY_EXCEEDED',
          precedence: rulePrecedence,
          passed: false,
          ruleName: rule.name,
          details: `Projected 24h spend ₹${projectedSpend} exceeds merchant daily cap ₹${rule.dailyCap}`,
        });
      } else {
        checksEvaluated.push({
          checkName: 'daily_velocity_limit',
          ruleId: currentRuleId,
          reasonCode: 'MERCHANT_DAILY_VELOCITY_SATISFIED',
          precedence: rulePrecedence,
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
    ruleId: activeRuleId || (preCheckPassed ? 'POLICY_ALL_PASSED' : 'POLICY_CHECK_FAILED'),
    reasonCode: activeReasonCode || (preCheckPassed ? 'POLICY_SATISFIED' : 'POLICY_VIOLATION'),
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
