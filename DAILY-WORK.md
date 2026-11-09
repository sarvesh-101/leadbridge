# DAILY-WORK.md — Converza go-live status

> **Last updated:** 2026-10-27  
> **Owner:** Chetan (platform) · AI agent (execution)  
> **Source of truth:** this file + `docs/GO-LIVE-RUNBOOK.md` (steps) + `docs/plan-margins.md` (pricing)

---

## 2026-10-27 — LAUNCH enum + STARTER trial fix (complete)

**LAUNCH 500 fixed:**
- Root cause: the `Plan` enum in production Postgres had no `LAUNCH` value. Migration `20260907000000_add_launch_plan` had been sitting in the repo since 2026-09-07 and was never applied. Every checkout that tried to `prisma.client.update()` a Launch subscription crashed with `invalid input value for enum "Plan": "LAUNCH"` (PostgreSQL error `22P02`).
- Fix: ran `ALTER TYPE "Plan" ADD VALUE 'LAUNCH'` against the live Supabase DB directly. Verified the enum now = `{STARTER,GROWTH,PRO,LAUNCH}`.
- Recorded the migration as applied with `prisma migrate resolve --applied 20260907000000_add_launch_plan` so the deploy's `prisma migrate deploy` won't abort on "enum label already exists".
- Commit pushed: `fe6f927` — also added `npx prisma migrate deploy` to the Render build command and made the checkout path atomic (wrap in `interactiveTransaction` so a Razorpay-create failure doesn't leave a half-written subscription).

**STARTER "payment required manually" fixed:**
- Root cause: STARTER is the **only** tier that requests a 30-day trial. The checkout was sending `trial_period_days: 30` to Razorpay's `POST /subscriptions`. Razorpay does **not** accept `trial_period_days` on that endpoint — their docs list `plan_id, total_count, quantity, customer_notify, start_at, expire_by, addons, notes, offer_id`, and say trials are done by passing a future `start_at`. So Razorpay rejected the call, the checkout degraded gracefully, and the frontend showed "Subscription created — payment required manually".
- Fix (commit `bd079ed`): the trial is now expressed as a future `start_at` timestamp (30 days from now). `trial_period_days` is never sent. Verified on Razorpay's docs page (`https://razorpay.com/docs/payments/subscriptions/create`) — confirmed `trial_period_days` is not in the parameter list.
- Test coverage: new file `server/src/__tests__/razorpay-subscription.test.ts` (6 tests) pinning the exact payload per tier. Full suite: 190 passed / 8 skipped. `tsc --noEmit` clean.
- `RAZORPAY_PLAN_STARTER` was already set on Render (confirmed via `/health/integrations` before the fix). STARTER's plan ID is valid; the only thing wrong was the trial parameter.

**Deploy:**
- Render build command now includes `npx prisma migrate deploy` (commit `fe6f927`).
- Auto-deploy kept ON (was already on).
- `origin/main` is at `bd079ed` (the STARTER fix). Working tree clean. Pushed.

**Live verification:**
- `https://leadbridge-zy4o.onrender.com/health/integrations` → `razorpay.configured: true`, `missingVars: []` → all 6 Razorpay vars (KEY_ID, KEY_SECRET, PLAN_LAUNCH, PLAN_STARTER, PLAN_GROWTH, PLAN_PRO) are set on Render.
- `https://leadbridge-zy4o.onrender.com/health/razorpay` → `razorpayAuth.ok: true`, key prefix `rzp_live_Ti0DZ` (production keys, not the stale local ones).
- The deploy is live and running the new code.

**What's still true:**
- Local `.env` Razorpay keys are stale — live API returns `401 Authentication failed` (key prefix `rzp_live_TZf…`). Razorpay can only be tested from Render, not from this machine.
- Only migration still pending is `20261025000000_payment_provider_payment_id_unique` — prod's `Payment` table has 0 rows, so it's a no-op when it runs (just adds an anti-double-count unique index).

---

## 2026-10-28 — Step 2 done (Razorpay webhook handed off).

Step 2 of `docs/GO-LIVE-RUNBOOK.md` is complete on the code side. The dashboard pieces (secret in Render, webhook created in Razorpay, test deliveries) are yours to do — they can't be automated from this machine.

**What changed (not yet committed):**
- `scripts/send-test-webhook.cjs` — sends a compact, correctly-signed synthetic Razorpay event to any endpoint. `RAZORPAY_WEBHOOK_SECRET` from Render. Fake ids only, no DB writes. Usage: `RAZORPAY_WEBHOOK_SECRET=<value> node scripts/send-test-webhook.cjs [eventType] [--bad-signature]`.
- `scripts/verify-money-loop.cjs` — read-only Prisma check of one broker's Razorpay money loop after a ₹5 run: activation, subscription, PAID invoice with GSTIN/GS TECHNO, Payment row, and revenue increment. `node scripts/verify-money-loop.cjs <email>` or `--latest`.
- `server/_checkout-probe.cjs` — creates a live Razorpay subscription per tier using the **local** `.env` keys (same shape the checkout sends). Useful to confirm the local keys work before pointing at Render. Note: local keys are stale — expect 401 against Razorpay live.
- `server/_checkout-probe-http.cjs` / `server/_checkout-probe-live.cjs` — thin HTTP probes of `https://leadbridge-zy4o.onrender.com/health/razorpay` and `/health/integrations`.
- `health.json` — snapshot of `/health` state at handoff time.

**Status of the Step 2 checklist:**
- 2a (Render secret) — **you do this in the dashboard.** Confirm `RAZORPAY_WEBHOOK_SECRET` is set on Render → leadbridge-api → Environment. Default from this repo's `.env`: `8e994f4cb5677d2097ea3dfe66c29b3c47d2637c5d66025f`.
- 2b (dashboard webhook) — **you do this.** Razorpay dashboard → Settings → Webhooks → Add Webhook. URL `https://leadbridge-zy4o.onrender.com/api/v1/webhooks/razorpay`, events: `subscription.charged`, `subscription.cancelled`, `subscription.pending`, `payment.failed`, `invoice.paid`. Secret must match the Render value.
- 2c (send-test-webhook) — run from the repo root once the Render secret is set: `RAZORPAY_WEBHOOK_SECRET=<value> node scripts/send-test-webhook.cjs` → expect HTTP 200. Then `... node scripts/send-test-webhook.cjs subscription.cancelled --bad-signature` → expect HTTP 401.
- 2d (route handles all 5 events) — already implemented in `server/src/routes/webhooks/razorpay.ts`; verified by the test suite (190 passed / 8 skipped, `tsc --noEmit` clean).

**Webhook signature input (fixed):** the `application/json` parser in `server/src/index.ts` now stores the exact bytes on `request.rawBody`, and the Razorpay handler hashes that instead of `JSON.stringify(request.body)`. Re-serializing could only verify by luck (key order/whitespace/number formatting change the HMAC input). Covered by `server/src/__tests__/razorpay-webhook.test.ts` (raw bytes with non-canonical formatting → 200; bad signature → 401).

---

## BLOCKERS — none right now

None. Both LAUNCH and STARTER should now reach a Razorpay payment page. GROWTH and PRO were always working.

---

## TODO — verify (not code)

Do this from the dashboard, not from code:

- [ ] **Launch checkout** — dashboard → Billing → click Upgrade on Launch → Razorpay sheet opens (₹7,999/mo). No 500, no "manual payment".
- [ ] **Starter checkout** — dashboard → Billing → click Upgrade on Starter → Razorpay sheet opens (₹18,000/mo), first charge deferred 30 days.
- [ ] If either still fails: **Render → leadbridge-api → Logs**, search `Razorpay subscription failed`, paste the exact line — it contains the literal Razorpay rejection reason, and the fix is one payload tweak.

---

## TODO — runbook remaining (not started)

From `docs/GO-LIVE-RUNBOOK.md`:

- [ ] **Step 4 — SMS forwarding:** buy MessageBird number → verify → set callback to `/api/v1/webhooks/sms/incoming-messagebird` → add `FORWARDING_SMS_NUMBER` in Render → test SMS creates a lead → resend to check dedupe. (Currently: `sms_forwarding.configured: false`, `missingVars: ["FORWARDING_SMS_NUMBER"]`.)
- [ ] **Step 5 — IMAP email forwarding:** Gmail app password → set `IMAP_*` env → forward a portal enquiry → lead in ~2 min. (Currently: `email_forwarding.configured: false`.)
- [ ] **Step 6 — Facebook Lead Ads:** create Business app → webhook `/api/v1/webhooks/facebook` + verify token → subscribe to `leadgen` event → test lead arrives.
- [ ] **Step 7 — WhatsApp Business API (real):** WhatsApp Cloud + phone number → `/api/v1/webhooks/whatsapp` → test inbound message creates a lead.
- [ ] **Step 8 — Razorpay webhook:** create webhook in Razorpay dashboard → `POST /api/v1/webhooks/razorpay` → events: `subscription.charged`, `subscription.cancelled`, `subscription.pending`, `payment.failed`, `invoice.paid` → test with Razorpay CLI or dashboard "Test webhook".
- [ ] **Step 9 — Invoice PDFs:** confirm `/invoices/:filename` serves PDFs with signed-URL or Bearer auth; confirm GSTIN + "GS TECHNO" appears on the generated invoice.
- [ ] **Step 10 — Money loop test (`sales/payment-loop-test.md`):** trial → upgrade → real pay → webhook → invoice PDF shows GSTIN + GS TECHNO → cancel → refund → DPDP erase test account. (The ₹5 loop: cancel stale "Created" subs → pay on a checkout → verify ACTIVE + GSTIN invoice → cancel sub immediately → refund → erase.)
- [ ] **Step 11 — Rebrand:** rename Render `leadbridge-api` → `converza-api`; rename Vercel `leadbridge-seven` → `converza`; update `FORWARDING_EMAIL` sub-addresses if used; record new URL in `docs/REBRAND-URL-SWITCH.md`.
- [ ] **Step 12 — Demo call:** side-by-side demo call vs Vyora.
- [ ] **Step 13 — Onboard 2–3 brokers** (`outreach/demo-hitlist.md`) → 1 testimonial + lawyer review of exclusivity agreement.
- [ ] **Backlog (defer until real data):** DLT/DND for promotional campaigns, Gmail SMTP → transactional email, PRO cap re-tune after real call-duration data.

---

## 2026-11-07 — V2 branch typecheck recovery (working tree only)

**Branch:** `converza-v2` at `3b5a273` + uncommitted T9–T17 work. Nothing pushed; production still runs the committed T8 stack on the old Razorpay account.

- Fixed the blockers that kept the uncommitted V2 work from typechecking:
  - regenerated the Prisma client for the T5/T11/T13/T15 schema additions (the stale client caused most errors);
  - `Territory` gained `updatedAt` (schema + additive migration) — the T13 release cron uses it as the idle clock;
  - corrected the relative import depth in `routes/admin/proof.ts` and `routes/client/proof.ts`;
  - weekly proof snapshots store `costPerCompletedVisit = null` when the API metric is `"n/a"`, and WhatsApp sends pass `recipientType`;
  - DPDP lead erasure now uses the real schema (`Client.adminId` ownership gate, `AuditLog.resourceType/resourceId`); the non-existent `Admin.enabled` gate became a deleted-admin check, and tests were aligned.
- Verified: server `tsc --noEmit` clean; frontend `tsc --noEmit` clean; full server suite **278 passed / 8 skipped**; claims-lint **0** banned phrases.
- Known gaps (recorded, not claimed done): RERA/phone duplicate-account detection is not wired; the admin onboarding median is not exposed; the T12 agent prompt is built/tested but not yet consumed by the call provider; `Client.inboundToken` and `frontend/src/lib/feature-flags.ts` have no consumers.
- Still human-only: Step 3 Razorpay account migration (A1–D6) and the Render/Vercel env + DNS actions. Do not deploy this branch before the T4 plan-sync human gate.

---

## 2026-11-07 — Razorpay account under review (2–4 days) — REMINDER

**Razorpay status:** new account is in review; integration expected in **2–4 days**. Until it clears:

- Do NOT touch live Razorpay keys, plan sync (`--live`), or payment-loop tests. T4 stays gated.
- Spend the window on product/UX fixes that do not depend on payments:
  - **Mobile billing/dashboard** — observed on a phone: the left sidebar is hidden (desktop-only), so the
    plan badge and Billing entry were unreachable. Fix: mobile drawer now has a pinned "Your plan" card
    (`DashboardLayout` → `MobileSidebarOverlay`) linking to `/dashboard/billing`; PWA manifest renamed to Converza.
  - Sweep the rest of the dashboard on a 390px viewport (billing cards, tabs, tables, modals).
  - **Rebranding leftovers** (see `docs/V2-100-PERCENT.md` §D): `render.yaml` `leadbridge-api`, Vercel project
    `leadbridge-seven`, CSP API origin, CI image tags, nginx/prometheus/Grafana names, outreach + sales docs
    (still say LeadBridge and old ₹8K/18K/35K/60K prices), Razorpay/WhatsApp display names (human).
- **Closed independently (2026-11-07):** T12 prompt wired into `POST /voice/agents`; RERA one-account-per-number enforced on register + admin create (optional signup field); `GET /admin/analytics/onboarding` median; Sidebar consumes the campaigns flag (default-on); team seat cap enforced server-side + shown in the UI. Also fixed the T5 jitter cap (old formula produced 1–31 min).
- Full ordered checklist: **`docs/V2-100-PERCENT.md`**.

---

## 2026-11-10 — V2 work committed (T9–T16 + docs)

- **Razorpay:** the new business account is **active with the new company bank account** — Phase 6 is unblocked on the KYC side. The remaining steps are still human gates (A1–A6: keys, plans, ₹5 loop); this machine cannot call the live Razorpay API (401).
- **Committed** the entire V2 working tree as 10 task-scoped commits on `converza-v2`: `74f4d6b` (T9 claims lint) · `207c7fe` (T10 landing) · `63b0c58` (T12 prompt + registry) · `12d1eed` (T11 proof engine) · `5930c5c` (T13 territory/RERA) · `8b8d3ef` (T14 compliance) · `06394c1` (T15 onboarding) · `aa640a3` (mobile/team/flags) · `e69833a` (shared wiring) · `18ced89` (docs), plus the two stragglers `T11` WhatsApp template sender and `T6` captcha helper. Working tree is clean.
- **Verified on this tree:** server `tsc --noEmit` clean · `vitest run` **285 passed / 8 skipped** · claims-lint **0 banned phrases** · frontend `tsc --noEmit` clean.
- **Nothing pushed.** Production still runs `3b5a273` (T8) on the old Razorpay account; the branch is not deployable before Phase 6.
- **Still open (unchanged):** phone-duplicate policy decision, `Client.inboundToken` decision, 390px mobile sweep, mechanical LeadBridge→Converza rebrand pass.

---

## REMAINING — step-by-step guide (start here each day)

**State on 2026-11-10:** server + frontend typecheck clean · server suite **285 passed / 8 skipped** · claims-lint **0**. All T1–T17 artifacts are committed (`18ced89`), working tree clean. Nothing is pushed; production runs `3b5a273` (T8). Razorpay's new account is **active with the new company bank account** — start Phase 6.

Do the phases in order. Steps marked **ME** I can do alone; **YOU** needs your account/dashboard/decision.

### Phase 1 — Preserve the work (DONE 2026-11-10 — 10 commits, all gates green)

1. `git status --short` and confirm the 70+ paths are the V2 set (T9–T17, today's gap fixes, docs).
2. Remove throwaways before staging: `tmp-claims-scan.cjs` (deleted), `server/_checkout-probe-*.cjs` (delete if unused), keep `docs/step3-new-razorpay-account.md` (moved).
3. Commit in task-scoped commits, in this order:
   - `chore(v2): claims lint + CI` (T9, `.github/workflows/ci-cd.yml`, `server/scripts/claims-lint*`)
   - `feat(marketing): honest landing + legal stubs` (T10/T14 frontend, `lib/site.ts`)
   - `feat(proof): weekly broker proof engine` (T11 + `DashboardLayout` billing card)
   - `feat(ai): Converza agent prompt wired into agent creation` (T12, `ai/prompt.ts`, `routes/client/voice.ts`)
   - `feat(territory): micro-market fields + RERA duplicate account` (T13, schema + migration + `utils/rera.ts`, auth/admin client routes, signup field)
   - `feat(compliance): erasure, retention, AI disclosure` (T14 server)
   - `feat(onboarding): test call + onboarding median` (T15, `utils/onboarding-metrics.ts`, analytics route)
   - `fix(ui): mobile plan visibility, team seat cap, feature flags` (billing card, team page, Sidebar, flags, manifest)
   - `fix(scheduler): jitter never exceeds 30 min` (T5 correction)
   - `docs: V2 report, 100% guide, daily reminder`
4. Re-run checks after committing: `cd server && npx tsc --noEmit && npx vitest run && node scripts/claims-lint.mjs`, then `cd frontend && npx tsc --noEmit`.
5. **Do not push** until you say so (branch is not deployable before Phase 6).

### Phase 2 — Phone-duplicate policy (YOU decide, then ME ~1 h)

1. **YOU:** choose — hard block on duplicate owner phone, or flag for admin review. Recommendation: **flag, don't block** (family brokerages legitimately share a number).
2. **ME:** if flag → on register/admin-create, look up an existing `Client.phone`; when found, create an `AuditLog` entry (`action: "duplicate_phone_signup"`, `resourceType: "Client"`) and continue. If block → return 409 like RERA with `phoneDuplicate: true`.
3. **ME:** tests for both paths; note the policy in `docs/V2_REPORT.md`.
4. **Check:** duplicate phone → account created + audit row (flag) or 409 (block); unique phone unaffected.

### Phase 3 — `Client.inboundToken` (ME, ~1 h)

1. Decide use vs remove. Use it: expose `leads+<inboundToken>@converza.tech` in the Forwarding page + resolve inbound mail by token (no per-client IMAP config).
2. If not using it this quarter, drop the column in a migration and remove it from the schema — do not leave a dead unique column.
3. **Check:** forwarding address shown per client resolves to that client, or `rg inboundToken` returns nothing.

### Phase 4 — Mobile / UX sweep at 390×844 (ME, needs browser; YOU eyeball)

1. Open `/dashboard`, `/dashboard/billing`, `/dashboard/leads`, `/dashboard/analytics`, `/dashboard/settings`, `/dashboard/team` at 390px.
2. Fix: horizontal scroll (`scale-105` plan card, wide tables → card view), tab strips, modals taller than viewport, top-bar search crowding the avatar.
3. Confirm the drawer shows the **Your plan** card and Billing is one tap away; plan name + status readable.
4. **Acceptance:** zero horizontal scroll on those pages; billing reachable in ≤2 taps; no cut-off primary buttons.

### Phase 5 — Rebranding (ME mechanical; YOU vendor renames)

Order matters — customer-facing first.
1. **ME:** `outreach/*` and `sales/*` — LeadBridge → Converza; replace old prices (₹8K/18K/35K/60K) with the canonical config: Starter ₹17,699, Growth ₹41,299, Pro ₹70,799 incl. GST.
2. **ME:** `frontend/next.config.js` CSP `connect-src` (https + wss) when the API domain changes; `render.yaml` name/URLs; CI image tags + `/opt/leadbridge`; `start.bat` / `start-frontend.bat` titles; `frontend/package.json` + server package metadata; delete/rewrite `leadbridge-context-prompt.txt`; probe scripts.
3. **ME (careful):** `infrastructure/` nginx server_names, Prometheus/Grafana titles, `leadbridge_*` metric prefix — rename metrics and dashboards in one pass or dashboards break.
4. **YOU:** Render service rename `leadbridge-api` → `converza-api`; Vercel project rename; Razorpay plan display names; WhatsApp display name; repo rename.
5. **Check:** `rg -i leadbridge` only hits `work-log/` history and `docs/REBRAND-URL-SWITCH.md`.

### Phase 6 — Razorpay, only after the review clears (YOU gates, ME supports)

Full human runbook: **`docs/step3-new-razorpay-account.md` (A1–D6)**. Canonical monthly incl. GST is **₹17,699 / ₹41,299 / ₹70,799** (A3 is now correct). No new ₹7,999 LAUNCH plan is created — `RAZORPAY_PLAN_LAUNCH` is legacy only.

1. **YOU:** new account KYC verified, recurring/UPI AutoPay enabled, live keys copied, webhook secret generated.
2. **ME/YOU:** set the 7 Render vars (`RAZORPAY_KEY_ID`, `_KEY_SECRET`, `_WEBHOOK_SECRET`, `_PLAN_LAUNCH/STARTER/GROWTH/PRO`) → Manual Deploy.
3. **ME:** plan IDs from config, dry-run first:
   `cd server && npx tsx scripts/sync-razorpay-plans.ts` → review the printed payloads (touches nothing).
4. **YOU:** only after reviewing: `npx tsx scripts/sync-razorpay-plans.ts --live`, then `--verify` shows zero drift.
5. **ME:** `GET /health/razorpay` → `ok: true` and the **new** key prefix; `GET /health/integrations` → `missingVars: []`; signed webhook test 200, bad signature 401.
6. **YOU:** fresh incognito → Billing → Upgrade → pay **₹5** via UPI (the old blocker); then `verify-money-loop.cjs --latest` all green, cancel + refund check.
7. **YOU:** swap LAUNCH to the real plan, confirm the sheet shows ₹17,699/mo; expire old-account subscriptions (don't delete the old account until the loop passes).
8. **ME:** record new key prefix/plan IDs/loop result in this file.

### Phase 7 — Human / vendor gates (YOU, parallel anytime)

- WhatsApp template approvals (proof report + follow-ups) and display name.
- Real portal sample emails (IndiaMART/99acres/MagicBricks/Housing) — one per parser; IndiaMART API key needs a live client.
- T6: captcha provider keys + one real recorded demo call (`sales/demo-script.md`).
- DNS: Vercel apex/www, API custom domain, SPF/DKIM/DMARC per `docs/DOMAIN_EMAIL_SETUP.md`.
- Render/Vercel/WhatsApp/Razorpay renames from Phase 5.

### Phase 8 — Deploy (only after 6 + 7)

1. Push branch with authorization → CI (typecheck, tests, claims-lint, Docker build) must be green.
2. Render: deploy the merged commit; `prisma migrate deploy` runs in the build step — watch for migration errors.
3. Smoke: `/health` OK; `/health/razorpay` new prefix; login; Billing shows the right plan; create an agent (instructions contain the plans table); team seat cap; RERA 409 on a duplicate; `GET /admin/analytics/onboarding` returns medians.
4. Rollback: old Razorpay account stays live until the money loop passes; revert the merge commit if smoke fails.

### Phase 9 — Done means all true

- [ ] Every T1–T17 row in `docs/V2_REPORT.md` is done with no caveat.
- [ ] `cd server && npx tsc --noEmit` · `npx vitest run` · `node scripts/claims-lint.mjs` all green.
- [ ] `cd frontend && npx tsc --noEmit` green.
- [ ] Working tree committed; CI green; deployed only after Phase 6.
- [ ] Razorpay ₹5 loop passed and LAUNCH points at the real plan.

---

## Context for the AI agent

- Project: Converza (was LeadBridge) — AI sales-call platform for Indian real-estate brokers.
- Stack: Fastify backend (server/) + Next.js frontend (frontend/) + Prisma + PostgreSQL (Supabase) + Redis (Render free tier, available). Voice AI via Omnidimension. Payments via Razorpay. SMS via MessageBird. WhatsApp via Cloud API. Email via Nodemailer/SMTP.
- Deploy: Render (`leadbridge-api`) hosts the API; Vercel (`leadbridge-seven`) hosts the frontend. Repo root has `render.yaml`.
- Env vars for Razorpay (all set on Render, confirmed via `/health/integrations`): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_LAUNCH`, `RAZORPAY_PLAN_STARTER`, `RAZORPAY_PLAN_GROWTH`, `RAZORPAY_PLAN_PRO`. Plus `RAZORPAY_WEBHOOK_SECRET` (set — used to verify incoming webhooks).
- Plan pricing (from `docs/plan-margins.md`): Launch ₹7,999/mo (50 calls), Starter ₹18,000/mo (150 calls), Growth ₹35,000/mo (300 calls), Pro ₹60,000/mo (2,000 calls). GST 18% on all. Launch and Starter have a 30-day trial by default (expressed as a future `start_at` to Razorpay, not as `trial_period_days`).
- Razorpay plan IDs on Render: `plan_...` values set for all four tiers. Do NOT use `node scripts/setup-razorpay.cjs` locally — the local keys are stale (401). Create/verify plans in the Razorpay dashboard if ever needed.
- The local machine cannot hit the live Razorpay API (401). All Razorpay testing must happen on Render or via the dashboard.
