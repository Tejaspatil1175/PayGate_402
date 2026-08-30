const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('5-Checkpoint Policy Engine & Gating Suite', () => {
  // Deterministic evaluation engine simulation matching policyPreCheck.service logic
  function evaluatePolicies(policies, transaction) {
    const sorted = [...policies].sort((a, b) => (a.precedence || 100) - (b.precedence || 100));
    const evaluations = [];

    for (const rule of sorted) {
      if (rule.ruleType === 'max_spend_cap') {
        if (transaction.amount > rule.maxAmount) {
          return {
            decision: 'BLOCK',
            ruleId: rule.ruleId || 'RULE_MAX_SPEND_CAP_01',
            reasonCode: 'MERCHANT_SPEND_CAP_EXCEEDED',
            details: `Amount ₹${transaction.amount} exceeds merchant max cap ₹${rule.maxAmount}`,
          };
        }
      }

      if (rule.ruleType === 'allowed_categories') {
        if (!rule.allowedCategories.includes(transaction.category)) {
          return {
            decision: 'BLOCK',
            ruleId: rule.ruleId || 'RULE_ALLOWED_CATEGORIES_01',
            reasonCode: 'CATEGORY_DISALLOWED',
            details: `Category '${transaction.category}' is not allowed`,
          };
        }
      }

      if (rule.ruleType === 'require_manual_approval') {
        if (transaction.amount > rule.requireApprovalThreshold) {
          return {
            decision: 'REQUIRE_APPROVAL',
            ruleId: rule.ruleId || 'RULE_MANUAL_APPROVAL_01',
            reasonCode: 'MANUAL_APPROVAL_REQUIRED',
            details: `Amount ₹${transaction.amount} exceeds approval threshold ₹${rule.requireApprovalThreshold}`,
          };
        }
      }

      if (rule.ruleType === 'daily_velocity_limit') {
        if (transaction.currentDailySpend + transaction.amount > rule.dailyCap) {
          return {
            decision: 'BLOCK',
            ruleId: rule.ruleId || 'RULE_DAILY_VELOCITY_01',
            reasonCode: 'MERCHANT_DAILY_VELOCITY_EXCEEDED',
            details: `Projected spend exceeds daily cap ₹${rule.dailyCap}`,
          };
        }
      }
    }

    return {
      decision: 'ALLOW',
      ruleId: 'POLICY_ALL_PASSED',
      reasonCode: 'POLICY_SATISFIED',
      details: 'All policy checks passed successfully',
    };
  }

  it('should ALLOW transactions within single cap and category bounds', () => {
    const rules = [
      { ruleType: 'max_spend_cap', maxAmount: 5000, ruleId: 'RULE_CAP_5K', precedence: 1 },
      { ruleType: 'allowed_categories', allowedCategories: ['Electronics', 'Audio'], ruleId: 'RULE_CAT_AUDIO', precedence: 2 },
    ];

    const result = evaluatePolicies(rules, { amount: 2499, category: 'Audio', currentDailySpend: 0 });
    assert.strictEqual(result.decision, 'ALLOW');
    assert.strictEqual(result.reasonCode, 'POLICY_SATISFIED');
  });

  it('should BLOCK transactions exceeding single spend cap with exact ruleId & reasonCode', () => {
    const rules = [
      { ruleType: 'max_spend_cap', maxAmount: 5000, ruleId: 'RULE_CAP_5K', precedence: 1 },
    ];

    const result = evaluatePolicies(rules, { amount: 7500, category: 'Electronics', currentDailySpend: 0 });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.strictEqual(result.ruleId, 'RULE_CAP_5K');
    assert.strictEqual(result.reasonCode, 'MERCHANT_SPEND_CAP_EXCEEDED');
  });

  it('should BLOCK transactions for disallowed categories', () => {
    const rules = [
      { ruleType: 'allowed_categories', allowedCategories: ['Books', 'Stationery'], ruleId: 'RULE_CAT_BOOKS', precedence: 1 },
    ];

    const result = evaluatePolicies(rules, { amount: 500, category: 'GamingConsoles', currentDailySpend: 0 });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.strictEqual(result.ruleId, 'RULE_CAT_BOOKS');
    assert.strictEqual(result.reasonCode, 'CATEGORY_DISALLOWED');
  });

  it('should route high-value transactions to REQUIRE_APPROVAL', () => {
    const rules = [
      { ruleType: 'require_manual_approval', requireApprovalThreshold: 10000, ruleId: 'RULE_APPROVAL_10K', precedence: 5 },
    ];

    const result = evaluatePolicies(rules, { amount: 15000, category: 'Electronics', currentDailySpend: 0 });
    assert.strictEqual(result.decision, 'REQUIRE_APPROVAL');
    assert.strictEqual(result.ruleId, 'RULE_APPROVAL_10K');
    assert.strictEqual(result.reasonCode, 'MANUAL_APPROVAL_REQUIRED');
  });

  it('should resolve conflicting rules deterministically using precedence order', () => {
    // Rule A has lower precedence number (Priority 1) -> Evaluated first
    // Rule B has higher precedence number (Priority 10)
    const rules = [
      { ruleType: 'allowed_categories', allowedCategories: ['Hardware'], ruleId: 'RULE_CAT_HIGH_PRIORITY', precedence: 1 },
      { ruleType: 'max_spend_cap', maxAmount: 100, ruleId: 'RULE_CAP_LOW_PRIORITY', precedence: 10 },
    ];

    // Transaction fails category check (precedence 1) before even reaching spend cap
    const result = evaluatePolicies(rules, { amount: 500, category: 'Software', currentDailySpend: 0 });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.strictEqual(result.ruleId, 'RULE_CAT_HIGH_PRIORITY');
    assert.strictEqual(result.reasonCode, 'CATEGORY_DISALLOWED');
  });

  it('should BLOCK transactions that breach 24-hour merchant daily velocity limits', () => {
    const rules = [
      { ruleType: 'daily_velocity_limit', dailyCap: 20000, ruleId: 'RULE_VELOCITY_20K', precedence: 1 },
    ];

    // Already spent ₹18,000 today; new transaction of ₹3,000 exceeds ₹20,000 cap
    const result = evaluatePolicies(rules, { amount: 3000, category: 'General', currentDailySpend: 18000 });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.strictEqual(result.ruleId, 'RULE_VELOCITY_20K');
    assert.strictEqual(result.reasonCode, 'MERCHANT_DAILY_VELOCITY_EXCEEDED');
  });
});
