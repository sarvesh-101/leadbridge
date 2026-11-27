-- "Client"."languages" is declared in schema.prisma (String[] with a default) but
-- no migration ever created it. On any fresh database — notably CI's E2E service
-- container — prisma.client.create() fails with P2022 and every lead test cascades
-- into "record not found" / foreign-key errors. Idempotent, so it is also safe on a
-- database where the column was added out-of-band with `prisma db push`.
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "languages" TEXT[] NOT NULL DEFAULT ARRAY['hinglish', 'English']::TEXT[];
