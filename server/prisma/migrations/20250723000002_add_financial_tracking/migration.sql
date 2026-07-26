-- Migration: Add financial tracking fields to Client model
-- trial-to-paid conversion, phone cost attribution, usage alerts, dunning

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "trialStartedAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "convertedFromTrialAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "phoneCostMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "lastUsageAlertSentAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "usageAlertLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "dunningStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "dunningStartedAt" TIMESTAMP(3);
