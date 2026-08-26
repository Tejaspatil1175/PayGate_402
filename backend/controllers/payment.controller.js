const { verifyCommerceContract } = require('../services/contract.service');
const { createRazorpayOrder, fetchRazorpayOrder } = require('../services/razorpay.service');
const Order = require('../models/Order');
const { PolicyViolationError, AppError } = require('../middleware/errorHandler');
const { logAuditEvent } = require('../middleware/auditLogger');
const { generateNonce } = require('../utils/crypto');
const { checkTransactionGuardrails } = require('../middleware/transactionGuardrails');
const { evaluateGatedAction } = require('../middleware/gatedActions');
const { evaluateFraudRisk } = require('../services/fraud.service');
const { performPolicyPreCheck } = require('../services/policyPreCheck.service');
const logger = require('../utils/logger');

// @desc    Execute payment for a verified AP2 contract / Cart Mandate
// @route   POST /api/agent/payment/execute
exports.executePayment = async (req, res, next) => {
  try {
    const { contractId, customer } = req.body;

    if (!contractId) {
      return next(new PolicyViolationError('Contract ID is required to execute payment'));
    }

    // 1. Verify contract digital signature and validity
    const verification = await verifyCommerceContract(contractId);

    if (!verification.isValid) {
      logger.warn(`[SECURITY_GATE_REJECTED] Contract verification failed for contract ${contractId}: ${verification.reason}`);
      return next(new PolicyViolationError(verification.reason, { contractId }));
    }

    const contract = verification.contract;

    // Check if an order was already created for this contract
    let existingOrder = await Order.findOne({ mandateHash: contract.mandateHash });
    if (existingOrder && existingOrder.status === 'paid') {
      return res.status(200).json({
        protocol: 'AP2/x402',
        success: true,
        message: 'Payment already completed for this contract mandate',
        order: existingOrder,
      });
    }

    // 1b. Execute Security Gates: Guardrails, Gated Actions, Fraud Risk Scoring
    const amount = contract.contractTerms.agreedAmount;
    const agentId = contract.agentId;
    const merchantId = contract.merchant;

    // Gate A: Bounded Transactions & Velocity Checks
    const guardrailRes = await checkTransactionGuardrails({ agentId, amount, merchantId });
    if (!guardrailRes.passed) {
      logger.warn(`[SECURITY_GATE_REJECTED] Transaction guardrails rejected payment for contract ${contract.contractId}: ${guardrailRes.reason}`);
      await logAuditEvent({
        correlationId: contract.mandateHash,
        agentId,
        merchant: merchantId,
        action: 'PAYMENT_SECURITY_GATE_BLOCKED',
        decision: 'BLOCK',
        reason: `[SECURITY_GATE_REJECTED] ${guardrailRes.reason}`,
      });
      return next(new AppError(`[SECURITY_GATE_REJECTED] ${guardrailRes.reason}`, 400, 'BLOCK'));
    }

    // Gate B: Manual Approval Thresholds & First-Time Buyer Checks
    const gatedRes = await evaluateGatedAction({
      agentId,
      amount,
      merchantId,
      customerEmail: customer?.email,
      customerPhone: customer?.phone,
    });
    if (gatedRes.decision !== 'ALLOW' || gatedRes.requireManualApproval) {
      logger.warn(`[SECURITY_GATE_REJECTED] Gated action check rejected payment for contract ${contract.contractId}: ${gatedRes.reason}`);
      await logAuditEvent({
        correlationId: contract.mandateHash,
        agentId,
        merchant: merchantId,
        action: 'PAYMENT_SECURITY_GATE_BLOCKED',
        decision: gatedRes.decision || 'REQUIRE_APPROVAL',
        reason: `[SECURITY_GATE_REJECTED] ${gatedRes.reason}`,
      });
      return next(new AppError(`[SECURITY_GATE_REJECTED] ${gatedRes.reason}`, 403, gatedRes.decision));
    }

    // Gate B2: Real-time Policy Pre-Check (Wallet Balance, Caps & Merchant Rules)
    const targetUserId = req.body.userId || req.headers['x-user-id'] || customer?.id || contract.userId;

    const policyPreCheckRes = await performPolicyPreCheck({
      merchantId,
      agentId,
      amount,
      category: contract.items?.[0]?.category || 'General',
      budgetCap: amount,
      userId: targetUserId,
    });

    if (!policyPreCheckRes.preCheckPassed) {
      logger.warn(`[SECURITY_GATE_REJECTED] Policy pre-check rejected payment for contract ${contract.contractId}: ${policyPreCheckRes.reason}`);
      await logAuditEvent({
        correlationId: contract.mandateHash,
        agentId,
        merchant: merchantId,
        action: 'PAYMENT_SECURITY_GATE_BLOCKED',
        decision: 'BLOCK',
        reason: `[SECURITY_GATE_REJECTED] ${policyPreCheckRes.reason}`,
      });
      return next(new AppError(`[SECURITY_GATE_REJECTED] ${policyPreCheckRes.reason}`, 400, 'BLOCK'));
    }

    if (policyPreCheckRes.gateDecision === 'REQUIRE_APPROVAL') {
      logger.warn(`[SECURITY_GATE_REJECTED] Policy pre-check requires manual approval for contract ${contract.contractId}: ${policyPreCheckRes.reason}`);
      await logAuditEvent({
        correlationId: contract.mandateHash,
        agentId,
        merchant: merchantId,
        action: 'PAYMENT_SECURITY_GATE_BLOCKED',
        decision: 'REQUIRE_APPROVAL',
        reason: `[SECURITY_GATE_REJECTED] ${policyPreCheckRes.reason}`,
      });
      return next(new AppError(`[SECURITY_GATE_REJECTED] ${policyPreCheckRes.reason}`, 403, 'REQUIRE_APPROVAL'));
    }

    // Gate C: Anomaly Detection & Fraud Scoring
    const fraudRes = await evaluateFraudRisk({
      orderId: contract.contractId,
      merchantId,
      agentId,
      amount,
      customer,
      ipAddress: req.ip || req.connection?.remoteAddress || '',
    });
    if (fraudRes.payoutHold || fraudRes.riskScore >= 70 || fraudRes.action === 'BLOCK' || fraudRes.action === 'PAYOUT_HOLD') {
      logger.warn(`[SECURITY_GATE_REJECTED] Fraud risk scoring (score ${fraudRes.riskScore}) rejected payment for contract ${contract.contractId}: ${fraudRes.decisionReason}`);
      await logAuditEvent({
        correlationId: contract.mandateHash,
        agentId,
        merchant: merchantId,
        action: 'PAYMENT_SECURITY_GATE_BLOCKED',
        decision: 'PAYOUT_HOLD',
        reason: `[SECURITY_GATE_REJECTED] Fraud score ${fraudRes.riskScore} exceeds safety threshold: ${fraudRes.decisionReason}`,
      });
      return next(new AppError(`[SECURITY_GATE_REJECTED] ${fraudRes.decisionReason}`, 403, 'PAYOUT_HOLD'));
    }

    // 2. Execute Wallet Debit (internal agent settlement)
    if (!targetUserId) {
      return next(new AppError('User ID is required to execute wallet payment', 400));
    }

    const walletService = require('../services/wallet.service');
    const debitedWallet = await walletService.debitWallet(
      targetUserId,
      amount,
      contract.contractId,
      `Agent Commerce Purchase for contract ${contract.contractId}`
    );

    // 3. Store Order in MongoDB Audit Ledger with status 'paid'
    const orderData = {
      merchant: contract.merchant,
      orderId: `ord_${generateNonce().substring(0, 12)}`,
      razorpayOrderId: `wallet_${generateNonce().substring(0, 12)}`,
      mandateHash: contract.mandateHash,
      agentId: contract.agentId,
      items: contract.items,
      amount: contract.contractTerms.agreedAmount,
      currency: contract.contractTerms.currency || 'INR',
      status: 'paid',
      customer: customer || {},
      gateDecision: {
        passed: true,
        reason: 'AP2 Cart Mandate verified. Internal wallet debited. Order paid.',
      },
    };

    const orderDoc = existingOrder
      ? await Order.findByIdAndUpdate(existingOrder._id, orderData, { new: true })
      : await Order.create(orderData);

    contract.status = 'executed';
    await contract.save();

    await logAuditEvent({
      correlationId: contract.mandateHash,
      agentId: contract.agentId,
      merchant: contract.merchant,
      mandateHash: contract.mandateHash,
      razorpayOrderId: orderDoc.razorpayOrderId,
      action: 'PAYMENT_EXECUTED',
      decision: 'ALLOW',
      reason: `Gate opened. Debited wallet for ₹${contract.contractTerms.agreedAmount}`,
      metadata: {
        orderId: orderDoc.orderId,
        amount: contract.contractTerms.agreedAmount,
        walletBalance: debitedWallet.balance,
      },
    });

    res.status(201).json({
      protocol: 'AP2/x402',
      success: true,
      gateDecision: 'ALLOW',
      message: 'Payment execution authorized. Wallet debited successfully.',
      paymentDetails: {
        orderId: orderDoc.orderId,
        amount: contract.contractTerms.agreedAmount,
        currency: contract.contractTerms.currency || 'INR',
        paymentMethod: 'wallet',
        walletBalance: debitedWallet.balance,
        mandateHash: contract.mandateHash,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get status of payment execution
// @route   GET /api/agent/payment/:id/status
exports.getPaymentStatus = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      $or: [
        { _id: req.params.id },
        { orderId: req.params.id },
        { razorpayOrderId: req.params.id },
        { mandateHash: req.params.id },
      ],
    }).populate('merchant', 'businessName');

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    res.status(200).json({
      protocol: 'AP2/x402',
      success: true,
      status: order.status,
      order,
    });
  } catch (error) {
    next(error);
  }
};
