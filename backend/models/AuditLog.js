const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
    },
    correlationId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    agentId: {
      type: String,
      trim: true,
      default: 'agent_anonymous',
    },
    mandateHash: {
      type: String,
      trim: true,
      default: '',
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
    action: {
      type: String,
      required: true,
      trim: true,
    },
    decision: {
      type: String,
      enum: ['ALLOW', 'BLOCK', 'PENDING', 'PAYOUT_HOLD', 'REQUIRE_APPROVAL'],
      default: 'ALLOW',
    },
    ruleId: {
      type: String,
      trim: true,
      default: '',
    },
    reasonCode: {
      type: String,
      trim: true,
      default: '',
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    ipAddress: {
      type: String,
      trim: true,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    executionTimeMs: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ merchant: 1, createdAt: -1 });
auditLogSchema.index({ mandateHash: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
