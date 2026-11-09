# V2 — Step-by-step to 100%

> Status when written (2026-11-07): T0–T8 committed at `3b5a273`; T9–T17 present in the working tree
> and green (server + frontend `tsc --noEmit`, 278 tests passed / 8 skipped, claims-lint 0), but
> **uncommitted** and with five recorded gaps. Razorpay's new account is **under review (2–4 days)**,
> so payment-dependent steps are last.
>
> Work top to bottom. Each step ends with a check you can run.

---

## A. Make the work durable (do first, ~15 min)

- [ ] `git status` — confirm the 72 changed/untracked paths are the T9–T17 set, not stray probes.
- [ ] Remove or ignore throwaways: `tmp-claims-scan.cjs`, `server/_checkout-probe-*.cjs` (if dead), `docs/step3-new-razorpay-account.md` (human runbook, already moved).
- [ ] Commit in task-sized chunks (T9 claims-lint + CI, T10 marketing/legal, T11 proof, T12 prompt, T13 territory, T14 compliance, T15 onboarding, T16 flags, T17 docs, plus the schema migration).
- [ ] Push the branch only when the user authorizes it.
- **Check:** `git status` clean; `git log --oneline` shows one commit per task group.

## B. Close the five real gaps (~1–2 days)

### B1. T12 — wire the agent prompt into calls ✅
- `server/src/ai/prompt.ts` renders `{{PLANS_TABLE}}` / `{{INTEGRATIONS_TABLE}}` but nothing calls it.
- [x] Done: `POST /voice/agents` calls `resolveAgentSystemPrompt()`; an explicit broker prompt still wins, and a render failure falls back to the provider default instead of blocking agent creation.
- Keep a fallback to the current prompt if rendering throws, and log which prompt version was used on the call record.
- **Check:** add/extend `server/src/__tests__/prompt.test.ts` so a created agent payload contains the rendered table strings; `npx vitest run src/__tests__/prompt.test.ts`.

### B2. T13 — RERA / phone duplicate-account detection (RERA done, phone open)
- [x] RERA: normalized in `utils/rera.ts`; `POST /auth/register` (optional signup field) and `POST /admin/clients` return 409 when the number belongs to another account.
- [ ] Phone: same-number detection still needs a product decision (hard block vs admin flag). Do not block on it — family brokerages share numbers.
- Decide product behaviour first: hard block vs. flag-for-admin. Hard block on exact RERA match is the safe default; phone match should flag, not block (family brokerages share numbers).
- **Check:** test duplicate RERA → 409, duplicate phone → flagged, unique → passes.

### B3. T15 — admin onboarding median ✅
- Fields exist: `Client.signupAt`, `firstLeadSourceConnectedAt`, `firstCallAt`.
- [x] Done: `GET /admin/analytics/onboarding` (median hours signup→source, signup→first call, source→call; incomplete rows excluded, negative gaps ignored). Helper + tests in `utils/onboarding-metrics.ts`.
- **Check:** test with 3 fixture clients where the median is known.

### B4. T16 — give the feature flags consumers (or delete them) ✅
- `frontend/src/lib/feature-flags.ts` defines campaigns/A-B/white-label behind `NEXT_PUBLIC_FEATURE_*` but no page reads them.
- [x] Done: `Sidebar` filters the campaign nav items through `FEATURES.campaigns`. Flags now default ON (`!== "false"`) so a missing env var never hides a shipped Pro feature.
- **Check:** frontend `tsc --noEmit`; with the flag off, the Pro nav item is hidden.

### B5. T3 — frontend team gating from the plans config ✅
- Dashboard team page always renders membership controls; the server gate is correct but the UI is not.
- [x] Done: team page shows seats used/limit from `plans.autogen.ts` and disables invites at the cap; `POST /team/invite` enforces the same limit (pending invites count).
- **Check:** STARTER sees the form (team allowed, 3 seats), TRIAL sees the upgrade prompt.

## C. Mobile / UX sweep (~half a day)

- [x] Billing reachable on phone: mobile drawer now pins a "Your plan" card → `/dashboard/billing`; PWA manifest renamed to Converza.
- [ ] Walk the dashboard at 390×844: billing plan grid (`scale-105` on the highlighted card), tabs, invoice table, current-plan card, settings forms, modals.
- [ ] Check the mobile drawer for the 17-item list — anything below the fold should be reachable by scroll (it is) but consider grouping.
- [ ] Verify the top bar search input doesn't crowd the avatar under 360px.
- **Check:** no horizontal scroll on any dashboard page at 390px; plan name + status visible within one tap.

## D. Rebranding leftovers (~1–2 hours, mostly mechanical)

Customer-facing first:
- [x] `frontend/public/manifest.json` → Converza (PWA install name).
- [ ] `outreach/*` and `sales/*` — still say LeadBridge and quote ₹8K/18K/35K/60K; update copy + prices to the T1 config and `converza.tech`.
- [ ] `frontend/next.config.js` — CSP `connect-src` is pinned to `leadbridge-zy4o.onrender.com`; update both https + wss when the API domain moves (see `docs/REBRAND-URL-SWITCH.md`).
- [ ] `render.yaml` — service `leadbridge-api`, `FRONTEND_URL`, `WEBHOOK_URL`.
- [ ] `.github/workflows/ci-cd.yml` — image tags `leadbridge-server:test` / `leadbridge-frontend:test`, `/opt/leadbridge` deploy dir.
- [ ] `start.bat` / `start-frontend.bat` titles; `leadbridge-context-prompt.txt` (archive or rewrite).
- [ ] `server/_checkout-probe-*.cjs` — old hostname; delete if unused.
- [ ] `frontend/package.json` name/description (`leadflow-ai-os`) and server package metadata.
- [ ] `infrastructure/` — nginx `server_name leadbridge.com`, prometheus/Grafana titles and `leadbridge_*` metric prefix (renaming metrics invalidates existing dashboards — do it in one pass and update the dashboards).
- Human/vendor (cannot be done in code): Render service rename, Vercel project rename, Razorpay plan display names, WhatsApp display name, `leadbridge` repo rename.
- **Check:** `rg -i leadbridge` returns only historical work-logs and `docs/REBRAND-URL-SWITCH.md`.

## E. Payments — only after Razorpay review clears (2–4 days)

- [ ] New account verified → set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` on Render.
- [ ] Run `razorpay-sync-plans` **dry-run**; review the printed create/re-point plan.
- [ ] Human runs `--live`; then `--verify` shows zero drift.
- [ ] Point the Razorpay webhook at the new API domain; replay one event.
- [ ] Run `sales/payment-loop-test.md` end to end (trial → checkout → webhook → invoice → cancel).
- **Check:** `/health/razorpay` reports the new key prefix; a test subscription charge produces a PAID invoice with GST.

## F. Remaining human gates (not engineering)

- [ ] WhatsApp template approvals (proof report, follow-ups) and display name.
- [ ] Real portal sample emails + IndiaMART key for a live client.
- [ ] T6 captcha keys + recorded demo call.
- [ ] Render/Vercel env, DNS, custom domain; SPF/DKIM/DMARC per `docs/DOMAIN_EMAIL_SETUP.md`.

## G. Definition of done for the whole prompt

- [ ] Every T1–T17 row in `docs/V2_REPORT.md` says "done" with no "not wired / not exposed / no consumers" caveat.
- [ ] `cd server && npx tsc --noEmit` clean.
- [ ] `cd frontend && npx tsc --noEmit` clean.
- [ ] `cd server && npx vitest run` green.
- [ ] `cd server && node scripts/claims-lint.mjs` → 0 banned phrases.
- [ ] Working tree committed; branch pushed only with authorization.
- [ ] Deploy only after T4 plan-sync and the Razorpay review are complete.
