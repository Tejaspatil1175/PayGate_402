const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['topup', 'debit', 'refund', 'credit'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      default: '',
    },
    referenceId: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'completed',
    },
    balanceAfter: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const walletSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    perTransactionCap: {
      type: Number,
      default: 10000,
      min: 0,
    },
    perDayCap: {
      type: Number,
      default: 50000,
      min: 0,
    },
    dailySpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastSpentResetDate: {
      type: Date,
      default: Date.now,
    },
    ledger: [ledgerEntrySchema],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Wallet', walletSchema);
