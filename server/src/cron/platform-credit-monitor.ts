/**
 * V2 (T7) — Platform low-credit monitor.
 *
 * Runs every 30 min. Watches the current month's PlatformCredit and:
 *  - alerts (rate-limited every 12h) when remaining minutes drop below the
 *    configured alertThresholdPercent of purchased minutes;
 *  - sets dispatchPaused=true when remaining ≤ PLATFORM_PAUSE_MINUTES
 *    (0 disables auto-pause) — call workers then re-queue instead of dying;
 *  - clears the pause when the balance recovers past
 *    PLATFORM_PAUSE_RESUME_MINUTES (recharge happened).
 */
import { prisma } from "../utils/prisma-shared";
import { config } from "../config";
import { logger } from "../utils/logger";
import { getOrCreateCurrentCredit, setPlatformDispatchPaused } from "../services/credit-manager.service";

export async function runPlatformCreditMonitor(): Promise<{ paused: boolean; resumed: boolean; alerted: boolean }> {
  const credit = await getOrCreateCurrentCredit(prisma);

  // Credits never configured — monitor is a no-op (calls allowed).
  if (credit.totalMinutesPurchased === 0) {
    return { paused: false, resumed: false, alerted: false };
  }

  const remaining = credit.totalMinutesPurchased - credit.minutesUsed;
  const percentLeft = Math.ceil((remaining / credit.totalMinutesPurchased) * 100);
  let alerted = false;
  let paused = false;
  let resumed = false;

  // ─── Low-balance alert (rate-limited) ──────────────────────
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const canAlert = !credit.lastAlertSentAt || credit.lastAlertSentAt < twelveHoursAgo;
  if (percentLeft <= credit.alertThresholdPercent && canAlert) {
    logger.warn({ remaining, percentLeft }, "PLATFORM CREDITS LOW — admin recharge needed");
    await prisma.platformCredit.update({
      where: { id: credit.id },
      data: { lastAlertSentAt: new Date() },
    });
    alerted = true;
  }

  // ─── Auto-pause below the configured floor ─────────────────
  if (config.PLATFORM_PAUSE_MINUTES > 0 && remaining <= config.PLATFORM_PAUSE_MINUTES && !credit.dispatchPaused) {
    await setPlatformDispatchPaused(prisma, true);
    paused = true;
  }

  // ─── Auto-resume after recharge ───────────────────────────
  if (credit.dispatchPaused && remaining >= config.PLATFORM_PAUSE_RESUME_MINUTES) {
    await setPlatformDispatchPaused(prisma, false);
    resumed = true;
  }

  return { paused, resumed, alerted };
}
