-- Two "Client" columns are declared in schema.prisma but were never created by a
-- migration. They exist on the current production database (added out-of-band), so
-- nothing failed there — but every fresh database, notably CI's E2E service
-- container, hit P2022 on prisma.client.create() and seven lead-lifecycle tests
-- cascaded into "record not found" / foreign-key errors.
--
-- Both statements are idempotent, so this is a no-op on a database that already
-- has the columns.

-- Omnidimension call-transfer target (schema.prisma: Client.transferToNumber).
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "transferToNumber" TEXT;

-- Agent languages for the voice agent (schema.prisma: Client.languages).
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "languages" TEXT[] NOT NULL DEFAULT ARRAY['hinglish', 'English']::TEXT[];
