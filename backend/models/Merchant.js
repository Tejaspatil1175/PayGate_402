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
    logoUrl: {
      type: String,
      trim: true,
      default: '',
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

const { encryptText, decryptText, minimizePII } = require('../utils/encryption');

// Pre-save hook to encrypt sensitive credentials / PII fields using AES-256
merchantSchema.pre('save', function (next) {
  if (this.isModified('razorpayKeySecret') && this.razorpayKeySecret && !this.razorpayKeySecret.includes(':')) {
    this.razorpayKeySecret = encryptText(this.razorpayKeySecret);
  }
  if (this.isModified('panNumber') && this.panNumber && !this.panNumber.includes(':')) {
    this.panNumber = encryptText(this.panNumber);
  }
  next();
});

// Decrypt razorpayKeySecret for authorized internal server operations
merchantSchema.methods.getDecryptedKeySecret = function () {
  return decryptText(this.razorpayKeySecret);
};

// Decrypt panNumber for KYC verification operations
merchantSchema.methods.getDecryptedPanNumber = function () {
  return decryptText(this.panNumber);
};

// Return PII-minimized sanitized JSON representation
merchantSchema.methods.toMinimizedJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.razorpayKeySecret;
  delete obj.razorpayWebhookSecret;
  return minimizePII(obj);
};

module.exports = mongoose.model('Merchant', merchantSchema);

