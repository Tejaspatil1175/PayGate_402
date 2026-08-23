const {
  generateCommerceContract,
  verifyCommerceContract,
} = require('../services/contract.service');
const Contract = require('../models/Contract');

// @desc    Generate signed commerce contract / AP2 Cart Mandate
// @route   POST /api/agent/contract
exports.createContract = async (req, res) => {
  try {
    const {
      intentId,
      merchantId,
      items,
      agreedAmount,
      userPrivateKey,
      userPublicKey,
      expiresInMinutes,
    } = req.body;

    if (!intentId || !merchantId || !agreedAmount) {
      return res.status(400).json({
        success: false,
        error: 'Please provide intentId, merchantId, and agreedAmount',
      });
    }

    const result = await generateCommerceContract({
      intentId,
      merchantId,
      items: items || [],
      agreedAmount: parseFloat(agreedAmount),
      userPrivateKey,
      userPublicKey,
      expiresInMinutes: parseInt(expiresInMinutes, 10) || 60,
    });

    res.status(201).json({
      protocol: 'AP2/x402',
      success: true,
      message: 'Signed commerce contract generated successfully',
      contract: result.contract,
      publicKey: result.keys.publicKey,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Verify contract RSA-PSS digital signature & mandate hash
// @route   POST /api/agent/contract/:id/verify
exports.verifyContract = async (req, res) => {
  try {
    const result = await verifyCommerceContract(req.params.id);

    if (!result.isValid) {
      return res.status(400).json({
        protocol: 'AP2/x402',
        success: false,
        gateDecision: 'BLOCK',
        error: result.reason,
        contract: result.contract,
      });
    }

    res.status(200).json({
      protocol: 'AP2/x402',
      success: true,
      gateDecision: 'ALLOW',
      message: result.reason,
      contract: result.contract,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get contract details by ID
// @route   GET /api/agent/contract/:id
exports.getContractDetails = async (req, res) => {
  try {
    const contract = await Contract.findOne({
      $or: [{ _id: req.params.id }, { contractId: req.params.id }],
    })
      .populate('intent')
      .populate('merchant', 'businessName email phone');

    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found',
      });
    }

    res.status(200).json({
      protocol: 'AP2/x402',
      success: true,
      contract,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Perform real-time policy pre-check before contract creation
// @route   POST /api/agent/contract/precheck
exports.preCheckPolicy = async (req, res) => {
  try {
    const { performPolicyPreCheck } = require('../services/policyPreCheck.service');
    const { merchantId, agentId, amount, category, budgetCap } = req.body;

    if (!merchantId || amount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'merchantId and amount are required for policy pre-check',
      });
    }

    const result = await performPolicyPreCheck({
      merchantId,
      agentId: agentId || req.headers['x-agent-id'],
      amount: parseFloat(amount),
      category,
      budgetCap: budgetCap ? parseFloat(budgetCap) : undefined,
    });

    const statusCode = result.preCheckPassed ? 200 : 402;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

