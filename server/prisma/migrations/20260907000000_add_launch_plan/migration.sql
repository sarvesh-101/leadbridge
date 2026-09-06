-- Add LAUNCH plan (entry tier, ₹7,999/mo, 50 calls) to the Plan enum.
-- Safe on PG 12+: ADD VALUE in a transaction is allowed as long as the new
-- value is not used within the same transaction (we only add it here).
ALTER TYPE "Plan" ADD VALUE 'LAUNCH';
