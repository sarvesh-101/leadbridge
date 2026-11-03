-- V2 (T2): leads-handled metering + fair-use caps.
-- Additive only: new columns + two new enum values. Nothing dropped or renamed.

ALTER TABLE "Client" ADD COLUMN "prepaidLeads" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Lead" ADD COLUMN "answeredSecondsThisCycle" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lead" ADD COLUMN "fairUseCappedAt" TIMESTAMP(3);

-- NOTE (Postgres): ALTER TYPE ... ADD VALUE cannot run inside the transaction
-- that prisma migrate wraps by default on older PG; PG 12+ allows it as long
-- as the new value is not used later in the same statement block.
ALTER TYPE "LeadStatus" ADD VALUE 'FAIR_USE_CAP';
ALTER TYPE "LeadStatus" ADD VALUE 'QUEUED_WAITING_CREDITS';
