# ADR 005: Timing-Safe Webhook HMAC Verification & Top-Up Path Separation

## Status
**Accepted** (Implemented in `backend/webhooks/razorpay.webhook.js`, `backend/services/razorpay.service.js`)

## Context
Razorpay webhook delivery notifies the platform when a human buyer completes a wallet top-up. Webhook endpoints are publicly accessible and susceptible to spoofed payloads or side-channel timing attacks if string comparisons are evaluated with standard equality operators (`===`). Furthermore, agent payments must be isolated from live webhook latency.

## Decision
1. **Separation of Concerns:** Real Razorpay Checkout APIs are invoked exclusively when a human tops up their wallet balance. Autonomous agent purchases settle against the internal pre-funded ledger with zero third-party latency.
2. **Raw Body Buffer Verification:** Webhook HMAC-SHA256 signatures are computed over the unparsed request Buffer before JSON deserialization to prevent character-encoding mutations.
3. **Constant-Time Comparison:** The expected and received signature digests are compared using `crypto.timingSafeEqual` to eliminate timing side-channel vulnerabilities.

## Consequences
- **Positive:** Immune to webhook forgery and timing attacks.
- **Positive:** Agent purchasing latency remains under 50ms without external API dependency.
- **Negative:** Express server must configure raw body parser middleware before global JSON body parsers.
