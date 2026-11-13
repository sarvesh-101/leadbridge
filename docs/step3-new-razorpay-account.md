# Step 3 — New Razorpay account migration + ₹5 money loop test

**STATUS (2026-11-13): the new business account is ACTIVE (owner-confirmed) and its
live keys + all six plans are VERIFIED against the API — A1–A4 done. Resume at A2
(dashboard: confirm UPI AutoPay enabled), then A5, then B1–B8 on Render, then C1–C8.**

---

## ▶ DO THIS NOW — ordered cutover (A1–A4 already done)

**Verified live 2026-11-13:** the new account's keys authenticate and all six
plans match `server/src/config/plans.ts` exactly (`--verify` exit 0). What is
left is dashboard work plus the real charge. Budget ~20 minutes.

### Phase 1 — Render environment (5 min)

1. Razorpay dashboard → **Account & Settings → API Keys** → copy the **Live** key
   id + secret. (Never Test mode — plans above are live.)
2. Razorpay dashboard → **Settings → Recurring Charges** → confirm recurring /
   UPI AutoPay is **enabled** (this is A2, the original blocker). A correct plan
   list proves nothing about mandates — only this setting does.
3. Render → `leadbridge-api` → **Environment** → set exactly these six and leave
   `RAZORPAY_PLAN_LAUNCH` **unset**:

   | Variable | Value |
   |---|---|
   | `RAZORPAY_KEY_ID` | new live key id (`rzp_live_TzZ…`) |
   | `RAZORPAY_KEY_SECRET` | new live key secret |
   | `RAZORPAY_WEBHOOK_SECRET` | the value generated this session, or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `RAZORPAY_PLAN_STARTER` | `plan_TzZx6AnyZg1COc` |
   | `RAZORPAY_PLAN_GROWTH` | `plan_TzZx6i9gxjn14t` |
   | `RAZORPAY_PLAN_PRO` | `plan_TzZx7HGbGReXSR` |

   Plan IDs come from `server/razorpay.plan-map.json` (secret-free, safe to
   commit). Copy from there or from this table — never from the old dashboard.
4. **Manual Deploy** → wait for **Live**. Environment changes do not apply until
   the service restarts with them.

### Phase 2 — Webhook (2 min)

5. Razorpay dashboard → **Settings → Webhooks → Add Webhook**.
   - URL: `https://leadbridge-zy4o.onrender.com/api/v1/webhooks/razorpay`
   - Secret: **identical** to Render's `RAZORPAY_WEBHOOK_SECRET` (a mismatch =
     every real event 401s and clients never activate).
   - Events — all seven: `subscription.charged`, `subscription.cancelled`,
     `subscription.pending`, `subscription.halted`, `subscription.completed`,
     `payment.failed`, `invoice.paid`.

### Phase 3 — Wiring verification (2 min)

6. `GET https://leadbridge-zy4o.onrender.com/health/razorpay` →
   `{"razorpayAuth":{"ok":true,"keyIdPrefix":"rzp_live_TzZts"}}`.
   Still `Ti0DZ` = the Render vars were not saved / not deployed.
7. `GET …/health/integrations` → `razorpay.missingVars` empty. On the current
   T8 build expect exactly `["RAZORPAY_PLAN_LAUNCH"]` — expected until
   `converza-v2` deploys; any other entry is a real gap.
8. Signed webhook, from the repo root:
   ```
   RAZORPAY_WEBHOOK_SECRET=<render value> node scripts/send-test-webhook.cjs
   ```
   Expect **HTTP 200** and **PASS** (exit 0). The script now exits non-zero on a
   failed check, so treat any non-zero exit as a real failure.
9. Enforcement:
   ```
   RAZORPAY_WEBHOOK_SECRET=<render value> node scripts/send-test-webhook.cjs subscription.cancelled --bad-signature
   ```
   Expect **HTTP 401** and **PASS** (exit 0). A 200 here means signature checking
   is off — stop before any real payment.
10. Render logs: `Razorpay webhook received { eventType: 'subscription.charged' }`.
    No log line with a 200 means the URL is hitting something else — confirm it
    is exactly `https://…/api/v1/webhooks/razorpay`, no trailing slash.

### Phase 4 — Real money loop (10 min)

11. **Cheap mandate proof first** (no app data touched): in the Razorpay dashboard
    create a ₹5 plan + a subscription to it and pay via **UPI AutoPay**. This is
    the exact action that failed on the old account. If it fails with "Payment is
    not allowed for this account", stop — A2 is not actually enabled.
12. **Full app loop:** fresh incognito → log in → **Billing → Upgrade Growth**
    (₹41,299/mo; charges immediately, unlike Starter which defers 30 days and
    therefore cannot produce a PAID invoice today). Sheet opens → pay.
    Client must flip to **ACTIVE** within ~30 s (the webhook does that).
13. `node scripts/verify-money-loop.cjs --latest` → all green: ACTIVE,
    subscription row, PAID invoice with GSTIN + "GS TECHNO", Payment row with
    `providerPaymentId`, revenue incremented, invoice PDF generated.
14. `node scripts/verify-money-loop.cjs <email>` if `--latest` picks the wrong
    row.
15. **Cancel + refund:** Billing → Cancel. Expect a pro-rated refund executed via
    Razorpay (`executed: true`) and the Payment row marked REFUNDED with
    `refundId`. A cancel that returns 502 means Razorpay refused — the local sub
    stays ACTIVE on purpose, so retry rather than assume it worked.
16. Erase/clean the test account from the admin panel (DPDP).

### Phase 5 — Retire the old account (5 min, after Phase 4 passes)

17. Old Razorpay account: cancel/expire **every** subscription created there so
    nothing double-charges. Do **not** delete the account yet.
18. One more real checkout on the new account to confirm stability, then the old
    account can stay dormant or be closed.
19. Record in `DAILY-WORK.md`: new key prefix, plan IDs, webhook secret set,
    money-loop + refund result (that is D6).
20. **Rotate the key pair** — it was pasted into chat during this migration.
    Regenerate in the dashboard, update Render, Manual Deploy, re-run step 6.

### If something fails

| Symptom | Cause | Fix |
|---|---|---|
| `/health/razorpay` still `Ti0DZ` | env not saved, or no restart | save + Manual Deploy |
| Signed webhook 200 but real events 401 | dashboard secret ≠ Render secret | re-paste in both, redeploy |
| Checkout says "payment required manually" | that tier's plan ID empty | set the missing `RAZORPAY_PLAN_*` |
| Razorpay rejects "Invalid plan id" | old-account plan ID pasted | copy from `razorpay.plan-map.json` |
| "Payment is not allowed for this account" | UPI AutoPay not enabled | fix A2 first |
| Invoice shows ₹18,000 / ₹35,000 / ₹60,000 | old price list cached | should be impossible — prices come from `config/plans.ts`; re-check the deploy |

---

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
- [x] A3. Create the plans — **do not hand-create the three tiers.** The single
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

  **Verified 2026-11-13 with the new account's live keys** — `--verify` printed
  all six rows and `All plan amounts verified ✓` (exit 0). These are the IDs B3–B5
  must use; do not copy IDs from the old account.

  | Tier | Monthly | Plan ID | Annual | Plan ID |
  |---|---|---|---|---|
  | Starter | ₹17,699 | `plan_TzZx6AnyZg1COc` | ₹1,76,988 | `plan_TzZx6S5zR1aDI8` |
  | Growth | ₹41,299 | `plan_TzZx6i9gxjn14t` | ₹4,12,988 | `plan_TzZx74cmsBPy79` |
  | Pro | ₹70,799 | `plan_TzZx7HGbGReXSR` | ₹7,07,988 | `plan_TzZx7U919rjaVt` |

  The map is written to `server/razorpay.plan-map.json` (no secrets — safe to commit).

- [x] A4. Copy the new **live API key** (key id + secret). Never use Test mode.
      Confirmed by the same `--verify` run: the pair authenticates (key prefix
      `rzp_live_TzZ…`).
- [ ] A5. Create the webhook:
      - URL: `https://leadbridge-zy4o.onrender.com/api/v1/webhooks/razorpay`
      - Events: `subscription.charged`, `subscription.cancelled`,
        `subscription.pending`, `subscription.halted`, `subscription.completed`,
        `payment.failed`, `invoice.paid`
        (all SEVEN are handled by the route; omitting `halted`/`completed`
        leaves a halted/unpaid client ACTIVE in our DB and still calling)
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

> **`render.yaml` no longer hardcodes plan IDs (2026-11-13).** The committed
> values (`plan_TLa2…`) were created on the OLD account, so a blueprint sync
> could have pointed production back at old-account plans mid-migration. All
> four `RAZORPAY_PLAN_*` entries are now `sync: false` — the IDs live only in
> the Render dashboard, taken from `sync-razorpay-plans.ts --live` output.
> `scripts/setup-razorpay.cjs` is disabled for the same reason: it still had
> the retired ₹18,000/₹35,000/₹60,000 prices and would create wrong-amount
> plans on the new account.

> **Signature verification is raw-byte correct (T8).** The `application/json`
> parser stores the exact bytes on `request.rawBody`, and the handler HMACs those
> — covered by `server/src/__tests__/razorpay-webhook.test.ts`. If a real delivery
> still returns 401, the secret is wrong, not the body handling.

## C — Verify the new wiring

- [ ] C1. `GET https://leadbridge-zy4o.onrender.com/health/razorpay` →
      `razorpayAuth.ok: true`, key prefix = the **new** prefix (not `rzp_live_Ti0DZ`).
- [ ] C2. `GET …/health/integrations` → `razorpay.missingVars: []`.
      > C2 can now actually pass: `/health/integrations` no longer requires
      > `RAZORPAY_PLAN_LAUNCH` (retired — this account has no plan for it). Only
      > the key pair + the three sellable tiers are required, so an empty list
      > means those three are genuinely wired.
      >
      > Until this branch (`converza-v2`) deploys, production still runs T8
      > (`3b5a273`), whose code DOES list LAUNCH — so during the cutover expect
      > `missingVars: ["RAZORPAY_PLAN_LAUNCH"]` and nothing else. That single
      > entry is expected, not a failure.
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
