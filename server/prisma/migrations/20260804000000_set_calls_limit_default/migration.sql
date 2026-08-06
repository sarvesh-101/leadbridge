-- Align Client.callsLimit default with Growth plan definition (500 calls).
-- The old default of 300 matched the outdated marketing number; the plan
-- definitions in src/routes/client/billing.ts (PLAN_DEFINITIONS.GROWTH.calls = 500)
-- are the source of truth.

ALTER TABLE "Client" ALTER COLUMN "callsLimit" SET DEFAULT 500;
