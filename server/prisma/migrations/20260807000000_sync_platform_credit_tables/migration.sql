-- Migration: Sync schema drift — PlatformCredit/CreditTransaction tables,
-- RevenueStatus enum, Client financial columns, AccountingEntry FK/index fixes.
-- Generated from `prisma migrate diff` (migrations → schema).

-- CreateEnum
CREATE TYPE "RevenueStatus" AS ENUM ('DEFERRED', 'RECOGNIZED', 'REVERSED');

-- DropForeignKey
ALTER TABLE "AccountingEntry" DROP CONSTRAINT "fk_accounting_entry_client";

-- DropForeignKey
ALTER TABLE "AccountingEntry" DROP CONSTRAINT "fk_accounting_entry_invoice";

-- DropIndex
DROP INDEX "Lead_phone_clientscope_idx";

-- AlterTable
ALTER TABLE "AccountingEntry" DROP COLUMN "status",
ADD COLUMN     "status" "RevenueStatus" NOT NULL DEFAULT 'DEFERRED',
ALTER COLUMN "periodStart" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "periodEnd" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "lastRecognizedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "fullyRecognizedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "reversedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "totalCostIncurred" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalRevenueGenerated" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "invoicePdfGeneratedAt" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlatformCredit" (
    "id" TEXT NOT NULL,
    "totalMinutesPurchased" INTEGER NOT NULL DEFAULT 0,
    "minutesUsed" INTEGER NOT NULL DEFAULT 0,
    "costPerMinute" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "phoneNumbersActive" INTEGER NOT NULL DEFAULT 0,
    "costPerPhoneMonthly" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "billingMonth" TEXT NOT NULL DEFAULT '',
    "lastRechargedAt" TIMESTAMP(3),
    "alertThresholdPercent" INTEGER NOT NULL DEFAULT 20,
    "lastAlertSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "minutes" INTEGER NOT NULL,
    "description" TEXT,
    "clientId" TEXT,
    "callId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformCredit_billingMonth_key" ON "PlatformCredit"("billingMonth");

-- CreateIndex
CREATE INDEX "CreditTransaction_createdAt_idx" ON "CreditTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "CreditTransaction_type_idx" ON "CreditTransaction"("type");

-- CreateIndex
CREATE INDEX "CreditTransaction_clientId_idx" ON "CreditTransaction"("clientId");

-- CreateIndex
CREATE INDEX "AccountingEntry_status_idx" ON "AccountingEntry"("status");

-- AddForeignKey
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
