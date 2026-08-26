const fs = require('fs');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;
const Merchant = require('../models/Merchant');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

// @desc    Register new merchant
// @route   POST /api/merchant/auth/register
exports.register = async (req, res) => {
  try {
    const {
      businessName,
      email,
      phone,
      password,
      businessCategory,
      razorpayKeyId,
      razorpayKeySecret,
      razorpayWebhookSecret,
      panNumber,
      gstin,
    } = req.body;

    if (!businessName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide businessName, email, phone, and password',
      });
    }

    const existingMerchant = await Merchant.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }],
    });

    if (existingMerchant) {
      return res.status(400).json({
        success: false,
        error: 'Merchant with this email or phone already exists',
      });
    }

    let logoUrl = req.body.logoUrl || '';
    if (req.file) {
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: 'paygate402/merchants',
        });
        logoUrl = uploadResult.secure_url;
        fs.unlink(req.file.path, () => {});
      } catch (uploadErr) {
        console.error('Merchant logo upload error:', uploadErr);
      }
    }

    const hashedPassword = hashPassword(password);

    const merchant = await Merchant.create({
      businessName,
      email,
      phone,
      password: hashedPassword,
      businessCategory: businessCategory || 'General',
      logoUrl,
      razorpayKeyId: razorpayKeyId || '',
      razorpayKeySecret: razorpayKeySecret || '',
      razorpayWebhookSecret: razorpayWebhookSecret || '',
      panNumber: panNumber || '',
      gstin: gstin || '',
      isVerified: true,
      kycStatus: 'verified',
    });

    const merchantData = merchant.toObject();
    delete merchantData.password;

    res.status(201).json({
      success: true,
      message: 'Merchant registered successfully',
      merchant: merchantData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Login merchant
// @route   POST /api/merchant/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password',
      });
    }

    const merchant = await Merchant.findOne({ email: email.toLowerCase() });

    if (!merchant) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    const isMatch = verifyPassword(password, merchant.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    const merchantData = merchant.toObject();
    delete merchantData.password;

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      merchant: merchantData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get current merchant profile
// @route   GET /api/merchant/auth/me
exports.getProfile = async (req, res) => {
  try {
    const merchantId = req.query.id || req.headers['x-merchant-id'];

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: 'Merchant ID required',
      });
    }

    const merchant = await Merchant.findById(merchantId).select('-password');

    if (!merchant) {
      return res.status(404).json({
        success: false,
        error: 'Merchant not found',
      });
    }

    res.status(200).json({
      success: true,
      merchant,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
