-- V2 (T7): platform low-credit auto-pause flag. Additive only.
ALTER TABLE "PlatformCredit" ADD COLUMN "dispatchPaused" BOOLEAN NOT NULL DEFAULT false;
