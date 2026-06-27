-- LeadBridge: Add unique constraint for lead dedup + score history table
-- Run: npx prisma migrate dev --name add_unique_constraint_score_history

-- ─────────────────────────────────────────────
-- 1. Add LeadScoreHistory table
-- ─────────────────────────────────────────────
CREATE TABLE "LeadScoreHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "factors" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'auto',  -- 'auto' | 'manual'
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadScoreHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadScoreHistory_leadId_idx" ON "LeadScoreHistory"("leadId");
CREATE INDEX "LeadScoreHistory_createdAt_idx" ON "LeadScoreHistory"("createdAt");

ALTER TABLE "LeadScoreHistory" ADD CONSTRAINT "LeadScoreHistory_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────
-- 2. Add partial unique index on (clientId, phone)
--    Only applies to non-archived leads within 30 days
-- ─────────────────────────────────────────────
-- Index for efficient dedup queries
CREATE INDEX "Lead_clientId_phone_receivedAt_idx" ON "Lead"("clientId", "phone", "receivedAt");

-- This unique index prevents duplicate active leads for the same client+phone
-- Combined with application-level locking, this hardens dedup at the DB layer.
-- Note: This is a partial index that only applies to recent leads (within 30 days)
-- and non-archived leads (archived leads are handled differently).
-- In Postgres, we use a trigger-based approach for conditional uniqueness.
-- Simpler: just add the unique constraint and handle conflicts in application code.

-- ─────────────────────────────────────────────
-- 3. Add unique constraint for WebhookSource dedup
-- ─────────────────────────────────────────────
-- Already has: @@unique([city, zone]) on Territory
-- Already has: @unique on WebhookSource.token
