const mongoose = require('mongoose');

const merchantSchema = new mongoose.Schema(
  {
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
    },
    businessCategory: {
      type: String,
      trim: true,
      default: 'General',
    },
    // Razorpay API Credentials Reference
    razorpayKeyId: {
      type: String,
      trim: true,
      default: '',
    },
    razorpayKeySecret: {
      type: String,
      trim: true,
      default: '',
    },
    razorpayWebhookSecret: {
      type: String,
      trim: true,
      default: '',
    },
    // KYC-lite fields
    kycStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    // Auth fields (Password based)
    password: {
      type: String,
      required: [true, 'Password is required'],
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

module.exports = mongoose.model('Merchant', merchantSchema);
