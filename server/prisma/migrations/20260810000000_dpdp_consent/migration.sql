-- DPDP (India DPDP Act 2023) — Phase 1.3
-- Consent tracking + data erasure request fields for Client accounts.

ALTER TABLE "Client"
  ADD COLUMN "consentGivenAt" TIMESTAMP(3),
  ADD COLUMN "consentVersion" TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN "dataErasureRequestedAt" TIMESTAMP(3),
  ADD COLUMN "dataErasureProcessedAt" TIMESTAMP(3);
