const { verifyCommerceContract } = require('../services/contract.service');
const { createRazorpayOrder, fetchRazorpayOrder } = require('../services/razorpay.service');
const Order = require('../models/Order');
const { PolicyViolationError, AppError } = require('../middleware/errorHandler');
const { logAuditEvent } = require('../middleware/auditLogger');
const { generateNonce } = require('../utils/crypto');

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
