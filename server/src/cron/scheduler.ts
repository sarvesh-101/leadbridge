/**
 * Cron Job Scheduler — registers all scheduled tasks on server start.
 *
 * Uses node-cron to run jobs at specified intervals:
 * - No-show detection: Every 15 minutes
 * - Trial expiry check: Daily at 8:00 AM
 * - Monthly report: 1st of month at 6:00 AM
 * - Google Sheets sync: Every 15 minutes
 *
 * Every job is wrapped in runWithCronLock() so that if more than one server
 * instance is running (Render scale-up, Docker Compose, Railway workers), only
 * one instance executes each tick — otherwise emails, dunning steps, resets
 * and reports would double-fire.
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
import { runIndiaMartPull } from "./indiamart-pull.cron";
import { runImapEmailPull } from "./email-imap.cron";
import { runWithCronLock } from "../utils/cron-lock";

export function registerCronJobs() {
  logger.info("Registering cron jobs...");

  // ─── No-Show Detection — Every 15 minutes ──────────────────
  cron.schedule("*/15 * * * *", async () => {
    logger.info("Cron: Running no-show detection...");
    await runWithCronLock("no-show-detector", 600, async () => {
      try {
        const result = await detectNoShows();
        logger.info({ processed: result.processed }, "Cron: No-show detection complete");
      } catch (error: any) {
        logger.error({ err: error.message }, "Cron: No-show detection failed");
      }
    });
  });

  // ─── Trial Expiry Check — Daily at 8:00 AM ────────────────
  cron.schedule("0 8 * * *", async () => {
    logger.info("Cron: Checking trial expiry...");
    await runWithCronLock("trial-expiry", 3600, async () => {
      try {
        const result = await checkTrialExpiry();
        logger.info({ paused: result.paused, emailsSent: result.emailsSent }, "Cron: Trial expiry check complete");
      } catch (error: any) {
        logger.error({ err: error.message }, "Cron: Trial expiry check failed");
      }
    });
  });

  // ─── Monthly Report — 1st of month at 6:00 AM ────────────
  cron.schedule("0 6 1 * *", async () => {
    logger.info("Cron: Generating monthly reports...");
    await runWithCronLock("monthly-report", 3600, async () => {
      try {
        const result = await generateMonthlyReports();
        logger.info({ reportsGenerated: result.reportsGenerated }, "Cron: Monthly reports complete");
      } catch (error: any) {
        logger.error({ err: error.message }, "Cron: Monthly report generation failed");
      }
    });
  });

  // ─── Google Sheets Sync — Every 15 minutes ────────────────
  cron.schedule("*/15 * * * *", async () => {
    logger.info("Cron: Running Google Sheets sync...");
    await runWithCronLock("sheets-sync", 600, async () => {
      try {
        const result = await runSheetsSync();
        logger.info({ totalSynced: result.totalSynced, totalErrors: result.totalErrors }, "Cron: Sheets sync complete");
      } catch (error: any) {
        logger.error({ err: error.message }, "Cron: Sheets sync failed");
      }
    });
  });

  // ─── Monthly Broker Credit Reset — 1st of month at 00:05 ───
  cron.schedule("5 0 1 * *", async () => {
    logger.info("Cron: Running monthly broker credit reset...");
    await runWithCronLock("monthly-credit-reset", 3600, async () => {
      try {
        const result = await runMonthlyReset();
        logger.info(result, "Cron: Monthly credit reset complete");
      } catch (error: any) {
        logger.error({ err: error.message }, "Cron: Monthly credit reset failed");
      }
    });
  });

  // ─── Redis Pending Job Recovery — Every 30 seconds ─────────
  cron.schedule("*/30 * * * * *", async () => {
    await runWithCronLock("redis-recovery", 25, async () => {
      try {
        const result = await recoverPendingJobs();
        if (result.recovered > 0 || result.failed > 0) {
          logger.info({ recovered: result.recovered, failed: result.failed }, "Cron: Pending job recovery cycle");
        }
      } catch (error: any) {
        logger.error({ err: error.message }, "Cron: Pending job recovery failed");
      }
    });
  });

  // ─── Weekly Data Cleanup — Every Sunday at 2:00 AM ────────
  cron.schedule("0 2 * * 0", async () => {
    logger.info("Cron: Running weekly data cleanup...");
    await runWithCronLock("data-cleanup", 7200, async () => {
      try {
        const result = await runDataCleanup();
        logger.info(result, "Cron: Data cleanup complete");
      } catch (error: any) {
        logger.error({ err: error.message }, "Cron: Data cleanup failed");
      }
    });
  });

  // ─── Broker Usage Alerts — Every 6 hours ────────────────
  // FIX #4 (P1): Notify brokers at 80%/90%/100% usage
  cron.schedule("0 */6 * * *", async () => {
    logger.info("Cron: Running usage alerts...");
    await runWithCronLock("usage-alerts", 3600, async () => {
      try {
        const result = await runUsageAlerts();
        if (result.alertsSent > 0) {
          logger.info({ alertsSent: result.alertsSent }, "Cron: Usage alerts complete");
        }
      } catch (error: any) {
        logger.error({ err: error.message }, "Cron: Usage alerts failed");
      }
    });
  });

  // ─── Dunning — Daily at 9:00 AM ──────────────────────────
  // FIX #5 (P1): Recover PAST_DUE accounts with 3-step sequence
  cron.schedule("0 9 * * *", async () => {
    logger.info("Cron: Running dunning...");
    await runWithCronLock("dunning", 3600, async () => {
      try {
        const result = await runDunning();
        if (result.processed > 0) {
          logger.info(result, "Cron: Dunning cycle complete");
        }
      } catch (error: any) {
        logger.error({ err: error.message }, "Cron: Dunning failed");
      }
    });
  });

  // ─── IndiaMART Pull API — Every 5 minutes ────────────────
  // Fallback/backfill for brokers whose IndiaMART Push API isn't enabled.
  // Each connected client pulls new leads since their last successful pull
  // (with a 5-min overlap to avoid gaps) and queues the AI calls.
  cron.schedule("*/5 * * * *", async () => {
    await runWithCronLock("indiamart-pull", 240, async () => {
      try {
        await runIndiaMartPull();
      } catch (error: any) {
        logger.error({ err: error.message }, "Cron: IndiaMART pull failed");
      }
    });
  });

  // ─── IMAP Email Ingestion — Every 2 minutes ──────────────
  // Polls the configured mailbox for forwarded portal emails (runs the same
  // pipeline as the inbound-email webhook). Skipped when IMAP_* isn't set.
  cron.schedule("*/2 * * * *", async () => {
    await runWithCronLock("imap-email-pull", 100, async () => {
      try {
        await runImapEmailPull();
      } catch (error: any) {
        logger.error({ err: error.message }, "Cron: IMAP email pull failed");
      }
    });
  });

  // ─── Revenue Recognition — Daily at 2:00 AM ──────────────
  // FIX #5 (P2): GAAP-compliant daily revenue recognition
  cron.schedule("0 2 * * *", async () => {
    logger.info("Cron: Running revenue recognition...");
    await runWithCronLock("revenue-recognition", 3600, async () => {
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
  });

  logger.info("All cron jobs registered");
}
