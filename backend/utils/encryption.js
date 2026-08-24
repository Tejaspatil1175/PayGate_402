const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_SECRET = process.env.ENCRYPTION_SECRET || 'paygate402_aes256_gcm_secret_key_32_bytes!';

/**
 * Derive 32-byte key from secret string using SHA-256
 * @param {string} [secret]
 * @returns {Buffer}
 */
function getDerivedKey(secret = DEFAULT_SECRET) {
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a text string using AES-256-GCM
 * @param {string} plainText
 * @param {string} [secretKey]
 * @returns {string} Formatted as `iv_hex:authTag_hex:encrypted_hex`
 */
function encryptText(plainText, secretKey = DEFAULT_SECRET) {
  if (!plainText || typeof plainText !== 'string') {
    return plainText;
  }

  const key = getDerivedKey(secretKey);
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string
 * @param {string} cipherText - `iv_hex:authTag_hex:encrypted_hex`
 * @param {string} [secretKey]
 * @returns {string} Decrypted plain text
 */
function decryptText(cipherText, secretKey = DEFAULT_SECRET) {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.includes(':')) {
    return cipherText;
  }

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return cipherText;

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getDerivedKey(secretKey);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // Return original string if decryption fails (e.g. unencrypted string)
    return cipherText;
  }
}

/**
 * Mask email address for PII minimization
 * @param {string} email
 * @returns {string} e.g., j***e@domain.com
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return '***@***.com';
  }
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}*@${domain}`;
  }
  return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
}

/**
 * Mask phone number for PII minimization
 * @param {string} phone
 * @returns {string} e.g., +91******3210
 */
function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return '**********';
  }
  const cleanPhone = phone.trim();
  if (cleanPhone.length <= 4) {
    return '****';
  }
  const visibleTail = cleanPhone.slice(-4);
  const prefix = cleanPhone.slice(0, cleanPhone.length - 4);
  return `${prefix.slice(0, 3)}******${visibleTail}`;
}

/**
 * Mask full name for PII minimization
 * @param {string} name
 * @returns {string} e.g., J*** D**
 */
function maskName(name) {
  if (!name || typeof name !== 'string') {
    return '**** ****';
  }
  return name
    .trim()
    .split(/\s+/)
    .map((word) => (word.length > 1 ? `${word[0]}***` : word))
    .join(' ');
}

/**
 * Mask PAN / ID numbers
 * @param {string} pan
 * @returns {string} e.g., ABCDE****F
 */
function maskPan(pan) {
  if (!pan || typeof pan !== 'string' || pan.length < 5) {
    return '**********';
  }
  return `${pan.slice(0, 5)}****${pan.slice(-1)}`;
}

/**
 * Perform full PII minimization on customer or user object
 * @param {Object} data
 * @returns {Object} Sanitized object with masked PII
 */
function minimizePII(data = {}) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized = { ...data };

  if (sanitized.email) sanitized.email = maskEmail(sanitized.email);
  if (sanitized.phone) sanitized.phone = maskPhone(sanitized.phone);
  if (sanitized.name) sanitized.name = maskName(sanitized.name);
  if (sanitized.panNumber) sanitized.panNumber = maskPan(sanitized.panNumber);
  if (sanitized.shippingAddress && typeof sanitized.shippingAddress === 'string') {
    sanitized.shippingAddress = `${sanitized.shippingAddress.slice(0, 6)}... [Redacted for Privacy]`;
  }

  if (sanitized.customer && typeof sanitized.customer === 'object') {
    sanitized.customer = minimizePII(sanitized.customer);
  }

  return sanitized;
}

module.exports = {
  encryptText,
  decryptText,
  maskEmail,
  maskPhone,
  maskName,
  maskPan,
  minimizePII,
};
