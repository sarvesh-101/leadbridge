# Step 3 — New Razorpay account migration + ₹5 money loop test

**STATUS (2026-11-10): the new business account is ACTIVE, with the new company bank
account verified (owner-confirmed). A1 is done — resume at A2/A3.**

**Why:** every UPI attempt on the old personal Razorpay account fails with
"Payment is not allowed for this account. Please contact your bank or try a
different account" — across multiple UPI IDs and amounts (₹5 and ₹100). UPI is
activated on the account, so the suspicion is a personal-account restriction on
recurring (UPI AutoPay) payments. A proper business account is needed for GST
invoicing (GS TECHNO / GSTIN) anyway.

**Old account:** personal, key prefix `rzp_live_Ti0DZ…`. **Do not delete it until
the new account's ₹5 loop passes** — it is the rollback path.

---

## A — On the NEW Razorpay account

- [x] A1. Business KYC (PAN + bank account) — **done** (new company bank account).
- [ ] A2. Confirm **recurring payments / UPI AutoPay** is enabled for the account
      (Settings → Recurring Charges). If the new account shows this blocked too,
      stop — the problem was never account-specific.
- [ ] A3. Create the plans — **do not hand-create the three tiers.** The single
      source of truth is `server/src/config/plans.ts`, and
      `server/scripts/sync-razorpay-plans.ts` creates exactly those amounts:

  | Plan | Amount incl. GST (₹/mo) | Created by |
  |---|---|---|
  | Starter | **17,699** | `sync-razorpay-plans.ts --live` |
  | Growth  | **41,299** | `sync-razorpay-plans.ts --live` |
  | Pro     | **70,799** | `sync-razorpay-plans.ts --live` |
  | Launch (test) | 5 | manual, only if you want the cheap loop |
  | Launch (legacy) | 7,999 | **not recreated** — no new ₹7,999 plan exists; existing LAUNCH subscribers stay on the OLD account until the map-to-STARTER migration |

  Run with the **new** keys in the environment:
  ```bash
  cd server
  npx tsx scripts/sync-razorpay-plans.ts            # dry-run: prints payloads, touches nothing
  npx tsx scripts/sync-razorpay-plans.ts --live     # creates plans, writes razorpay.plan-map.json
  npx tsx scripts/sync-razorpay-plans.ts --verify   # drift check: must show zero drift
  ```
  Annual plans are parked (no annual checkout yet).

- [ ] A4. Copy the new **live API key** (key id + secret). Never use Test mode.
- [ ] A5. Create the webhook:
      - URL: `https://leadbridge-zy4o.onrender.com/api/v1/webhooks/razorpay`
      - Events: `subscription.charged`, `subscription.cancelled`,
        `subscription.pending`, `payment.failed`, `invoice.paid`
      - Secret: generate fresh —
        `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
      - Live mode. The secret must match Render's `RAZORPAY_WEBHOOK_SECRET`.

## B — Update Render (leadbridge-api → Environment)

Set the vars, then **Manual Deploy**:

- [ ] B1. `RAZORPAY_KEY_ID` = new live key id
- [ ] B2. `RAZORPAY_KEY_SECRET` = new secret
- [ ] B3. `RAZORPAY_PLAN_STARTER` = new Starter plan id (₹17,699)
- [ ] B4. `RAZORPAY_PLAN_GROWTH` = new Growth plan id (₹41,299)
- [ ] B5. `RAZORPAY_PLAN_PRO` = new Pro plan id (₹70,799)
- [ ] B6. `RAZORPAY_PLAN_LAUNCH` = **legacy only.** No LAUNCH plan is created on the
      new account. Set it to the STARTER plan id only if a legacy Launch checkout path
      is still reachable; otherwise leave it unset.
- [ ] B7. `RAZORPAY_WEBHOOK_SECRET` = new webhook secret (must match A5)
- [ ] B8. Manual Deploy → wait for the deploy to finish

> **Signature verification is raw-byte correct (T8).** The `application/json`
> parser stores the exact bytes on `request.rawBody`, and the handler HMACs those
> — covered by `server/src/__tests__/razorpay-webhook.test.ts`. If a real delivery
> still returns 401, the secret is wrong, not the body handling.

## C — Verify the new wiring

- [ ] C1. `GET https://leadbridge-zy4o.onrender.com/health/razorpay` →
      `razorpayAuth.ok: true`, key prefix = the **new** prefix (not `rzp_live_Ti0DZ`).
- [ ] C2. `GET …/health/integrations` → `razorpay.missingVars: []`.
- [ ] C3. From repo root, signed webhook test (paste the new secret):
      ```
      RAZORPAY_WEBHOOK_SECRET=<new> node scripts/send-test-webhook.cjs
      ```
      → expect `HTTP 200`, and Render logs show `Razorpay webhook received`.
- [ ] C4. Same with `--bad-signature` → expect `HTTP 401`.
- [ ] C5. **Fresh browser session** (incognito; old Razorpay checkout state can
      interfere) → Dashboard → Billing → Upgrade Starter → Razorpay sheet opens
      at ₹17,699/mo.
- [ ] C6. **Prove UPI AutoPay works.** This is the test that failed on the old account.
      The Billing UI is three-tier now (no Launch card), so pick one:
      - **Cheap mandate test:** create a ₹5 plan + a subscription in the Razorpay
        dashboard itself and pay it via UPI AutoPay. That proves the mandate works
        without touching app data.
      - **Full app loop:** use **Growth** (₹41,299, charges immediately — Starter
        defers 30 days by design, so it cannot produce a PAID invoice on day 0).
        Refund it afterwards.
      - If it fails with the same "not allowed for this account" error → the
        problem is NOT account-specific. Check the failed payment's
        `error_source` / `error_step` in the Razorpay dashboard and record it here.
- [ ] C7. `node scripts/verify-money-loop.cjs --latest` → all checks pass:
      ACTIVE, subscription row, PAID invoice with GSTIN + GS TECHNO, Payment row
      with providerPaymentId, revenue incremented, PDF generated.
- [ ] C8. Cancel the test subscription from the dashboard → confirm refund lands
      (`verify-money-loop.cjs` shows refund fields). Dashboard → Billing → Cancel.

## D — Retire the old account

- [ ] D1. Starter/Growth/Pro now point at the new plans. No new ₹7,999 plan exists;
      set `RAZORPAY_PLAN_LAUNCH` as in B6 (or leave unset).
- [ ] D2. Open Billing → Upgrade Starter → sheet shows **₹17,699/mo**, first charge
      deferred 30 days (confirm `start_at` ≈ 30 days out in the Razorpay dashboard).
- [ ] D3. Sanity-check Growth checkout: sheet shows **₹41,299/mo** and charges now.
- [ ] D4. Old account: cancel/expire every subscription created there so nothing
      double-charges later. Close or leave dormant — do NOT delete before D5.
- [ ] D5. One more real checkout + webhook run against the new account to confirm
      nothing broke → then the old account can be retired.
- [ ] D6. Update `DAILY-WORK.md` (new key prefix, new plan IDs, webhook secret set,
      loop result).

---

## Done when

- [ ] New business account KYC'd, recurring/UPI AutoPay enabled, 3 tier plans created.
- [ ] All Render vars updated + deployed.
- [ ] `/health/razorpay` ok with the new key prefix.
- [ ] send-test-webhook → 200; bad-signature → 401.
- [ ] Real UPI AutoPay payment succeeds (the original blocker).
- [ ] `verify-money-loop.cjs --latest` all green.
- [ ] Billing sheets show ₹17,699 / ₹41,299 / ₹70,799.
- [ ] Old account neutralised (subs cancelled, not deleted).

> Return to `docs/GO-LIVE-RUNBOOK.md` Step 4 (SMS forwarding) after this.
