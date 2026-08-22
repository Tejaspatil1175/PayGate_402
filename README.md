# Payment Integrity Mesh

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Razorpay-0C2451?style=for-the-badge&logo=razorpay&logoColor=white" />
  <img src="https://img.shields.io/badge/MCP-Model_Context_Protocol-6E56CF?style=for-the-badge" />
</p>

<p align="center">
  <b>Defense-only, proxy-enforced fraud and refund-ring detection for Razorpay merchants.</b><br/>
  Built for the Razorpay AI Buildathon — Track 2: AI Risk Manager
</p>

---

## The idea

Small Razorpay merchants have no access to enterprise-grade fraud tools like Ravelin or Stripe Radar — those are priced and built for large platforms. Payment Integrity Mesh is a lightweight system, built entirely on Razorpay's own MCP server, that does three things:

1. **Detects** refund and dispute-ring abuse using real Razorpay payment and refund data — spotting when several refunds share a card, contact, or timing pattern that suggests coordinated abuse rather than genuine returns.
2. **Enforces defense-only behavior structurally** — every AI agent action passes through a proxy that physically cannot execute a write action (no refunds issued, no payments captured). It can only detect and flag, never act.
3. **Reports its own accuracy honestly** — precision, recall, and false-positive cost, measured against a labeled test set, instead of just claiming it works.

It's meant to sit as a governance layer underneath the kind of AI agents Razorpay is already building into its own platform — not to replace anything Razorpay has, but to add a stricter, auditable check that small merchants currently have no access to.

---

## What this is not

- Not a replacement for Razorpay's existing fraud tools.
- Not claiming Razorpay's own agents have no safety checks today — they do.
- Not a general fraud platform — scoped specifically to refund/dispute-ring abuse.

More detail (architecture, tech stack, build plan) will follow once the idea itself is settled.
