const crypto = require('crypto');
const User = require('../models/User');

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

// @desc    Register new end-user (buyer)
// @route   POST /api/user/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, publicKey } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name, email, and password',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    const hashedPassword = hashPassword(password);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      publicKey: publicKey ? publicKey.trim() : '',
    });

    const userData = user.toObject();
    delete userData.password;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: userData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Login end-user (buyer)
// @route   POST /api/user/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    const isMatch = verifyPassword(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    const userData = user.toObject();
    delete userData.password;

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      user: userData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/user/auth/me
exports.getProfile = async (req, res) => {
  try {
    const userId = req.query.id || req.headers['x-user-id'];

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID required',
      });
    }

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Save/update user public key
// @route   POST /api/user/auth/keys
exports.updatePublicKey = async (req, res) => {
  try {
    const { userId, publicKey } = req.body;
    const targetId = userId || req.headers['x-user-id'];

    if (!targetId || !publicKey) {
      return res.status(400).json({
        success: false,
        error: 'User ID and publicKey are required',
      });
    }

    const user = await User.findByIdAndUpdate(
      targetId,
      { publicKey: publicKey.trim() },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Public key updated successfully',
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
