-- Add prepaidCalls to Client model (purchased call credits, never expire)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "prepaidCalls" INTEGER NOT NULL DEFAULT 0;

-- Add payment tracking fields to Invoice model
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;
