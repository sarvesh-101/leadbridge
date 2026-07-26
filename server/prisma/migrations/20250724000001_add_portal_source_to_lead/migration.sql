-- Add portalSource to Lead model (detected portal from SMS/email forwarding)
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "portalSource" TEXT;
