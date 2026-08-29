const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema(
  {
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: [true, 'Merchant reference is required'],
    },
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    discountPercent: {
      type: Number,
      required: [true, 'Discount percentage is required'],
      min: 1,
      max: 100,
      default: 15,
    },
    minQuantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
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

campaignSchema.index({ merchant: 1, isActive: 1, minQuantity: 1 });

module.exports = mongoose.model('Campaign', campaignSchema);
