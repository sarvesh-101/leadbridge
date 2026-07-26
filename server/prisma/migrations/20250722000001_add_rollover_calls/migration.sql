-- Add rolloverCalls column to Client table for monthly credit rollover
-- Rollover: unused calls from previous months, capped at 3x the plan's callsLimit
ALTER TABLE "Client" ADD COLUMN "rolloverCalls" INTEGER NOT NULL DEFAULT 0;
