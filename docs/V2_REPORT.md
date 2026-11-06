# V2_REPORT.md — converza-v2 upgrade log

> One section per task per the V2 doc's Definition of Done. Last updated at the end of the first working session on branch `converza-v2` (commits `8d1fe93`, `1681c0f`, `8a99716`).

---

## Phase 0 — Discovery

**Status: done** · Commit `8d1fe93` · docs/V2_DISCOVERY.md

- Verified directory map, working test commands, GST handling, ingestion order, compliance module, and every hardcoded plan/price location.
- **Key finding — GST (see discovery §4):** the charged plan amount is the price shown today, and `invoice.service.ts` treats it as **GST-INCLUSIVE** (`taxable = total / 1.18`). Razorpay plan amounts live in dashboard-created plan IDs (env `RAZORPAY_PLAN_*`), not in code.
- **Key finding — team-gate conflict was real:** `FEATURE_PLANS.team = [GROWTH, PRO]` while LAUNCH/STARTER carried 2/5 users (fixed in T3).
- **Doc↔repo mismatches recorded:** trial is calls-capped in code (`TRIAL_MAX_CALLS=50`) though doc says leads; FAQ claimed a "7-day trial"; "LEADCOLD"/"+200%" strings Claude's draft reported DO NOT exist in the repo; per-portal payload formats are per-portal parsers verified separately.

---

## T1 — Plans config as single source of truth

**Status: done** · Commit `1681c0f`

**Files changed**
- **New** `server/src/config/plans.ts` — canonical typed config: ex-GST prices, annual (10×), leads/team users/dedicated number/follow-ups/support per §1.2, GST-inclusive derivation (`round(ex × 1.18)`), trial (30 days / 50 leads / 25/day), calling window (9–21 IST), fair-use (8 min/lead), overage rates (₹90/₹70/₹55), retired-LAUNCH legacy map.
- `server/src/services/subscription.service.ts` — `PLAN_DEFINITIONS` now derives from the config: charged amounts = **₹17,699 / ₹41,299 / ₹70,799** (incl. GST), limits = 200/600/1,200 leads, 3/15/50 users. `LAUNCH` kept at legacy ₹7,999/₹79,990 for existing subscribers.
- `server/src/routes/public.ts` — new **`GET /api/v1/public/plans`** endpoint serving the payload.
- **New** `server/scripts/gen-plans.ts` → generates **`frontend/src/lib/plans.autogen.ts`** (content-hash `PLANS_VERSION`) from the canonical config.
- Frontend consumers switched to the generated payload: `marketing/PricingSection.tsx` (4 old hardcoded cards → 3 derived cards + GST line + per-lead price), `dashboard/billing/page.tsx`, `admin/OnboardingWizard/WizardShell.tsx` (Step 5 plan grid + Step 6 review), `marketing/FAQSection.tsx` (pricing + trial answers now derived; also fixed the wrong "7-day trial" claim → 30-day/50-leads), `marketing/ComparisonSection.tsx` (monthly-cost line), `marketing/ROISection.tsx` (bridge cost derives Growth ex-GST).
- `server/src/routes/admin/analytics.ts`, `server/src/cron/trial-expiry.ts` — price literals replaced by derived values.

**Tests**
- **New** `server/src/__tests__/plans-config.test.ts`: pins the §1.2 table exactly (incl. GST rounding), asserts `PLAN_DEFINITIONS` derives from config, and a drift test (`PLANS_VERSION` hash must match the regenerated file).
- Updated pinned values in `lead-limits.test.ts` (STARTER 500→200, PRO 50000→1200) and `subscription-checkout.test.ts` (GROWTH leads 3000→600).

**Verification:** server `npm run typecheck` clean · `npm test` → **201 passed / 8 skipped** · `npm run lint` → 0 errors (408 pre-existing warnings) · frontend `tsc --noEmit` clean.

**Decisions made**
1. **Charged figure = GST-inclusive rounded monthly** (₹17,699 / ₹41,299 / ₹70,799) so the existing invoice derivation (`total / 1.18`) keeps working unchanged; the website shows ex-GST with the incl-GST figure next to it. This follows discovery §4 (repo tax logic preserved; doc display rule honoured).
2. **Annual incl-GST = round(annualEx × 1.18)** = ₹176,988 / ₹412,988 / ₹707,988 (doc only specifies annual ex-GST = 10×; monthly-incl × 12 would have been ₹212,388 — the 10× interpretation is the doc's "12 for price of 10").
3. `calls` fields kept at legacy values as bookkeeping until T2's leads metering replaces the call-quota checks (PRO_MONTHLY_CALL_CAP behaviour untouched in T1).
4. LAUNCH is retired in the product but its code definition stays at legacy figures so existing Razorpay plan IDs continue to charge correctly until T2's map-to-STARTER migration.

**HUMAN GATE (before new prices go live):** the existing Razorpay dashboard plans still carry ₹18,000 / ₹35,000 / ₹60,000. T4's sync script must create/re-point plans to the new amounts (dry-run first, `--live` by the human only). Until then, checkout invoices book ₹17,699/₹41,299/₹70,799 while Razorpay's dashboard plan would charge the old figure — do **not** deploy this branch to production before T4 completes.

---

## T3 — Plan gates per the new table

**Status: done** · Commit `8a99716`

**Files changed:** `server/src/utils/plan-gates.ts` — `team` feature now `["LAUNCH","STARTER","GROWTH","PRO"]` (every paid plan, capped by `PLAN_DEFINITIONS.users`, legacy LAUNCH included so existing accounts keep working); `voice`/`reports` stay GROWTH+; `email_campaigns`/`sms_campaigns`/`ab_testing`/`api_access` stay Pro-only. `PLAN_DISPLAY_NAMES` now derives incl-GST amounts from the config (no hardcoded rupee strings).

**Tests:** covered in `plans-config.test.ts` (T3 describe block). Assertion per doc.

**Decision:** LAUNCH kept in the `team` gate despite retirement — removing it in T1/T3 would break access for live Launch subscribers before the T2 migration maps them to STARTER.

**Remaining for T3 (planned):** verify the frontend team UI hides/shows membership controls from the same generated config (currently the dashboard always renders team controls; plan-gates fix may be enough server-side, frontend polish folds into T10).

---

## T8 — Admin integration-status registry

**Status: done** · uncommitted at time of writing

**Files changed**
- **New** `server/src/routes/admin/integrations.ts` — read-only admin registry over the `Integration` model, behind `authenticateAdmin`:
  - `GET /admin/integrations` — paginated tenant × integration table (`page`, `limit`, `search`, `status`, `health=issues`); each row carries a derived summary (active/error/not-configured counts, total synced/errors, latest sync) and `serviceable` from `planStatus` so a billing problem isn't mistaken for an integration problem.
  - `GET /admin/integrations/:clientId` — one tenant's integrations + lead/call/booking counts + territory. Credentials (`apiKey`/`apiSecret`/`credentials`) are never selected; only an explicit whitelist of non-secret `settings` keys is returned.
  - `GET /admin/portal-ingestion-guide` — read-only JSON checklist mirroring `docs/portal-ingestion-setup.md` (per-provider steps/caveats/docs + ingestion channels) so the admin panel needs no markdown renderer.
- `server/src/index.ts` — registers the route under the API prefix.
- `server/src/routes/webhooks/razorpay.ts` + `server/src/index.ts` — webhook HMAC now uses `request.rawBody` (captured by the JSON content-type parser) instead of `JSON.stringify(request.body)`, which could only verify by luck. Falls back to re-serialization if a body arrives through another parser.

**Tests**
- **New** `server/src/__tests__/integration-status.test.ts` — 6 tests: summary reduction, integration-status filter, `serviceable=false` for `PAST_DUE`, 404 on unknown tenant, secret/PII settings stripped from the detail response, portal guide lists every provider with steps.
- `server/src/__tests__/razorpay-webhook.test.ts` — new case proving a signature over raw non-canonical bytes verifies (200) while `JSON.stringify` would not match.

**Verification:** `npx vitest run` on both files → 11 passed · `tsc --noEmit` clean.

**Decision:** server-only for now — no admin frontend page consumes these endpoints yet; the registry was the missing visibility layer (which tenant is stuck on which portal), not a UI task.

---

## HUMAN ACTIONS (accumulating)

- [ ] T4 — review `razorpay-sync-plans` DRY-RUN output, then create the new dashboard plans with `--live` (new charged amounts) — **required before deploying this branch**.
- [ ] Confirm the ₹176,988 / ₹412,988 / ₹707,988 annual incl-GST figures are acceptable bookkeeping (doc specifies only ex-GST for annual).
- [ ] T6 (later) — captcha provider keys, demo agent script, DEMO_DAILY_CAP review.
- [ ] T8 (later) — real portal sample emails.

## RISKS noticed

1. Payment/invoice amount visibility: between this branch and T4, the DB amount and the Razorpay dashboard plan amount disagree — guarded by the branch not being deployed.
2. Frontend team gating not yet config-driven (see T3 note).
3. `calls` fields in `PLAN_DEFINITIONS` are placeholders (500/etc.) until T2 rewires metering — any marketing copy reading `calls` (billing page usage card labels like "Calls Remaining") still shows call-based framing until T2/T10.

## SUGGESTED NEXT STEPS

- T2 (leads-handled metering + fair-use + `QUEUED_WAITING_CREDITS`) — biggest P0 remaining, unblocks real new pricing semantics.
- T5 (calling-window rescheduling + jitter + timestamps) — independent of T2, can be done next.
- T4 script (dry-run plan sync) so the human gate for live pricing is ready the moment T2 lands.
