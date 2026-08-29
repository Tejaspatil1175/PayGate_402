const mongoose = require('mongoose');

const policyRuleSchema = new mongoose.Schema(
  {
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: [true, 'Merchant reference is required'],
    },
    name: {
      type: String,
      required: [true, 'Policy rule name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    ruleType: {
      type: String,
      enum: [
        'max_spend_cap',
        'daily_velocity_limit',
        'allowed_categories',
        'require_manual_approval',
        'business_hours',
      ],
      required: true,
      default: 'max_spend_cap',
    },
    maxAmount: {
      type: Number,
      default: 5000, // Default max ₹5,000 per order
      min: 0,
    },
    dailyCap: {
      type: Number,
      default: 25000, // Default max ₹25,000 per 24 hours
      min: 0,
    },
    allowedCategories: [
      {
        type: String,
        trim: true,
      },
    ],
    requireApprovalThreshold: {
      type: Number,
      default: 10000, // Orders above ₹10,000 require manual approval
      min: 0,
    },
    autoAcceptDiscountPercent: {
      type: Number,
      default: 10, // Max discount percentage automatically accepted by policy engine
      min: 0,
      max: 100,
    },
    maxAllowedDiscountPercent: {
      type: Number,
      default: 25, // Absolute maximum discount percentage before auto-reject
      min: 0,
      max: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

policyRuleSchema.index({ merchant: 1, isActive: 1 });

module.exports = mongoose.model('PolicyRule', policyRuleSchema);
