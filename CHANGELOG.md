# Changelog

All notable changes to the PayGate 402 project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-08-30

### Added
- **Production Test Suite**: 18 automated unit and integration tests across 4 test suites covering RSA-PSS cryptography, anti-replay nonces, 5-stage policy gating, and rollback compensation.
- **CI/CD Pipeline**: GitHub Actions workflow (`.github/workflows/ci.yml`) running multi-version Node.js tests and frontend build validation on push/PR.
- **One-Command Evaluator Seeder**: `npm run seed` (`backend/scripts/seed.js`) initializing pre-funded buyer accounts, merchant storefronts, governance rules, and agent personas.
- **Deterministic Rule Precedence**: Added `precedence` numeric ranking and structured `ruleId` + `reasonCode` output across policy evaluation and audit logs.
- **Architecture Documentation Suite**: Added `DEMO.md` evaluator walkthrough, `docs/EVIDENCE.md` claim verification map, and Architecture Decision Records (`docs/adr/`).
- **Live Vercel Deployment**: Configured and linked live frontend application at `https://pay-gate-402.vercel.app/`.

### Changed
- **Security Hardening**: Locked down backend CORS to strict authorized origins (`CLIENT_URL` / Vercel deployment) instead of wildcard `*`.
- **Financial Precision**: Enforced integer paise math (`toPaise`, `fromPaise`) across wallet balance, debit, credit, and rollback operations.
- **Terminology Refactor**: Standardized technical terminology across UI and documentation (replacing colloquial labels with accurate cryptographic terms).

---

## [0.9.0] - 2026-08-28

### Added
- **Five-Checkpoint Settlement Engine**: Implemented sequential policy validation pipeline (signature verification, velocity guardrails, approval thresholds, merchant policy check, and fraud scoring).
- **Voice Commerce Assistant**: Multimodal voice interface utilizing Groq Whisper for audio transcription and Gemini 2.5 Flash for structured intent extraction.
- **Real Razorpay Top-Up Rails**: Embedded Razorpay Checkout modal with HMAC-SHA256 webhook signature verification.
- **Autonomous Negotiation Engine**: Multi-round price negotiation service respecting merchant discount ceilings and margin floors.

---

## [0.1.0] - 2026-08-20

### Added
- Initial project architecture scaffolding with AP2 Cart Mandate RSA-2048 cryptographic primitives.
- Basic Express API server, MongoDB Mongoose schema models, and React frontend dashboard structure.
