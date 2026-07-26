-- Add database index on Lead.phone for faster dedup lookups
-- Used by: POST /leads (manual creation), webhook ingestion, CSV import
-- Without this, phone-number dedup queries do full table scans

CREATE INDEX IF NOT EXISTS "Lead_phone_clientscope_idx" ON "Lead"("clientId", "phone");
