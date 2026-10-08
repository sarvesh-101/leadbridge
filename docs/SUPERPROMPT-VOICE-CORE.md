# 🦾 SUPER PROMPT — "Converza Voice Core" (in-house replacement for Omnidimension)

> **HOW TO USE:** Open any new Codebuff/Freebuff session, paste the prompt below, and say which
> phase to execute. The repo's provider abstractions were built for this day — the prompt is
> phased so we never rip out Omnidim until parity is proven. Rollback at every phase = one env flip.
> **Owner:** Sarvesh · **Agent:** Codebuff · **Created:** 2026-10-07

---

## ⚡ THE SUPER PROMPT (copy everything between the lines)

You are Codebuff, the coding agent for **Converza** — an AI voice-agent + CRM SaaS for Indian
real-estate brokers. The owner is **Sarvesh (GS TECHNO, Maharashtra proprietorship,
GSTIN 27AEGPH7840P1ZX)**. Today the voice stack depends on a third party, **OmniDimension**
(omnidim.io) — I want to build the same capability **in-house** as "Converza Voice Core" so we
own the pipeline, the margins, and the roadmap. Use OmniDimension's feature set as the
reference spec (it is documented at docs.omnidim.io) — **feature parity is the goal, not code
copying**. Our positioning vs competitor Vyora AI: *"Vyora calls the leads you upload.
Converza calls the leads you haven't seen yet."*

### Company & product facts (always true)
| Fact | Value |
|---|---|
| Product | Converza — AI voice agent + CRM for Indian real-estate brokers |
| Legal entity / GSTIN | GS TECHNO / `27AEGPH7840P1ZX` (rendered on invoices via `SELLER_GSTIN`) |
| Repo / branch | `sarvesh-101/leadbridge`, branch `main` |
| Stack | Next.js (Vercel) · Fastify + TypeScript API (Render) · Prisma on Supabase Postgres (transaction pooler, port 6543) · Redis/BullMQ (Aiven Valkey) · Razorpay billing · MessageBird/WhatsApp messaging |
| Voice domain | Outbound lead-qualification + booking calls; 23 languages (Hinglish default, Hindi, + 12 Indian); AI-disclosure always spoken first; live transfer to broker (+91); voicemail behavior: one brief callback message, then end |
| Compliance (non-negotiable) | TRAI: 9 AM–9 PM IST calling window; consent-basis gate (`server/src/utils/call-compliance.ts` — portal enquiry = transactional OK, promotional requires DLT-registered templates); DPDP data-protection flows (consent + erasure) exist |
| Cost baseline | Omnidim: ~₹200/min all-in ($5.06/mo per +91 number on their Starter $15/mo); our `OMNIDIM_COST_PER_MINUTE=4.6` and number cost ₹430/mo are the margins to beat |
| Existing integration surface | `server/src/services/omnidimension-agents.service.ts` (agents, languages, transfer, voicemail prompt), `omnidimension-knowledge.service.ts` (KB upload/attach), `omnidimension-phone.service.ts` (numbers: list/buy/import exotel-twilio/attach/detach, search→buy shop), `server/src/services/phone/*` (PhoneProvider interface + demo/twilio/omnidimension providers), `server/src/services/voice/*` (VoiceAIProvider interface), `server/src/routes/client/voice.ts` (REST: /voice/agents, /voice/phone-numbers/*, /voice/knowledge/*, languages), `server/src/routes/webhooks/omnidimension.ts` (call-events → CRM state machine) |

### Mission
Build **Converza Voice Core**: an in-house, multi-tenant voice-agent platform that reproduces
100% of the OmniDimension capabilities we actually use, behind the **existing** provider
interfaces of this repo, so the dashboard REST API (`/api/v1/voice/*`) and frontend stay
**unchanged**. Keep Omnidimension fully working as a provider; introduce
`VOICE_PROVIDER=converza-core` / `PHONE_PROVIDER=converza-core` with graceful fallback and
per-client override in the `Client` model (`voiceProvider` column). Never delete Omnidim code.

### Omnidim capabilities to reach parity on (build checklist)
1. **Voice agents CRUD** — prompt config (system prompt, welcome message, AI-disclosure
   auto-prepend, voicemail guidance), language set, voice selection, per-agent knowledge, versioning.
2. **Telephony numbers** — for India: provision via **Exotel** (primary — India-native, DLT
   integration) and/or **Twilio**; support import (bring-your-own number w/ credentials) +
   SIP-trunk option; buy/lease/release lifecycle; per-client dedicated number (Growth/Pro
   plans) at ~₹430/mo equivalent; rental charged from a platform wallet model like Omnidim's.
3. **Calls** — single outbound + **bulk campaigns** (BullMQ workers already exist), concurrency
   slots (config `VOICE_CONCURRENCY_SLOTS`), no-answer/retry ladder, 9–9 window-aware dispatch.
4. **The live loop** — streaming audio bridge (Twilio/Exotel Media Streams WebSocket), streaming
   ASR (Hinglish/Hindi robust; Deepgram Nova-2 or Sarvam AI primary, Whisper large-v3 batch
   fallback), LLM orchestrator with function-calling (**tools:** `crm_lookup`,
   `book_visit`, `transfer_call`, `end_call`, `send_whatsapp_summary`), streaming TTS
   (ElevenLabs multilingual / Sarvam "bulbul"; phrase-cache hot utterances like greetings and
   the AI disclosure). **Barge-in** (user interrupts TTS) mandatory. Latency budget: ≤800 ms
   turn-start, ≤2.5 s conversational round-trip.
5. **Live call transfer** — to broker's `transferToNumber` (+91) on request/hot-lead, with
   whispered pre-transfer context ("Broker se baat kara dijiye" handoff) — this must ring the
   broker's phone reliably (Omnidim's transfer confirmation is still unverified on our side —
   beat them here).
6. **Voicemail detection** — implement in-house (AMD/SIP 183/early-media + short-greeting
   heuristics + ASR of the greeting), a feature our current Omnidim Starter plan doesn't
   include — parity plus.
7. **Knowledge base** — PDF upload → text extraction → chunk → embed (pgvector on Supabase) →
   retrieval into agent context; attach/detach per agent; replicate existing
   `/voice/knowledge/*` routes.
8. **Recordings + transcripts + analytics** — per-call recording to Supabase Storage (bucket
   already wired), transcript with roles/timestamps, call-status webhook events (map new
   events into the EXISTING `/webhooks/omnidimension/call-events` handler shape or a twin
   `/webhooks/voice-core/call-events`).
9. **Observability & accounting** — cost-per-minute per provider, per-call cost ledger,
   concurrency utilization, ASR/TTS/LLM latency dashboards, circuit-breaker to Omnidim
   provider if Voice Core degrades (failover!). Cron + UptimeRobot monitoring already exist.
10. **State machine parity** — RINGING → IN_PROGRESS → HUMAN_TRANSFER / NO_ANSWER / VOICEMAIL
    / BUSY / FAILED → follow-up worker ladder (existing BullMQ followups rely on these states).

### Build phases (execute on command — ask which)
- **Phase A — Abstraction audit (a few hours):** grep every Omnidim call-site; map to
  VoiceAIProvider/PhoneProvider/CallEvents; write `docs/VOICE-CORE-AUDIT.md` with the exact
  gap list per interface. No behavior changes. Tests stay green (`174 passing`).
- **Phase B — MVP voice loop:** Exotel/Twilio Media Streams in, Deepgram/Sarvam ASR, LLM tool
  orchestrator, ElevenLabs/Sarvam TTS with barge-in, recording + transcript + webhook events.
  One real outbound Hinglish qualification call to Sarvesh's phone that books a visit and can
  transfer live. Kill-switch: `VOICE_PROVIDER=omnidimension` restores old path instantly.
- **Phase C — Parity:** campaigns worker concurrency, voicemail detection, KB/pgvector, live
  dashboard (replaces the Omnidim console: active calls panel, monitoring, per-agent stats).
- **Phase D — Telephony self-serve:** Exotel number provisioning per client, DLT registration
  workflow documentation for promotional future, wallet + top-up (Razorpay one-time flow
  reusable from the entry-tier build).
- **Phase E — Cost & quality optimization:** model routing (cheap LLM for short turns),
  TTS phrase cache hit-rate, ASR tiering, per-minute cost target **< ₹3.50 all-in** (vs ₹4.6
  Omnidim cost) — this margin is the reason we're building.

### Engineering rules (always)
- Multi-tenant by `clientId`; every agent/number/call belongs to a client; plan gates
  (`utils/plan-gates.ts`) apply.
- Env-driven config via `server/src/config.ts` (zod) — add `VOICE_CORE_*` keys with sane defaults.
- TypeScript strict, `npx tsc --noEmit` clean, existing test suite green, add tests for the
  new state machine + tool-call dispatcher.
- TRAI compliance gate MUST run before every dispatch (both providers).
- Never store secrets in the repo or `DAILY-WORK.md`; never break the existing
  `/api/v1/voice/*` contracts the frontend uses.

**Deliverable style:** phased commits (conventional, with 🤖 Codebuff trailer), each phase
ending with (1) `tsc` clean, (2) tests green, (3) a curl-verified live endpoint, (4) updated
`DAILY-WORK.md`, (5) Sarvesh-ready numbered click-steps for anything left for a human.

---
