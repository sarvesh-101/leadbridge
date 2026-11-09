-- V2 (T9–T17) — additive migration. No columns, tables or enum values dropped.
-- Reversible at the schema level: every statement here only ADDS.

-- ─── T5: first-call delay measurement ───────────────────────────────────────
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "answeredAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "firstCallDelaySeconds" INTEGER;

-- ─── T13: micro-market zones + business verification ───────────────────────
ALTER TABLE "Territory" ADD COLUMN IF NOT EXISTS "zoneType" TEXT NOT NULL DEFAULT 'MICRO_MARKET';
ALTER TABLE "Territory" ADD COLUMN IF NOT EXISTS "pinCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Territory" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "Territory" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "Territory_status_idx" ON "Territory"("status");

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "reraNumber" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "businessProofRef" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "inboundToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Client_inboundToken_key" ON "Client"("inboundToken");

-- ─── T15: onboarding speed instrumentation ─────────────────────────────────
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "signupAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "firstLeadSourceConnectedAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "firstCallAt" TIMESTAMP(3);

-- ─── T11: weekly proof snapshots ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WeeklyBrokerMetric" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "weekEnd" TIMESTAMP(3) NOT NULL,
  "leadsReceived" INTEGER NOT NULL,
  "medianFirstCallSeconds" INTEGER,
  "reachRate" DOUBLE PRECISION NOT NULL,
  "qualifiedRate" DOUBLE PRECISION NOT NULL,
  "visitsBooked" INTEGER NOT NULL,
  "visitsCompleted" INTEGER NOT NULL,
  "costPerCompletedVisit" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyBrokerMetric_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyBrokerMetric_clientId_weekStart_key"
  ON "WeeklyBrokerMetric"("clientId", "weekStart");
CREATE INDEX IF NOT EXISTS "WeeklyBrokerMetric_weekStart_idx" ON "WeeklyBrokerMetric"("weekStart");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyBrokerMetric_clientId_fkey'
  ) THEN
    ALTER TABLE "WeeklyBrokerMetric"
      ADD CONSTRAINT "WeeklyBrokerMetric_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill: new signupAt mirrors createdAt for existing rows.
UPDATE "Client" SET "signupAt" = "createdAt" WHERE "signupAt" IS NULL;
