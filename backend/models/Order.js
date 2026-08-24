const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    title: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    variant: {
      name: String,
      option: String,
    },
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: [true, 'Merchant reference is required'],
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      default: '',
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      default: '',
    },
    mandateHash: {
      type: String,
      trim: true,
      default: '',
    },
    agentId: {
      type: String,
      trim: true,
      default: 'agent_anonymous',
    },
    items: [orderItemSchema],
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['pending', 'created', 'paid', 'failed', 'fulfilled', 'cancelled'],
      default: 'created',
    },
    customer: {
      name: String,
      email: String,
      phone: String,
      shippingAddress: String,
    },
    gateDecision: {
      passed: { type: Boolean, default: true },
      reason: { type: String, default: 'PASSED' },
      evaluatedAt: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ merchant: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

const { minimizePII } = require('../utils/encryption');

// Return PII-minimized sanitized JSON representation of Order
orderSchema.methods.toMinimizedJSON = function () {
  const obj = this.toObject();
  return minimizePII(obj);
};

module.exports = mongoose.model('Order', orderSchema);

