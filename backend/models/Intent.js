const mongoose = require('mongoose');

const intentSchema = new mongoose.Schema(
  {
    agentId: {
      type: String,
      required: [true, 'Agent ID is required'],
      trim: true,
    },
    userPublicKey: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    keywords: [
      {
        type: String,
        trim: true,
      },
    ],
    budgetCap: {
      type: Number,
      required: [true, 'Budget cap amount is required'],
      min: [0, 'Budget cap cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    merchantPreferences: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: [
        'submitted',
        'matched',
        'negotiating',
        'contract_created',
        'completed',
        'expired',
        'rejected',
      ],
      default: 'submitted',
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 60 * 60 * 1000), // Default 1 hour expiry
    },
    nonce: {
      type: String,
      trim: true,
      default: '',
    },
    signature: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

intentSchema.index({ agentId: 1, createdAt: -1 });
intentSchema.index({ status: 1 });

module.exports = mongoose.model('Intent', intentSchema);
