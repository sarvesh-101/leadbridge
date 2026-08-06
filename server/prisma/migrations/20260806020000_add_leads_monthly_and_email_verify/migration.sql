-- FIX Round-2 #6: monthly leads cap counter (reset with billing cycle)
ALTER TABLE "Client" ADD COLUMN "leadsThisMonth" INTEGER NOT NULL DEFAULT 0;

-- FIX Round-2 #3: email verification for trial-abuse protection
ALTER TABLE "Client" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN "verificationToken" TEXT;
ALTER TABLE "Client" ADD COLUMN "verificationTokenExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Client_verificationToken_key" ON "Client"("verificationToken");
