const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ['agent', 'merchant', 'policy_engine'],
      required: true,
    },
    proposedPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const negotiationSchema = new mongoose.Schema(
  {
    intent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Intent',
      required: true,
    },
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    agentId: {
      type: String,
      required: true,
      trim: true,
    },
    originalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    proposedPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    discountPercentage: {
      type: Number,
      default: 0,
    },
    rounds: [roundSchema],
    status: {
      type: String,
      enum: ['open', 'accepted', 'rejected', 'expired'],
      default: 'open',
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 60 * 1000), // 30 mins window
    },
  },
  {
    timestamps: true,
  }
);

negotiationSchema.index({ intent: 1, status: 1 });
negotiationSchema.index({ merchant: 1 });

module.exports = mongoose.model('Negotiation', negotiationSchema);
