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

  logger.info("All cron jobs registered");
}
