# DAILY-WORK.md — Converza go-live status

> **Last updated:** 2026-11-14  
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
- 2b (dashboard webhook) — **you do this.** Razorpay dashboard → Settings → Webhooks → Add Webhook. URL `https://leadbridge-zy4o.onrender.com/api/v1/webhooks/razorpay`, events: `subscription.charged`, `subscription.cancelled`, `subscription.pending`, `subscription.halted`, `subscription.completed`, `payment.failed`, `invoice.paid` (seven — not `payment_link.cancelled`, which is the Payment Links product we don't use; per-event behaviour table: `docs/razorpay-cutover-steps.md` → Step 5). Secret must match the Render value.
- 2c (send-test-webhook) — run from the repo root once the Render secret is set: `RAZORPAY_WEBHOOK_SECRET=<value> node scripts/send-test-webhook.cjs` → expect HTTP 200. Then `... node scripts/send-test-webhook.cjs subscription.cancelled --bad-signature` → expect HTTP 401.
- 2d (route handles all seven events) — already implemented in `server/src/routes/webhooks/razorpay.ts`; verified by the test suite (190 passed / 8 skipped, `tsc --noEmit` clean).

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
- [ ] **Step 8 — Razorpay webhook:** create webhook in Razorpay dashboard → `POST /api/v1/webhooks/razorpay` → events: `subscription.charged`, `subscription.cancelled`, `subscription.pending`, `subscription.halted`, `subscription.completed`, `payment.failed`, `invoice.paid` → test with Razorpay CLI or dashboard "Test webhook".
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

## 2026-11-13 — New Razorpay account: keys + plans VERIFIED live

- The new account's live keys authenticate from this machine (the old `rzp_live_Ti0DZ…` pair 401s). `cd server && npx tsx scripts/sync-razorpay-plans.ts --verify` printed all six plans and `All plan amounts verified ✓` (exit 0).

  | Tier | Monthly incl. GST | Plan ID | Annual incl. GST | Plan ID |
  |---|---|---|---|---|
  | Starter | ₹17,699 | `plan_TzZx6AnyZg1COc` | ₹1,76,988 | `plan_TzZx6S5zR1aDI8` |
  | Growth | ₹41,299 | `plan_TzZx6i9gxjn14t` | ₹4,12,988 | `plan_TzZx74cmsBPy79` |
  | Pro | ₹70,799 | `plan_TzZx7HGbGReXSR` | ₹7,07,988 | `plan_TzZx7U919rjaVt` |

  Map recorded in `server/razorpay.plan-map.json`. **A3 + A4 done.** No LAUNCH plan exists on the new account by design, so `RAZORPAY_PLAN_LAUNCH` stays unset.
- **Code fix:** `/health/integrations` no longer counts `RAZORPAY_PLAN_LAUNCH` as missing. It did, so `missingVars` could never reach `[]` after the migration — the C2 go-live check was unpassable, and that permanent noise would have masked a real gap on STARTER/GROWTH/PRO. A legacy LAUNCH checkout still fails loudly (400 "plan not configured") rather than degrading to "manual payment".
- **Production is not affected yet:** it runs `3b5a273` (T8), which already has the canonical prices (14,999/34,999/59,999 ex-GST) and the shared checkout — the new plan IDs bill the right amounts even before this branch deploys.
- **Still human (Render + dashboard):** A2 (confirm UPI AutoPay enabled), A5 (webhook, all seven events), B1–B8 (four Razorpay vars + webhook secret → Manual Deploy), then C1–C8 (health, signed webhook 200 / bad signature 401, real UPI AutoPay charge, `verify-money-loop.cjs`, cancel + refund).

---

## 2026-11-14 — Payment integration: code side CLOSED, Render cutover is the only gate

**Re-verified against the live new account from this machine:**
- `cd server && npx tsx --env-file=.env scripts/sync-razorpay-plans.ts --verify` → all six plans match `config/plans.ts`, exit 0. The new keys in `server/.env` (`rzp_live_TzZts…`) still authenticate.
- Production is still on the OLD account: `GET /health/razorpay` → `keyIdPrefix: "rzp_live_Ti0DZ"`.
- **`/health/integrations` is NOT a cutover signal.** It reported `razorpay.missingVars: []` while production still bills on the old account, because the running T8 build only checks that the vars are *present* — and they are, pointing at `plan_TLa2…` old-account plans. Only the key prefix on `/health/razorpay` proves which account is live.

**Code state — checked, nothing left to write:**
- Billing UI is three tiers (Starter/Growth/Pro) derived from `lib/plans.autogen.ts`; no Launch card; prices shown ex-GST with "+ GST".
- `/health/integrations` no longer requires the retired `RAZORPAY_PLAN_LAUNCH` (was uncommitted — committed today).
- `send-test-webhook.cjs` now exits non-zero unless the result matches the intent (200 good signature, 401 for `--bad-signature`), so the check that guards real money can't read as PASS.
- `setup-razorpay.cjs` refuses to run (it held the retired price list); `render.yaml` has no old-account plan IDs (`sync: false` on all four).
- `server/razorpay.plan-map.json` committed (new-account IDs, no secrets).
- Server `tsc --noEmit` clean · `razorpay-subscription.test.ts` + `razorpay-webhook.test.ts` = **11 passed**.

**Two sequencing facts found today (both change how C1–C8 are run):**
- **Prod DB is 5 migrations behind this branch.** `npx prisma migrate status` lists `20261025000000_payment_provider_payment_id_unique`, `20261104000000_v2_leads_metering`, `20261104100000_v2_platform_pause`, `20261104120000_v2_demo_requests`, `20261106000000_v2_t9_t17` as unapplied. Consequence: `node scripts/verify-money-loop.cjs --latest` currently dies with `The column Client.prepaidLeads does not exist in the current database` — schema drift, not a broken verifier. C7 can only run once the V2 migrations are applied (after `converza-v2` deploys). Until then, prove the ₹ loop from the Razorpay dashboard + Render logs.
- **The env-only cutover runs T8 code.** Render tracks `main`, which is still the T8 stack, so its `prisma migrate deploy` finds nothing pending and the five V2 migrations stay queued. After B1–B8 expect `/health/integrations` to list exactly `RAZORPAY_PLAN_LAUNCH` (T8 code requires it) until `converza-v2` ships — that one entry is not a cutover failure. The key prefix on `/health/razorpay` is the real signal.

**Remaining work is dashboard-only** (Razorpay has no merchant-webhook API; there is no Render API key on this machine):
1. **A2** Razorpay → Settings → Recurring Charges → confirm UPI AutoPay is **enabled**.
2. **B1–B7** Render → `leadbridge-api` → Environment: change all six Razorpay values **together** (a key pair and its plan IDs belong to one account — mixing them bills wrongly or rejects). Keys/secrets are in `server/.env`; plan IDs are in the 2026-11-13 table above.
3. **Delete `RAZORPAY_PLAN_LAUNCH`** on Render — it still holds the old account's ₹7,999 plan ID, which does not exist on the new account (`Invalid plan id` after the key swap). No Launch plan exists by design.
4. **B8** Manual Deploy → wait for Live.
5. **A5** Webhook: URL `https://leadbridge-zy4o.onrender.com/api/v1/webhooks/razorpay`, secret = `RAZORPAY_WEBHOOK_SECRET` from `server/.env`, all seven events.
6. **C1–C4** are mine once the deploy is live — prefix must read `rzp_live_TzZts`, `missingVars: []`, signed webhook 200, bad signature 401.
7. **C6–C8 + D** need you at the keyboard: real charge (Growth ₹41,299 charges immediately; Starter defers 30 days and cannot produce a PAID invoice on day 0) → `node scripts/verify-money-loop.cjs --latest` → cancel + refund → neutralise the old account (cancel its subs, do not delete).
8. **D6** rotate the key pair once the loop passes — it was pasted into chat during the migration.

**→ Click-level walkthrough of all of the above: `docs/razorpay-cutover-steps.md`.** It also records the documented ₹15,000 recurring cap (Cards/UPI) — every tier charges above it, so a real tier charge needs eMandate/NetBanking, not UPI AutoPay.

**Plans on the new account: already created — do NOT hand-create them in the dashboard.** Re-verified live 2026-11-14: `cd server && npx tsx --env-file=.env scripts/sync-razorpay-plans.ts --verify` → 6/6 ✓ (₹17,699 / ₹41,299 / ₹70,799 monthly + the three annual), exit 0. The only human action is pasting the three monthly IDs into Render. If `--verify` ever reports one missing, fix it with `--live` (which writes the `notes` the verifier matches on), never by typing a plan into the dashboard — a hand-made plan has no notes, is reported missing anyway, and its amount will not be the GST-inclusive figure.

---

## 2026-11-14 (later) — CUTOVER LIVE: production bills on the new business account

**C1–C4 run from this machine against `https://leadbridge-zy4o.onrender.com`:**
- **C1** `GET /health/razorpay` → `{"razorpayAuth":{"ok":true,"keyIdPrefix":"rzp_live_TzZts"}}`, HTTP 200. The prefix moved `rzp_live_Ti0DZ` → `rzp_live_TzZts`, so the env swap deployed and **production is on the new account**.
- **C2** `GET /health/integrations` → `razorpay.configured: true`, `missingVars: ["RAZORPAY_PLAN_LAUNCH"]`, HTTP 200. Reading that key as *missing* is the wanted end state — the old account's ₹7,999 ID is no longer configured — and it is expected on the T8 build, whose health check still requires it. No other Razorpay variable is listed, so KEY_ID, KEY_SECRET, WEBHOOK_SECRET, PLAN_STARTER, PLAN_GROWTH and PLAN_PRO are all set.
- **C3** correctly signed `subscription.charged` → **HTTP 200 `{"status":"received"}`, PASS, exit 0** (1090 ms).
- **C4** `--bad-signature` → **HTTP 401 `{"error":"Invalid signature"}`, PASS, exit 0** (234 ms) — signature enforcement is genuinely on, not silently permissive.

**Values verified before the swap:** the three Render values match `server/.env` byte-for-byte — KEY_ID 23 chars (`rzp_live_` + 14), KEY_SECRET 24, WEBHOOK_SECRET 48-hex and identical to the documented value; `sync-razorpay-plans.ts --verify` 6/6 ✓.

**Still unproven — needs a real checkout:** that the three plan IDs on Render are the *new-account* ones. `/health/integrations` only checks presence, never values, and no public endpoint exposes them, so a leftover old-account `plan_TLa2…` ID looks exactly like a new one until someone presses Upgrade. The first real checkout is the test.

**Remaining human steps:** enable UPI AutoPay (A2) · create the webhook in the dashboard with all seven events (A5) — C3 proved our endpoint accepts a signed payload, but nothing yet proves *Razorpay* can reach it · ₹5 UPI mandate proof, then the Growth loop, cancel + refund · cancel the old account's subscriptions (do not delete the account) · **D6 rotate the key pair**, it has been pasted into chat twice.

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
- Razorpay env vars: Render now holds the NEW account's values — cutover verified 2026-11-14, `/health/razorpay` prefix `rzp_live_TzZts`. `RAZORPAY_PLAN_LAUNCH` is deleted on purpose. Prod still runs the T8 build, so `/health/integrations` keeps listing `RAZORPAY_PLAN_LAUNCH` as missing — ignore that one entry; any other Razorpay key in that list is a real gap.
- Plan pricing (canonical, `server/src/config/plans.ts`): Starter ₹17,699/mo (200 leads), Growth ₹41,299/mo (600 leads), Pro ₹70,799/mo (1,200 leads), all incl. 18% GST (ex-GST 14,999 / 34,999 / 59,999). Launch is retired at its legacy ₹7,999 and gets no plan on the new account. Only STARTER requests a 30-day trial, expressed as a future `start_at` — never `trial_period_days`.
- Razorpay plan IDs live only in the Render dashboard (`render.yaml` is `sync: false` for all four). New-account IDs are recorded in `server/razorpay.plan-map.json`. `scripts/setup-razorpay.cjs` is disabled — it would create plans at the retired prices.
- The local machine CAN reach the live Razorpay API with the new account keys (verified 2026-11-13). The old `rzp_live_Ti0DZ…` pair still 401s. Pass keys inline on the command line; never commit them.

---

## 2026-11-27 — Per-broker email forwarding is end-to-end (Phase 3 closed)

**Why it was broken:** an auto-forward rule (Gmail/Outlook/portal) keeps the *portal's* `From`
header, so sender-only matching silently dropped exactly the mail brokers forward. The recipient
address does survive — in `To`/`Cc`, or in `Delivered-To`/`X-Forwarded-To`.

**What now exists:**
- `GET /api/v1/forwarding/address` → this broker's `forward+<token>@converza.tech` (10-char token, no 0/o/1/l), allocated lazily on first view (`utils/inbound-address.ts`). The Forwarding page shows it with a copy button and passes it to the portal wizard.
- Routing is **recipient first, sender second** (`services/email-ingestion.service.ts`), and the lead's `rawPayload` records `matchedBy` (`recipient`/`sender`) plus the token, so a mis-route is diagnosable from the lead record.
- Both ingestion paths pass recipient-side data: the IMAP poller sends `To`/`Cc` plus the raw header block (`Delivered-To`, `X-Forwarded-To`); the `/webhooks/email/incoming` route sends `to`, `delivered-to`, `x-forwarded-to`, `x-original-to`, `recipient`, `envelope` and `headers`.
- Provider shapes normalised: extraction flattens arrays and objects, so SendGrid's object `envelope` and CloudMailin's raw `headers` string both work (previously a non-string candidate would have thrown).
- Shared mailbox + manual forwards still work: sender matching is untouched, and legacy `leads+` addresses handed out by earlier builds still resolve.
- One mailbox serves every broker — a new broker needs only a forward rule, no Render change. `FORWARDING_DOMAIN` (optional) is now in `render.yaml` + `.env.example`.

**Verified:** server `tsc --noEmit` clean; `webhook-secret.test.ts` 8 passed; `inbound-address.test.ts` 9 passed; new
`forwarding-routing.test.ts` 6 passed (portal sender + token → right broker; two brokers on one
mailbox; SendGrid object envelope; sender fallback; unmatched portal mail ignored; unknown token
then sender fallback).

**Webhook hardened:** `POST /webhooks/email/incoming` was public and unauthenticated — a
forged POST created a lead, and every lead is a billable AI call (plus the 30-day phone
dedupe could mask the real enquiry). It now verifies `EMAIL_WEBHOOK_SECRET` from
`X-Webhook-Secret`, `Authorization: Bearer`, HTTP Basic (CloudMailin style) or `?secret=…`
(constant-time compare), returning `401` otherwise; unset secret keeps the previous open
behaviour so the deploy is safe before a provider is configured. `GET /webhooks/email/status`
now reports `secured`.

**Domain note:** `support@converza.tech` is the business mailbox and owns the root MX.
The forwarding catch-all must live on a subdomain (`forward.converza.tech`) — moving the
root MX to an inbound provider would break support mail.

**Still human (not code):** point a real portal enquiry at a broker's address and confirm the lead
appears — needs `IMAP_*` (or a webhook provider) configured on the deployed build, which is still
the T8 stack until `converza-v2` ships.

---

## 2026-11-27 (later) — Brand palette sweep finished; a silent Tailwind bug fixed

**What was half-done:** the marketing/landing components had been moved to the Obsidian + Burnt Orange
palette, but the dashboard, admin, customer, auth and setup pages still used the old green system
(`#101713` surfaces, `#E4E7DF`/`#F1F3EE` light cards, `#7C8781` muted text, plus `emerald`/`green`/
`red`/`amber` Tailwind palettes). The working tree was mid-sweep.

**The bug that made the earlier pass look finished when it was not:** every tint written as
`bg-[var(--semantic-success)]/10` (660 occurrences) produced **no CSS at all**. Tailwind 3.4 cannot
apply an opacity modifier to an arbitrary `var()` value and drops the rule silently — so all the
tinted badges, rows and borders created by the first pass were invisible. Same for
`border-[var(--x)]/30` and `text-[var(--x)]/70`.

**Fix — tokens are now real Tailwind colors backed by rgb channels:**
- `globals.css` keeps the hex vars (inline styles/SVG use them) and adds `--*-rgb` channel mirrors.
- `tailwind.config.ts` maps `canvas`, `surface`/`surface-raised`, `ink`/`ink-soft`/`ink-muted`,
  `line`/`line-subtle`, `brand`/`brand-soft`/`brand-deep`/`brand-copper`, `success`, `warning`,
  `danger` and `neutral-soft` through `rgb(var(--x-rgb) / <alpha-value>)`, so `/10`, `/30`, `/70`
  compile correctly.
- All arbitrary token utilities were rewritten to the named tokens
  (`bg-[var(--semantic-success)]/10` → `bg-success/10`), and the remaining legacy hex, gray,
  red, amber and emerald classes were converted across the frontend (92 files touched).
- The old light-theme cards in `setup`, `customer/*` and `admin/*` now use the dark surfaces with
  light text, matching the rest of the app.

**Also cleaned:** ~48 files had been rewritten with CRLF line endings by an editor, producing
whole-file diffs. Those are back to LF, so the commit diff contains only real changes.

**Verified:** frontend `next build` exit 0; built stylesheet contains
`rgb(var(--semantic-success-rgb)/.1)` and friends (proving the tints now emit); frontend
`tsc --noEmit` clean; server `tsc --noEmit` clean; forwarding/webhook suite 23 passed.

**Not verified:** the converted pages were not opened in a browser — contrast, hover states and
spacing on the formerly light-theme screens (`/setup`, `/customer/*`, `/admin/*`) still need a
visual pass at desktop and 390px before this branch ships.

