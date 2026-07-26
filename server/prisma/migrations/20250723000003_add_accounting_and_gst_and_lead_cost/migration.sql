-- Add platformCost to Lead model
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "platformCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Add GST fields to Invoice model
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "gstPercentage" DOUBLE PRECISION NOT NULL DEFAULT 18;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "taxableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "invoicePdfUrl" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "invoicePdfGeneratedAt" TIMESTAMPTZ;

-- Create AccountingEntry model for revenue recognition
CREATE TABLE IF NOT EXISTS "AccountingEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DEFERRED',
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "recognizedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deferredAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMPTZ NOT NULL,
    "periodEnd" TIMESTAMPTZ NOT NULL,
    "totalDays" INTEGER NOT NULL DEFAULT 30,
    "dailyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "daysRecognized" INTEGER NOT NULL DEFAULT 0,
    "lastRecognizedAt" TIMESTAMPTZ,
    "fullyRecognizedAt" TIMESTAMPTZ,
    "reversedAt" TIMESTAMPTZ,
    "reversalReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_accounting_entry_client FOREIGN KEY ("clientId") REFERENCES "Client"("id"),
    CONSTRAINT fk_accounting_entry_invoice FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
);

-- Create indexes for AccountingEntry
CREATE INDEX IF NOT EXISTS "AccountingEntry_clientId_idx" ON "AccountingEntry"("clientId");
CREATE INDEX IF NOT EXISTS "AccountingEntry_status_idx" ON "AccountingEntry"("status");
CREATE INDEX IF NOT EXISTS "AccountingEntry_periodStart_idx" ON "AccountingEntry"("periodStart");
