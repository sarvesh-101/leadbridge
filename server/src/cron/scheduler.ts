/**
 * Cron Job Scheduler — registers all scheduled tasks on server start.
 *
 * Uses node-cron to run jobs at specified intervals:
 * - No-show detection: Every 15 minutes
 * - Trial expiry check: Daily at 8:00 AM
 * - Monthly report: 1st of month at 6:00 AM
 * - Google Sheets sync: Every 15 minutes
 */
import cron from "node-cron";
import { logger } from "../utils/logger";
import { detectNoShows } from "./noshow-detector";
import { checkTrialExpiry } from "./trial-expiry";
import { generateMonthlyReports } from "./monthly-report";
import { runSheetsSync } from "./sheets-sync.cron";
import { runDataCleanup } from "./data-cleanup";
import { runMonthlyReset } from "./monthly-reset";
import { recoverPendingJobs } from "./redis-recovery";
import { runUsageAlerts } from "./usage-alerts";
import { runDunning } from "./dunning";
import { runRevenueRecognition } from "./revenue-recognition";

export function registerCronJobs() {
  logger.info("Registering cron jobs...");

  // ─── No-Show Detection — Every 15 minutes ──────────────────
  cron.schedule("*/15 * * * *", async () => {
    logger.info("Cron: Running no-show detection...");
    try {
      const result = await detectNoShows();
      logger.info({ processed: result.processed }, "Cron: No-show detection complete");
    } catch (error: any) {
      logger.error({ err: error.message }, "Cron: No-show detection failed");
    }
  });

  // ─── Trial Expiry Check — Daily at 8:00 AM ────────────────
  cron.schedule("0 8 * * *", async () => {
    logger.info("Cron: Checking trial expiry...");
    try {
      const result = await checkTrialExpiry();
      logger.info({ paused: result.paused, emailsSent: result.emailsSent }, "Cron: Trial expiry check complete");
    } catch (error: any) {
      logger.error({ err: error.message }, "Cron: Trial expiry check failed");
    }
  });

  // ─── Monthly Report — 1st of month at 6:00 AM ────────────
  cron.schedule("0 6 1 * *", async () => {
    logger.info("Cron: Generating monthly reports...");
    try {
      const result = await generateMonthlyReports();
      logger.info({ reportsGenerated: result.reportsGenerated }, "Cron: Monthly reports complete");
    } catch (error: any) {
      logger.error({ err: error.message }, "Cron: Monthly report generation failed");
    }
  });

  // ─── Google Sheets Sync — Every 15 minutes ────────────────
  cron.schedule("*/15 * * * *", async () => {
    logger.info("Cron: Running Google Sheets sync...");
    try {
      const result = await runSheetsSync();
      logger.info({ totalSynced: result.totalSynced, totalErrors: result.totalErrors }, "Cron: Sheets sync complete");
    } catch (error: any) {
      logger.error({ err: error.message }, "Cron: Sheets sync failed");
    }
  });

  // ─── Monthly Broker Credit Reset — 1st of month at 00:05 ───
  cron.schedule("5 0 1 * *", async () => {
    logger.info("Cron: Running monthly broker credit reset...");
    try {
      const result = await runMonthlyReset();
      logger.info(result, "Cron: Monthly credit reset complete");
    } catch (error: any) {
      logger.error({ err: error.message }, "Cron: Monthly credit reset failed");
    }
  });

  // ─── Redis Pending Job Recovery — Every 30 seconds ─────────
  cron.schedule("*/30 * * * * *", async () => {
    try {
      const result = await recoverPendingJobs();
      if (result.recovered > 0 || result.failed > 0) {
        logger.info({ recovered: result.recovered, failed: result.failed }, "Cron: Pending job recovery cycle");
      }
    } catch (error: any) {
      logger.error({ err: error.message }, "Cron: Pending job recovery failed");
    }
  });

  // ─── Weekly Data Cleanup — Every Sunday at 2:00 AM ────────
  cron.schedule("0 2 * * 0", async () => {
    logger.info("Cron: Running weekly data cleanup...");
    try {
      const result = await runDataCleanup();
      logger.info(result, "Cron: Data cleanup complete");
    } catch (error: any) {
      logger.error({ err: error.message }, "Cron: Data cleanup failed");
    }
  });

  // ─── Broker Usage Alerts — Every 6 hours ────────────────
  // FIX #4 (P1): Notify brokers at 80%/90%/100% usage
  cron.schedule("0 */6 * * *", async () => {
    logger.info("Cron: Running usage alerts...");
    try {
      const result = await runUsageAlerts();
      if (result.alertsSent > 0) {
        logger.info({ alertsSent: result.alertsSent }, "Cron: Usage alerts complete");
      }
    } catch (error: any) {
      logger.error({ err: error.message }, "Cron: Usage alerts failed");
    }
  });

  // ─── Dunning — Daily at 9:00 AM ──────────────────────────
  // FIX #5 (P1): Recover PAST_DUE accounts with 3-step sequence
  cron.schedule("0 9 * * *", async () => {
    logger.info("Cron: Running dunning...");
    try {
      const result = await runDunning();
      if (result.processed > 0) {
        logger.info(result, "Cron: Dunning cycle complete");
      }
    } catch (error: any) {
      logger.error({ err: error.message }, "Cron: Dunning failed");
    }
  });

  // ─── Revenue Recognition — Daily at 2:00 AM ──────────────
  // FIX #5 (P2): GAAP-compliant daily revenue recognition
  cron.schedule("0 2 * * *", async () => {
    logger.info("Cron: Running revenue recognition...");
    try {
      const { prisma } = await import("../utils/prisma-shared");
      const result = await runRevenueRecognition(prisma);
      if (result.entriesProcessed > 0) {
        logger.info(result, "Cron: Revenue recognition complete");
      }
    } catch (error: any) {
      logger.error({ err: error.message }, "Cron: Revenue recognition failed");
    }
  });

  logger.info("All cron jobs registered");
}
