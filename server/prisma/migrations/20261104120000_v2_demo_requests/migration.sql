-- V2 (T6): public demo funnel storage. Additive only.
CREATE TABLE "DemoRequest" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "otpHash" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "leadId" TEXT,
    "calledAt" TIMESTAMP(3),
    "ip_addr" TEXT,
    "userAgent" TEXT,
    "honeypot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DemoRequest_phone_idx" ON "DemoRequest"("phone");
CREATE INDEX "DemoRequest_createdAt_idx" ON "DemoRequest"("createdAt");
