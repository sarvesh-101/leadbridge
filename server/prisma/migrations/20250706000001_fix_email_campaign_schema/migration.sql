-- Add missing columns to EmailCampaign
ALTER TABLE "EmailCampaign" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'EMAIL';
ALTER TABLE "EmailCampaign" ADD COLUMN IF NOT EXISTS "openedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailCampaign" ADD COLUMN IF NOT EXISTS "clickedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailCampaign" ADD COLUMN IF NOT EXISTS "abTestEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EmailCampaign" ADD COLUMN IF NOT EXISTS "abTestData" JSONB NOT NULL DEFAULT '{}';

-- Create EmailTrackingEvent table
CREATE TABLE IF NOT EXISTS "EmailTrackingEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "leadId" TEXT,
    "leadName" TEXT,
    "event" TEXT NOT NULL,
    "url" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailTrackingEvent_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "EmailTrackingEvent_campaignId_idx" ON "EmailTrackingEvent"("campaignId");
CREATE INDEX IF NOT EXISTS "EmailTrackingEvent_campaignId_event_idx" ON "EmailTrackingEvent"("campaignId", "event");

-- Add foreign key
ALTER TABLE "EmailTrackingEvent" ADD CONSTRAINT "EmailTrackingEvent_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
