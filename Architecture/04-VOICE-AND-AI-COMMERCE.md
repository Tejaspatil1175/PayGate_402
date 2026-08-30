# 04. Voice Commerce & Multi-Round Negotiation Engine

## Overview

PayGate 402 integrates a multimodal speech-to-commerce pipeline alongside an autonomous multi-round price negotiation engine. This enables natural hands-free voice shopping while strictly respecting merchant profit margins and discount floors.

---

## Voice AI Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as Buyer User
    participant Frontend as Voice UI (Audio MediaRecorder)
    participant VoiceService as backend/services/voiceIntent.service.js
    participant GroqWhisper as Groq API (whisper-large-v3)
    participant GeminiNLP as Google Gemini 2.5 Flash
    participant MatchingEngine as backend/services/matching.service.js

    Buyer->>Frontend: Speaks Voice Command ("Find wireless headphones under 3000 rupees")
    Frontend->>VoiceService: POST /api/voice/process-audio (WAV / WebM Stream)
    VoiceService->>GroqWhisper: Transcribe Speech Audio
    GroqWhisper-->>VoiceService: Text: "Find wireless headphones under 3000 rupees"
    VoiceService->>GeminiNLP: Extract Structured Intent & Budget JSON
    GeminiNLP-->>VoiceService: JSON: { intent: "search", category: "Electronics", maxPrice: 3000, keywords: ["wireless", "headphones"] }
    VoiceService->>MatchingEngine: Query Verified Merchant Products
    MatchingEngine-->>VoiceService: Catalog Matches Array
    VoiceService-->>Frontend: Voice Response + Matched Products Payload
    Frontend-->>Buyer: Synthesizes Audio Speech + Renders Product Cards
```

---

## Multi-Round Autonomous Price Negotiation

When an AI buyer agent initiates price negotiation:
1. **Initial Offer**: The agent proposes a discounted price based on buyer budget and market targets.
2. **Merchant Policy Evaluation**: The gateway checks the merchant's active `RULE_DISCOUNT_AUTO_03` rule:
   - **Auto-Accept Threshold**: Discounts within the auto-accept range (e.g. up to 10%) are accepted immediately in round 1.
   - **Counter-Offer Range**: Discounts between 10% and 25% trigger a calculated counter-offer based on inventory velocity and margin floors.
   - **Hard Floor Rejection**: Offers demanding more than the merchant's maximum discount ceiling (e.g. 25%) are rejected.
3. **Mandate Creation**: Upon mutual agreement, the agreed amount is locked into the immutable Cart Mandate payload for cryptographic signing.
