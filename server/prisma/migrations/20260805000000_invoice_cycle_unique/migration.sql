-- LeadBridge: Harden invoice idempotency at the DB layer (FIX #9 follow-up)
--
-- ensureInvoiceForCycle() does check-then-create, which is theoretically racy
-- under concurrent webhook delivery (redelivered subscription.charged +
-- invoice.paid for the same charge could both pass the findFirst guard and
-- create duplicate invoices). This partial unique index makes the invariant
-- "one billable invoice per (client, subscription, billing cycle)" DB-enforced.
--
-- Why partial (WHERE status <> 'REFUNDED'):
--   The cancel/refund flow intentionally creates a REFUNDED credit note that
--   reuses the paid invoice's periodStart (periodEnd = now). A full unique
--   index would reject that legitimate row. Excluding REFUNDED keeps credit
--   notes legal while still blocking duplicate SENT/PAID invoices for a cycle.
--
-- NULL periodStart (e.g. overage invoices) are naturally distinct under
-- Postgres unique-index semantics, so they never collide.
--
-- Deployment note: partial indexes can't be expressed in schema.prisma, so
-- `prisma db push` will NOT create this. It lands via `prisma migrate deploy`
-- (the Railway deploy script). If the Invoice table already contains duplicate
-- (clientId, subscriptionId, periodStart) non-REFUNDED rows, this migration
-- will fail — dedupe those rows before deploying.

CREATE UNIQUE INDEX "Invoice_clientId_subscriptionId_periodStart_unique"
ON "Invoice"("clientId", "subscriptionId", "periodStart")
WHERE "status" <> 'REFUNDED';
