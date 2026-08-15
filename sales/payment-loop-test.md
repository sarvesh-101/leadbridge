# 🔁 Phase 2.3 — Full Payment-Loop Test Spec (ready to run after 0.1 deploy)

> **When:** run against the **production Railway backend + live Razorpay** the moment
> Phase 0.1 is deployed. This is the money path — trial → checkout → real charge →
> webhook → invoice → cancel/refund. Use a throwaway broker account + a real (small)
> payment; refund it at the end.
> **Owner:** Sarvesh. **Time:** ~20 minutes. **Cost:** a real ₹35,000 charge that
> gets refunded (no net cost, but the bank float takes a few days).

---

## 0. Preconditions (verify before starting)

- [ ] `RAZORPAY_KEY_ID` / `KEY_SECRET` / `WEBHOOK_SECRET` set in prod env
- [ ] `RAZORPAY_PLAN_STARTER/GROWTH/PRO` = real **live** plan IDs
- [ ] Razorpay webhook configured for **`/api/v1/webhooks/razorpay`** with events:
      `subscription.charged`, `subscription.cancelled`, `payment.failed`, `invoice.paid`
- [ ] `RAZORPAY_WEBHOOK_SECRET` in prod env matches the webhook secret in the dashboard
- [ ] Email works (SMTP) so the trial/broker gets their invoice email
- [ ] Test broker account created (use a real phone + a disposable email you control)

## 1. Trial (STARTER)

1. Register a new broker on the live site (`/auth/register`).
2. Verify email → login.
3. Go to `/dashboard` → billing → **Start 14-day trial** (STARTER).
4. **Assert:** plan card shows "Trial", calls = 100, no charge happened yet.
5. Check DB (via admin panel): `Subscription.status = TRIAL`, `client.planStatus = TRIAL`, `trialStartedAt` set.

## 2. Checkout (GROWTH — the popular plan)

1. From billing, pick **GROWTH** → checkout.
2. **Assert:** Razorpay hosted page opens (`payment_url` from `POST /subscriptions`).
3. Pay with a **real card/UPI** (any amount will do — it's refunded later).
4. Return to site → billing page.

## 3. Webhook → activation + invoice (the critical part)

Within ~10 seconds of payment, the webhook fires. **Assert ALL of these:**

- [ ] `client.planStatus` → `ACTIVE`
- [ ] `Subscription.status` → `ACTIVE`, `providerSubscriptionId` = `sub_...`
- [ ] A **SENT invoice** exists for this cycle → flips to **PAID** (`paidAt` set)
- [ ] A **Payment** row exists (`providerPaymentId` = `pay_...`), revenue incremented
- [ ] **GST invoice PDF** generated (invoice service hook — check `server/invoices/`)
- [ ] Email received with the paid invoice
- [ ] No 500s in server logs; webhook returned `{ status: "received" }`

> **First-charge quirk:** the very first `subscription.charged` does NOT reset the
> call cycle (trial→paid conversion skips the rollover). Renewals (month 2+) DO
> reset. Verify: after this charge, `callsThisMonth` stays as-is, `rolloverCalls`
> unchanged. The renewal test below covers the reset.

## 4. Renewal simulation (month-2+ behavior — optional but recommended)

The cleanest way without waiting 30 days: use the **Razorpay dashboard → Subscription →
Charge** button to trigger an early renewal charge, then assert:

- [ ] A **new invoice** for the renewal cycle is generated (FIX #9 `ensureInvoiceForCycle`)
- [ ] Invoice flips to PAID; a **second Payment row** exists (no double-count)
- [ ] **Call cycle reset** happened: `callsThisMonth` → 0, unused rolled into `rolloverCalls`
- [ ] No duplicate invoices when the webhook is redelivered (idempotency guard)

## 5. Cancel + refund

1. Cancel the subscription (site billing → cancel, or Razorpay dashboard).
2. **Assert:** `Subscription.status` → `CANCELLED`, `client.planStatus` → `CANCELLED`
   (via `subscription.cancelled` webhook).
3. Refund the last payment in Razorpay dashboard.
4. **Assert:** refund shows in Razorpay; `Payment` row(s) unchanged (we don't hard-delete
   payment history — note this is expected).

## 6. Failure-path checks (quick)

- [ ] Try checkout with a **declined card** → `payment.failed` webhook logged, no
      activation, `planStatus` stays TRIAL.
- [ ] Send a **forged** webhook (bad signature) → API returns 401, nothing changes.
- [ ] Double-submit the same webhook payload → no duplicate invoice/Payment rows.

## 7. Teardown

- [ ] Refund the GROWTH charge (if not already) — confirm the float clears
- [ ] Delete the throwaway broker account + data (use Settings → Privacy & Data → erasure — dogfood the DPDP flow from Phase 1.3!)
- [ ] Note the refund in work-log with dates (bank float 3–7 days)

## 8. Sign-off

Check the boxes + paste the server log lines (webhook received / invoice PAID /
cycle reset) into the work-log. Phase 2.3 is then ✅ and Phase 4 (soft launch) is
unblocked on the money side.

---

**Related code:** `server/src/services/subscription.service.ts` (checkout),
`server/src/routes/webhooks/razorpay.ts` (charged/cancelled/failed/paid + renewal
invoices + revenue), `server/src/services/razorpay.service.ts` (webhook sig verify).
Unit coverage already exists in `server/src/__tests__/subscription-checkout.test.ts`
and `razorpay-webhook.test.ts` — this doc is the **live end-to-end** pass.
