-- Add lastCycleResetAt to Client for idempotent billing-cycle resets (FIX Round-2 #5)
ALTER TABLE "Client" ADD COLUMN "lastCycleResetAt" TIMESTAMP(3);
