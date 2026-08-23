const mongoose = require('mongoose');

const contractItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const contractSchema = new mongoose.Schema(
  {
    contractId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
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
    negotiation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Negotiation',
    },
    agentId: {
      type: String,
      required: true,
      trim: true,
    },
    userPublicKey: {
      type: String,
      required: true,
      trim: true,
    },
    merchantPublicKey: {
      type: String,
      trim: true,
      default: '',
    },
    items: [contractItemSchema],
    contractTerms: {
      agreedAmount: {
        type: Number,
        required: true,
        min: 0,
      },
      currency: {
        type: String,
        default: 'INR',
        uppercase: true,
      },
      spendCap: {
        type: Number,
        required: true,
      },
      merchantCategory: {
        type: String,
        default: 'General',
      },
    },
    mandateHash: {
      type: String,
      required: true,
      trim: true,
    },
    userSignature: {
      type: String,
      required: true,
      trim: true,
    },
    merchantSignature: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'signed', 'verified', 'executed', 'expired', 'invalidated'],
      default: 'signed',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

contractSchema.index({ contractId: 1 });
contractSchema.index({ mandateHash: 1 });
contractSchema.index({ intent: 1 });
contractSchema.index({ merchant: 1, status: 1 });

module.exports = mongoose.model('Contract', contractSchema);
