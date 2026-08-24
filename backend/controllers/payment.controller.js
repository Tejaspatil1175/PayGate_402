const { verifyCommerceContract } = require('../services/contract.service');
const { createRazorpayOrder, fetchRazorpayOrder } = require('../services/razorpay.service');
const Order = require('../models/Order');
const { PolicyViolationError, AppError } = require('../middleware/errorHandler');
const { logAuditEvent } = require('../middleware/auditLogger');
const { generateNonce } = require('../utils/crypto');
const { checkTransactionGuardrails } = require('../middleware/transactionGuardrails');
const { evaluateGatedAction } = require('../middleware/gatedActions');
const { evaluateFraudRisk } = require('../services/fraud.service');
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

    // 2. Execute Razorpay Order creation
    const razorpayOrder = await createRazorpayOrder({

      amount: contract.contractTerms.agreedAmount,
      currency: contract.contractTerms.currency || 'INR',
      receipt: `rcpt_${contract.contractId}`,
      notes: {
        contractId: contract.contractId,
        mandateHash: contract.mandateHash,
        agentId: contract.agentId,
      },
    });

    // 3. Store Order in MongoDB Audit Ledger
    const orderData = {
      merchant: contract.merchant,
      orderId: `ord_${generateNonce().substring(0, 12)}`,
      razorpayOrderId: razorpayOrder.id,
      mandateHash: contract.mandateHash,
      agentId: contract.agentId,
      items: contract.items,
      amount: contract.contractTerms.agreedAmount,
      currency: contract.contractTerms.currency || 'INR',
      status: 'created',
      customer: customer || {},
      gateDecision: {
        passed: true,
        reason: 'AP2 Cart Mandate verified. Gate opened. Razorpay order created.',
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
      razorpayOrderId: razorpayOrder.id,
      action: 'PAYMENT_EXECUTED',
      decision: 'ALLOW',
      reason: `Gate opened. Created Razorpay order ${razorpayOrder.id} for ₹${contract.contractTerms.agreedAmount}`,
      metadata: {
        orderId: orderDoc.orderId,
        razorpayOrderId: razorpayOrder.id,
        amount: contract.contractTerms.agreedAmount,
      },
    });

    res.status(201).json({
      protocol: 'AP2/x402',
      success: true,
      gateDecision: 'ALLOW',
      message: 'Payment execution authorized. Razorpay order created.',
      paymentDetails: {
        orderId: orderDoc.orderId,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount, // in paise
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        receipt: razorpayOrder.receipt,
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
