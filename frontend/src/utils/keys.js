import apiClient from '../api/client';

/**
 * Convert ArrayBuffer to standard PEM string with header, footer, and 64-character line wraps
 * @param {ArrayBuffer} buffer
 * @param {string} label - e.g. 'PUBLIC KEY' or 'PRIVATE KEY'
 * @returns {string}
 */
function arrayBufferToPem(buffer, label) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = window.btoa(binary);
  const formatted = base64.match(/.{1,64}/g)?.join('\n') || base64;
  return `-----BEGIN ${label}-----\n${formatted}\n-----END ${label}-----`;
}

/**
 * Generate an RSA-2048 keypair for RSA-PSS signing using the Web Crypto API
 * @returns {Promise<{ publicKey: string, privateKey: string }>}
 */
export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-PSS',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );

  const spkiBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const pkcs8Buffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  const publicKeyPem = arrayBufferToPem(spkiBuffer, 'PUBLIC KEY');
  const privateKeyPem = arrayBufferToPem(pkcs8Buffer, 'PRIVATE KEY');

  return {
    publicKey: publicKeyPem,
    privateKey: privateKeyPem,
  };
}

/**
 * Retrieve existing keypair from localStorage or generate a new one and register the public key
 * @param {string} [userId]
 * @returns {Promise<{ publicKey: string, privateKey: string }>}
 */
export async function getOrCreateUserKeys(userId) {
  let targetId = userId;
  if (!targetId) {
    const storedUser = localStorage.getItem('paygate_user');
    const user = storedUser ? JSON.parse(storedUser) : null;
    targetId = user?._id || user?.id || 'default_user';
  }

  const storageKey = `paygate_keys_${targetId}`;
  const stored = localStorage.getItem(storageKey);

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.publicKey && parsed.privateKey) {
        return parsed;
      }
    } catch (e) {
      // ignore parse error, generate fresh keys
    }
  }

  // Generate new keypair client-side
  const keys = await generateKeyPair();
  localStorage.setItem(storageKey, JSON.stringify(keys));

  // Sync public key to backend
  try {
    await apiClient.post('/user/auth/keys', {
      userId: targetId,
      publicKey: keys.publicKey,
    });
  } catch (err) {
    console.warn('[KEYS] Could not sync public key to backend:', err.message || err);
  }

  return keys;
}
