-- P2 LOOP FIX: unique index on Payment.providerPaymentId.
--
-- The Razorpay webhook records a Payment + revenue increment on BOTH
-- subscription.charged and invoice.paid when a payment entity is present. The
-- code guards with a findFirst on providerPaymentId, but that is check-then-create:
-- two near-simultaneous webhook events (Razorpay emits both for the same charge)
-- can race past the guard and double-count revenue.
--
-- Step 1: remove any pre-existing duplicates (keep the earliest row — the later
-- duplicates are the ones whose revenue was double-counted in
-- client.totalRevenueGenerated; the subscription-charged-vs-invoice-paid pairing
-- makes the earlier row the authoritative one).
-- Note: totalRevenueGenerated is deliberately NOT rolled back here — the
-- duplicates in production data (if any) are unknown in amount, and the admin
-- cost analysis tolerates a small history error far better than a live migration
-- that touches client balances. New duplicates are now impossible.
--
-- Step 2: create the unique index (plain, matching the Prisma @unique —
-- PostgreSQL allows many NULLs in a unique index, so offline/manual payments
-- without a provider id are unaffected).

DELETE FROM "Payment" p
USING "Payment" q
WHERE p."providerPaymentId" = q."providerPaymentId"
  AND p."providerPaymentId" IS NOT NULL
  AND p.id <> q.id
  AND (
    p."createdAt" > q."createdAt"
    OR (p."createdAt" = q."createdAt" AND p.id > q.id)
  );

CREATE UNIQUE INDEX "Payment_providerPaymentId_key"
ON "Payment"("providerPaymentId");
