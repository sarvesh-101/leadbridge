# V2_DISCOVERY.md — Phase 0 (converza-v2)

> **Rule kept:** no code changes were made before this document.
> Everything below was verified against the repo, not assumed.
> Branch: `converza-v2`. Repo internal name is `leadbridge`; customer brand is Converza.

---

## 1. Directory map (top two levels)

```
/                        — docs/, scripts/ (ops .cjs helpers), render.yaml, Docker files
  server/                — Fastify API (deployed on Render as "leadbridge-api")
    prisma/              — schema.prisma, seed.ts, migrations/
    scripts/             — small .cjs ops scripts
    src/
      config.ts          — Zod-validated env config (fails fast at boot)
      index.ts           — app bootstrap, all route registrations, /health*
      routes/
        auth.ts          — register/login/google/forgot/reset
        public.ts        — public (unauthenticated) routes
        customer.ts      — lead-facing customer portal API
        demo.ts          — investor demo endpoints (DEMO_MODE=true only)
        tracking.ts, metrics.ts
        client/…         — ~31 broker modules (leads, calls, billing, campaigns, …)
        admin/…          — 12 admin modules (dashboard, clients, credits, payments, …)
        webhooks/…       — ingested sources: ingest, facebook, indiamart, whatsapp,
                           omnidimension, razorpay, sms/email forwarding, messagebird
      services/          — business logic (see §3)
      workers/           — BullMQ workers (call, notification, extraction, followup,
                           reminder, webhook-retry, campaign; queues.ts)
      cron/              — 15 cron jobs (scheduler, monthly-reset, dunning, …)
      utils/             — lead-limits, plan-gates, retry-delay, templates, …
      plugins/           — auth, api-key-auth, websocket, rate-limit
      __tests__/         — 21 vitest files
  frontend/              — Next.js 15 App Router (deployed on Vercel)
    src/
      app/               — page.tsx (landing), auth/, dashboard/ (28 pages incl. admin/),
                           customer/, compare/vyora/, legal/, compliance/
      components/
        marketing/       — the 14 landing sections (see §3)
        admin/OnboardingWizard/
        leads/, shared/
      lib/, utils/
```

### Test commands that actually work

| Where | Command | Notes |
|---|---|---|
| server | `npm run test` (vitest run) | current suite: 190 passed / 8 skipped |
| server | `npm run typecheck` (`tsc --noEmit`) | clean at baseline |
| server | `npm run lint` (eslint src/) | exists |
| frontend | `npm run type-check`, `npm run lint` (`next lint`), `npm run build` | no frontend test runner exists |
| root | `npx prisma generate` inside server/ | needed after schema edits |

---

## 2. Prisma enums & models relevant to V2

- `enum Plan` — `LAUNCH, STARTER, GROWTH, PRO` (all four live in prod DB).
- `enum PlanStatus` — `TRIAL, …` (client lifecycle state).
- `model Client` — business fields, `city`, `zone`, `territory` relation, `emailVerified`, plan/planStatus fields.
- `model Subscription` — `planName`, `planTier`, `billingCycle`, `status`, **`amount` / `totalAmount` Float (INR rupees as charged)**, period fields.
- `model Lead`, `Call`, `Property`, `Booking`, `Territory`, `Invoice`, `Payment`, `AccountingEntry`, `PlatformCredit`, `CreditTransaction`, `NotificationPreference`, `WebhookSource`, `AuditLog`, `ApiKey`.
- Migration policy stands: additive only; `LAUNCH` stays in the enum as deprecated and maps to `STARTER` (T2).

---

## 3. Where each V2-relevant thing lives

| Item | Path |
|---|---|
| Plan definitions & limits | `server/src/services/subscription.service.ts` → `PLAN_DEFINITIONS` (LAUNCH 7999/79990, STARTER 18000/180000, GROWTH 35000/350000, PRO 60000/600000; users 2/5/15/50; leads 200/500/3000/50000; calls 50/100/500/999999) · `RAZORPAY_TOTAL_COUNT = 1200` · `PRO_MONTHLY_CALL_CAP = 2000` |
| Plan gates | `server/src/utils/plan-gates.ts` → `FEATURE_PLANS`: `team`, `voice`, `reports` = GROWTH+PRO (see §5 conflict) |
| Usage/quota in ingestion | `server/src/services/lead-ingestion.service.ts` — order: account-status → **daily lead cap** (Redis, `DAILY_LIMITS` in `utils/lead-limits.ts`) → **monthly leads cap** (`checkMonthlyLeadsCapacity` / `tryConsumeMonthlyLead`) → dedup (dedupQueryId via Redis set, fallback phone dedup vs `status NOT IN (COLD, CONVERTED)`) → create PENDING → kick AI calling pipeline (owner gets a WhatsApp notice if call quota exhausted, lead is NOT dropped) |
| Call-compliance | `server/src/services/call-compliance.ts` — TCCCPR/DPDP gate: consent basis (`PORTAL_ENQUIRY` / `PRIOR_CONTACT` / `EXPLICIT_OPTIN` / `UNKNOWN`), AI-disclosure requirement, `CALL_WINDOW_START_HOUR = 9`, `CALL_WINDOW_END_HOUR = 21` |
| Calling window enforcement | `server/src/workers/call.worker.ts` — `WORKING_HOUR_START = 9`, `WORKING_HOUR_END = 21` (kept in sync manually with call-compliance.ts) |
| Call queue & retries | `server/src/workers/call.worker.ts` + `workers/queues.ts`; backoff in `utils/retry-delay.ts` |
| Follow-up scheduling | `server/src/services/smart-scheduler.service.ts`, `workers/followup.worker.ts`, `workers/reminder.worker.ts`, `cron/scheduler.ts` |
| Razorpay subscription & checkout | `server/src/services/subscription.service.ts` (`createSubscriptionCheckout`, trial via future `start_at`, NOT `trial_period_days`) + `services/razorpay.service.ts` (amounts sent as `Math.round(amount * 100)` paise — line ~151) + `routes/client/billing.ts` + webhook `routes/webhooks/razorpay.ts` |
| GST & invoices | `server/src/services/invoice.service.ts` — **see §4** |
| AI representative prompt | **Does not exist yet.** Only WhatsApp/email copy templates in `server/src/utils/templates.ts`. T12 will create `server/src/ai/prompts/converza-agent.md` |
| Landing page | `frontend/src/app/page.tsx` + `frontend/src/components/marketing/`: `HeroSection`, `ProblemSection`, `FeatureShowcase` ("Predictive Lead Scoring" title — to rename in T10), `IntegrationSection`, `PricingSection` (all 4 plans hardcoded), `ROISection` (`bridgeCost = 35000` hardcoded, line 71), `ComparisonSection` ("24/7" claims + `₹7,999 - ₹60,000` range, line 17), `TerritoryMap`, `FAQSection` (hardcoded prices line 22; **claims a 7-day trial** — wrong), `CTASection`, `HowItWorksSection`, `MarqueeTicker`, `ResultsSection`, `TestimonialsSection` |
| Competitor comparison page | `frontend/src/app/compare/vyora/page.tsx` (public today — T10 must gate it behind `COMPARE_PAGE_ENABLED=false`) |
| Admin credits module | `server/src/routes/admin/credits.ts` + `services/credit-manager.service.ts` |
| `/health`, `/health/integrations` | `server/src/index.ts` (integrations health includes platform-credits cost snapshot) |

---

## 4. How GST works today (verified — do not change tax logic casually)

1. **What the customer is charged:** the amount comes from `PLAN_DEFINITIONS` (₹7,999 / ₹18,000 / ₹35,000 / ₹60,000). Live Razorpay plans are pre-created in the **Razorpay dashboard**; the code only maps tiers to env plan IDs (`RAZORPAY_PLAN_LAUNCH/STARTER/GROWTH/PRO`) and sends `amount × 100` paise for the subscription. So the **charged rupee amount currently equals the displayed price**.
2. **What the invoice says:** `invoice.service.ts` treats that charged total as **GST-INCLUSIVE**: `taxableAmount = totalAmount / 1.18`, `gstAmount = totalAmount − taxableAmount` (18% breakdown, GSTIN `27AEGPH7840P1ZX`, SAC 9983).
3. **Consequence for the new pricing table:** the doc displays ex-GST prices with a shown GST-inclusive figure (₹14,999 → ₹17,699 etc. — arithmetic checked: ×1.18 rounds to exactly those rupee values). To keep invoices consistent **without changing tax logic**, T1 makes the charged (Razorpay + Subscription.amount + invoice total) the GST-inclusive rounded figure, while the website displays the ex-GST price plus the incl-GST figure. The old PLAN_DEFINITIONS numbers therefore change meaning today: current ₹18,000 is charged AND booked as GST-inclusive (₹15,254 + ₹2,746). Doc table now treats plan prices as ex-GST display — this is a real display/charge change, recorded in the report.

---

## 5. Every place a plan name, price or cap is hardcoded (replace in T1)

Frontend:
- `frontend/src/components/marketing/PricingSection.tsx` lines 13/30/47/66 (₹7,999 / ₹18,000 / ₹35,000 / ₹60,000 + feature bullets)
- `frontend/src/app/dashboard/billing/page.tsx` lines 20/37/53/71
- `frontend/src/components/admin/OnboardingWizard/WizardShell.tsx` lines 303–306 + line 340 ("Growth (₹35,000/mo)")
- `frontend/src/components/marketing/FAQSection.tsx` line 22 (pricing answer; also claims "7-day trial")
- `frontend/src/components/marketing/ComparisonSection.tsx` line 17 (₹7,999–₹60,000)
- `frontend/src/components/marketing/ROISection.tsx` line 71 (`bridgeCost = 35000`)

Server:
- `server/src/services/subscription.service.ts` `PLAN_DEFINITIONS` (the values above)
- `server/src/routes/admin/analytics.ts` lines 53–56 (`LAUNCH: 7999`, `STARTER: 18000`, …)
- `server/src/cron/trial-expiry.ts` line 52 (init text: "Growth plan (₹35,000/month)")
- `server/src/utils/lead-limits.ts` `DAILY_LIMITS` keyed per plan
- `server/src/utils/plan-gates.ts` `FEATURE_PLANS`

---

## 6. Places this document disagrees with the repo (recorded, per rules)

1. **Trial semantics.** Doc §1.2: trial = "30 days, up to 50 **leads**, 25/day". Repo: `TRIAL_DAYS=30`, `TRIAL_MAX_CALLS=50` — the cap is **calls**, not leads (config.ts), and marketing FAQ says "7-day trial" (wrong on both counts). Resolution: doc wins; T2 moves metering to leads-handled, which makes these per-lead caps implementable; the 7-day FAQ line is a marketing bug fixed in T10.
2. **Public demo endpoints.** Doc T6 wants `POST /public/demo/request|verify`. Repo has `routes/demo.ts` (investor simulation, `DEMO_MODE=true` only) and demo phone/voice providers (`services/phone/demo-phone-provider.ts`, `services/voice/demo-voice-provider.ts`) — underlying demo call machinery exists, but there is **no public OTP-based demo today**. No conflict, just new surface.
3. **Claims about website bugs I could not verify.** The doc's Phase-0 hints of a "0% stat counter" and broken "LEADCOLD" text: grep found **no** "LEADCOLD" string and no "+200% bookings" / "36 vs 12" copy anywhere. The unsourced items that DO exist: "JustDial leads expire in under 6 minutes" (`ProblemSection.tsx`), "24/7 answering/hours" (`ComparisonSection.tsx`, `FAQSection.tsx`, `ROISection.tsx`), "Predictive Lead Scoring" (`FeatureShowcase.tsx`). The "0% counter" needs a browser check at T10 — treat as unverified, not a fact.
4. **Dedicated calling number per plan.** Current marketing: Growth & Pro get a dedicated number; Launch/Starter share. Doc §1.2 gives **every** paid plan a dedicated number. Doc wins at T1 — Boyle the marketing copy in T10.
5. **Team access conflict (verified).** Doc is right: `FEATURE_PLANS.team = [GROWTH, PRO]` while `PLAN_DEFINITIONS` gives LAUNCH 2 / STARTER 5 `users`. T3 implements the doc rule: **team access on every paid plan, capped by the plan's user count.**
6. **WhatsApp after-hours acknowledgement template (`WHATSAPP_TEMPLATE_AFTER_HOURS_ACK`) does not exist** — T5 adds the env + template wiring with allow-listed template side only (no free-form business-initiated messages).
7. **Fair-use / overage model does not exist** — current model is call-quota + prepaid call credits (`credit-manager.service.ts`, rollover capped at 3×). T2 replaces quota checks with leads-handled metering + `QUEUED_WAITING_CREDITS` + `answeredSeconds` per lead. Migration is additive; `prepaidCalls` flow is deprecated, not dropped.
8. **Ex-GST display vs inclusive charge** — see §4; decision recorded there and in the report.

---

*Discovery complete. Implementation starts with T1; every task lands as its own commit `T<number>: <summary>`.*
