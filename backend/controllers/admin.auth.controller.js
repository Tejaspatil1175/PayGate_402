const { verifyAdminCredentials, getAdminProfile } = require('../config/adminSeed');

// @desc    Admin login (against env-seeded credentials)
// @route   POST /api/admin/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide admin email and password',
      });
    }

    const isValid = verifyAdminCredentials(email, password);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid admin credentials',
      });
    }

    const adminProfile = getAdminProfile();

    res.status(200).json({
      success: true,
      message: 'Admin logged in successfully',
      admin: adminProfile,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get admin profile
// @route   GET /api/admin/auth/me
exports.getProfile = async (req, res) => {
  try {
    const adminProfile = getAdminProfile();
    res.status(200).json({
      success: true,
      admin: adminProfile,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
