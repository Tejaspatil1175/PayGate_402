const mongoose = require('mongoose');
const { minimizePII } = require('../utils/encryption');

const userPersonaSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    pricePreference: {
      type: String,
      enum: ['budget', 'mid_range', 'premium', 'neutral'],
      default: 'neutral',
    },
    preferredCategories: [
      {
        type: String,
        trim: true,
      },
    ],
    preferredBrands: [
      {
        type: String,
        trim: true,
      },
    ],
    avgOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalOrdersEvaluated: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastInferredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Return sanitized PII-minimized representation
userPersonaSchema.methods.toMinimizedJSON = function () {
  const obj = this.toObject();
  return minimizePII(obj);
};

module.exports = mongoose.model('UserPersona', userPersonaSchema);
