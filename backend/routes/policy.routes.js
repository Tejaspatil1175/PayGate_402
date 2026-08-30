const express = require('express');
const router = express.Router();
const PolicyRule = require('../models/PolicyRule');
const logger = require('../utils/logger');

// Helper to extract merchant ID
function getMerchantId(req) {
  let merchantId = req.query.merchantId || req.body.merchantId || req.body.merchant || req.headers['x-merchant-id'];
  if (!merchantId && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];
    if (token && token.length === 24) {
      merchantId = token;
    }
  }
  return merchantId;
}

// GET /api/policy — Fetch merchant policy rules (sorted by precedence)
router.get('/', async (req, res, next) => {
  try {
    const merchantId = getMerchantId(req);
    const filter = {};
    if (merchantId) {
      filter.merchant = merchantId;
    }

    const rules = await PolicyRule.find(filter).sort({ precedence: 1, createdAt: -1 });
    res.status(200).json({
      success: true,
      count: rules.length,
      rules,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/policy — Create a new policy rule
router.post('/', async (req, res, next) => {
  try {
    const merchantId = getMerchantId(req);
    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: 'Merchant ID is required to create a policy rule',
      });
    }

    const {
      name,
      description,
      ruleType,
      ruleId,
      precedence,
      reasonCode,
      maxAmount,
      dailyCap,
      requireApprovalThreshold,
      allowedCategories,
      autoAcceptDiscountPercent,
      maxAllowedDiscountPercent,
      isActive,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Policy rule name is required',
      });
    }

    const newRule = await PolicyRule.create({
      merchant: merchantId,
      name,
      description: description || '',
      ruleType: ruleType || 'max_spend_cap',
      ruleId: ruleId || '',
      precedence: precedence !== undefined ? Number(precedence) : 100,
      reasonCode: reasonCode || '',
      maxAmount: maxAmount !== undefined ? Number(maxAmount) : 5000,
      dailyCap: dailyCap !== undefined ? Number(dailyCap) : 25000,
      requireApprovalThreshold:
        requireApprovalThreshold !== undefined ? Number(requireApprovalThreshold) : 10000,
      autoAcceptDiscountPercent:
        autoAcceptDiscountPercent !== undefined ? Number(autoAcceptDiscountPercent) : 10,
      maxAllowedDiscountPercent:
        maxAllowedDiscountPercent !== undefined ? Number(maxAllowedDiscountPercent) : 25,
      allowedCategories: allowedCategories || [],
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    logger.info(`[POLICY_RULE_CREATED] Rule "${newRule.name}" (${newRule.ruleId}, precedence: ${newRule.precedence}) created for merchant ${merchantId}`);

    res.status(201).json({
      success: true,
      rule: newRule,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/policy/:id — Get specific rule
router.get('/:id', async (req, res, next) => {
  try {
    const rule = await PolicyRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Policy rule not found',
      });
    }
    res.status(200).json({
      success: true,
      rule,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/policy/:id — Update policy rule
router.put('/:id', async (req, res, next) => {
  try {
    const updated = await PolicyRule.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Policy rule not found',
      });
    }

    logger.info(`[POLICY_RULE_UPDATED] Rule ${req.params.id} updated`);
    res.status(200).json({
      success: true,
      rule: updated,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/policy/:id/toggle — Toggle rule active status
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const rule = await PolicyRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Policy rule not found',
      });
    }

    rule.isActive = !rule.isActive;
    await rule.save();

    logger.info(`[POLICY_RULE_TOGGLED] Rule ${rule._id} set isActive=${rule.isActive}`);
    res.status(200).json({
      success: true,
      rule,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/policy/:id — Delete rule
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await PolicyRule.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Policy rule not found',
      });
    }

    logger.info(`[POLICY_RULE_DELETED] Rule ${req.params.id} deleted`);
    res.status(200).json({
      success: true,
      message: 'Policy rule deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
