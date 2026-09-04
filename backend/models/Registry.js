const mongoose = require('mongoose');

const registrySchema = new mongoose.Schema(
  {
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: [true, 'Merchant reference is required'],
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    catalogEndpoint: {
      type: String,
      default: '/.well-known/agent-catalog.json',
    },
    policyEndpoint: {
      type: String,
      default: '/.well-known/agent-policy.json',
    },
    apiEndpoint: {
      type: String,
      default: '/api/agent',
    },
    trustScore: {
      type: Number,
      default: 85,
      min: 0,
      max: 100,
    },
    supportedProtocols: {
      type: [String],
      default: ['AP2/CartMandate', 'x402/BaseRPC'],
    },
    isListed: {
      type: Boolean,
      default: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

registrySchema.index({ category: 1, isListed: 1 });
registrySchema.index({ displayName: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Registry', registrySchema);
