-- Migration: Add Lead.otpAttempts, Booking.reminderJobId, PendingJob model, and CHECK constraints
-- Tier 3 Reliability fixes

-- 1. Add otpAttempts to Lead
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "otpAttempts" INTEGER NOT NULL DEFAULT 0;

-- 2. Add reminderJobId to Booking
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "reminderJobId" TEXT;

-- 3. Create PendingJob table for Redis fallback
CREATE TABLE IF NOT EXISTS "PendingJob" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "jobData" JSONB NOT NULL,
    "jobId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "delayMs" INTEGER NOT NULL DEFAULT 0,
    "processAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PendingJob_queue_status_idx" ON "PendingJob"("queue", "status");
CREATE INDEX IF NOT EXISTS "PendingJob_processAt_idx" ON "PendingJob"("processAt");

-- 4. CHECK constraints for lead status consistency
-- Prevent BOOKED status without bookingId
ALTER TABLE "Lead" ADD CONSTRAINT "lead_booked_has_booking"
    CHECK (
        status NOT IN ('BOOKED', 'REMINDED', 'REBOOKED') 
        OR "bookingId" IS NOT NULL
    );

-- Prevent VISITED without visitedAt
ALTER TABLE "Lead" ADD CONSTRAINT "lead_visited_has_timestamp"
    CHECK (
        status != 'VISITED' 
        OR "visitedAt" IS NOT NULL
    );

-- Prevent CONVERTED without convertedAt
ALTER TABLE "Lead" ADD CONSTRAINT "lead_converted_has_timestamp"
    CHECK (
        status != 'CONVERTED' 
        OR "convertedAt" IS NOT NULL
    );

-- 5. CHECK constraint for booking status consistency
-- Prevent VISITED without visitedAt
ALTER TABLE "Booking" ADD CONSTRAINT "booking_visited_has_timestamp"
    CHECK (
        status != 'VISITED' 
        OR "visitedAt" IS NOT NULL
    );

-- 6. CHECK constraint for valid enum relationships
-- A cancelled booking should have no ACTIVE reminder jobs.
-- Uses reminderJobId (the scheduled BullMQ job reference) not reminderSentAt
-- (the timestamp of when the reminder was actually dispatched), because
-- a cancelled booking might have had its reminder sent earlier in the day.
ALTER TABLE "Booking" ADD CONSTRAINT "booking_cancelled_no_reminder"
    CHECK (
        status != 'CANCELLED' 
        OR "reminderJobId" IS NULL
    );
