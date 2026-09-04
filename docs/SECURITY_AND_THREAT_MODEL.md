# PayGate 402 — Formal Security Architecture & STRIDE Threat Model

> **Cryptographic Specifications, Key Lifecycle Management, STRIDE Threat Model & Data Privacy Compliance**

---

## 1. Cryptographic Primitives & Specifications

PayGate 402 enforces industry-standard cryptography across data-in-transit, data-at-rest, identity non-repudiation, and webhook verification. All cryptographic operations are implemented natively via Node.js `crypto` without third-party wrapper libraries.

```
+-----------------------------------------------------------------------------------+
|                        PAYGATE 402 CRYPTOGRAPHIC SUITE                            |
+------------------------------------+----------------------------------------------+
| PRIMITIVE                          | STANDARD / SPECIFICATION                     |
+------------------------------------+----------------------------------------------+
| Asymmetric Identity & Signing      | RSA-PSS 2048-bit (PKCS #1 v2.2 / RFC 8017)   |
| Hash Algorithm                     | SHA-256 (NIST FIPS 180-4)                    |
| Salt Length (RSA-PSS)              | 32 Bytes (RSA_PSS_SALTLEN_DIGEST)            |
| Symmetric Data-at-Rest Encryption  | AES-256-GCM (NIST SP 800-38D)                |
| Key Derivation (AES)               | SHA-256 Digest over ENCRYPTION_SECRET        |
| Initialization Vector (IV)         | 96-bit Random CSPRNG Buffer (12 Bytes)       |
| Authentication Tag (GCM)           | 128-bit Authentication Tag (16 Bytes)        |
| Anti-Replay Nonce Generator        | 256-bit CSPRNG Hex Digest (crypto.randomBytes)|
| Webhook Signature Verification     | HMAC-SHA256 (RFC 2104)                       |
| Constant-Time Equality Check       | crypto.timingSafeEqual                       |
+------------------------------------+----------------------------------------------+
```

---

## 2. Asymmetric RSA-PSS Mandate Signing & Verification

### Keypair Format & Architecture
- **Public Key:** Encoded in X.509 SubjectPublicKeyInfo (SPKI) PEM format (`BEGIN PUBLIC KEY`). Registered in `Registry` or provided in `Contract`.
- **Private Key:** Encoded in PKCS #8 PEM format (`BEGIN PRIVATE KEY`). Retained exclusively within the client agent's secure enclave; never transmitted to or stored by PayGate 402.

### Signature Algorithm Mechanics (`backend/utils/crypto.js`):
1. **Canonicalization:** The cart mandate object is deterministically serialized to JSON.
2. **Signing:**
   ```javascript
   function signData(data, privateKeyPem) {
     const payload = typeof data === 'string' ? data : JSON.stringify(data);
     const signer = crypto.createSign('SHA256');
     signer.update(payload);
     signer.end();
     return signer.sign({
       key: privateKeyPem,
       padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
       saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
     }).toString('base64');
   }
   ```
3. **Verification:**
   ```javascript
   function verifySignature(data, signatureBase64, publicKeyPem) {
     const payload = typeof data === 'string' ? data : JSON.stringify(data);
     const verifier = crypto.createVerify('SHA256');
     verifier.update(payload);
     verifier.end();
     return verifier.verify({
       key: publicKeyPem,
       padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
       saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
     }, Buffer.from(signatureBase64, 'base64'));
   }
   ```

---

## 3. Data-at-Rest Encryption (AES-256-GCM)

Sensitive merchant API credentials (e.g., `razorpayKeySecret`, `panNumber`) are encrypted at rest prior to database persistence using AES-256 in Galois/Counter Mode (GCM):

### Payload Structure (`ciphertext:iv:authTag`):
```javascript
function encryptText(plainText) {
  const iv = crypto.randomBytes(12); // 96-bit random IV
  const key = crypto.createHash('sha256').update(process.env.ENCRYPTION_SECRET).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${encrypted}:${iv.toString('hex')}:${authTag}`;
}
```

---

## 4. Formal STRIDE Threat Model & Mathematical Mitigation Proofs

PayGate 402 is evaluated against Microsoft's **STRIDE Threat Modeling Framework**:

| STRIDE Category | Specific Attack Vector | PayGate 402 Architectural Countermeasure | Verification Invariant & Proof |
|---|---|---|---|
| **Spoofing** | Attacker impersonates an authorized AI agent to drain user balance. | **RSA-PSS Public Key Authentication:** Every mandate requires a valid signature from the registered user's RSA-2048 keypair. | $\text{Verify}(M, \sigma, K_{\text{pub}}) = \text{False}$ on forged signatures. Verified in `mandateCrypto.test.js`. |
| **Tampering** | Man-in-the-middle alters transaction price from Rs. 1,000 to Rs. 10. | **Deterministic SHA-256 Mandate Hashing:** The signature covers the entire JSON envelope including price, items, and nonce. | Any bit alteration in $M$ alters $H(M)$, causing signature verification to fail immediately. |
| **Repudiation** | User claims automated shopping bot executed unauthorized payment. | **Cryptographic Non-Repudiation:** The contract stores $K_{\text{pub}}$, $\sigma$, and $H(M)$. The immutable audit log records the exact correlation ID. | Complete cryptographic proof linking buyer key to the exact mandate terms. |
| **Information Disclosure** | Attackers dump database or logs to steal user PAN, email, and phone. | **AES-256-GCM Encryption + PII Masking:** All sensitive fields are encrypted at rest and sanitized before logging. | Logs contain only masked strings (e.g., `+91******3210`, `t***l@example.com`). |
| **Denial of Service** | Rogue bot fires 5,000 requests/second to overwhelm gateway. | **Sliding-Window Velocity Guardrails:** Enforces 10 requests / 15 minutes limit + token-bucket IP rate limiter. | Excess traffic is dropped with `HTTP 429` / `GATE_01_SPEND_GUARDRAIL` before DB processing. |
| **Elevation of Privilege** | LLM manipulates tool call to trigger unapproved ledger debits. | **Air-Gapped Tool Boundary:** MCP tools have zero write access to ledger. Settlement requires authenticated REST execution. | MCP `check_cart_mandate` tool returns verification status only; never calls `debitWallet()`. |

---

## 5. Privacy Compliance & PII Minimization (DPDP Act 2023/2025)

In compliance with India's **Digital Personal Data Protection Act (DPDP 2023/2025)**, PayGate 402 implements automated PII minimization (`backend/utils/encryption.js`):

```javascript
// PII Masking Algorithms
function maskEmail(email) {
  const [user, domain] = email.split('@');
  return `${user[0]}***${user.slice(-1)}@${domain}`;
}

function maskPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return `+91******${cleaned.slice(-4)}`;
}

function maskPan(pan) {
  return `${pan.slice(0, 5)}****${pan.slice(-1)}`;
}

function maskName(name) {
  return name.split(' ').map(part => `${part[0]}****`).join(' ');
}
```

### Sanitized Audit Record Example:
```json
{
  "correlationId": "nonce_7f8a9b0c1d2e3f4a",
  "customerEmail": "t***l@example.com",
  "customerPhone": "+91******3210",
  "customerPan": "ABCDE****F",
  "decision": "ALLOW",
  "executionTimeMs": 28
}
```
