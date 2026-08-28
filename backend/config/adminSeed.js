const crypto = require('crypto');
const logger = require('../utils/logger');

// Retrieve admin credentials securely from environment variables only
function getAdminCredentials() {
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || '';
  return { email, password };
}

// Seed/verify admin configuration on startup
function seedAdmin() {
  const { email } = getAdminCredentials();
  if (logger && typeof logger.info === 'function') {
    logger.info(`[AdminSeed] Admin credentials active for: ${email}`);
  } else {
    console.log(`[AdminSeed] Admin credentials active for: ${email}`);
  }
  return { email, status: 'ready' };
}

// Verify given credentials against env-seeded admin credentials
function verifyAdminCredentials(email, password) {
  if (!email || !password) return false;
  const current = getAdminCredentials();
  if (!current.email || !current.password) return false;
  return (
    email.toLowerCase().trim() === current.email &&
    password === current.password
  );
}

// Return sanitized admin profile representation
function getAdminProfile() {
  const { email } = getAdminCredentials();
  return {
    id: 'admin_env_seeded',
    name: 'Platform Administrator',
    email,
    role: 'admin',
    isVerified: true,
  };
}

module.exports = {
  seedAdmin,
  verifyAdminCredentials,
  getAdminProfile,
  getAdminCredentials,
};
