/**
 * Unpaid-Activation Sweep — every hour.
 *
 * Closes the abandoned-checkout hole (P0 money-loop fix):
 * `createSubscriptionCheckout` no longer grants client planStatus ACTIVE before
 * payment (non-STARTER checkout lands on PAST_DUE immediately). This sweep is
 * the belt-and-braces for the OTHER paths that can leave an ACTIVE client with
 * a live-but-unpaid Razorpay sub:
 *   • a sub activated before this fix deployed (was ACTIVE at checkout time),
 *   • any edge where the paid-status flip disappeared (webhook misconfig, etc.).
 *
 * Criteria (ALL must hold):
 *   - client.planStatus = ACTIVE
 *   - client has a razorpaySubId (subscription-billed, not offline-paid)
 *   - client has NO successful Razorpay Payment row ever
 *   - their latest non-cancelled subscription was created >2h ago
 *     (grace window so an in-flight payment isn't punished)
 *   - subscription created after BASELINE (2026-10-25) so legacy accounts that
 *     paid before webhook-era Payment recording cannot be wrongly demoted.
 * A future subscription.charged webhook flips planStatus back to ACTIVE, so a
 * wrongly-swept client self-heals the moment they actually pay.
 *
 * Once PAST_DUE, the existing daily dunning cron takes over
 * (3-step reminders → deactivate at day 7).
 */

import { prisma } from "../utils/prisma-shared";
import { logger } from "../utils/logger";
import { enqueueNotification } from "../workers/queues";
import { config } from "../config";

const GRACE_HOURS = 2;
/** Deploy-date baseline: only subscriptions created after this are swept. */
const BASELINE = new Date("2026-10-25T00:00:00Z");

export async function runUnpaidActivationSweep(): Promise<{ swept: number }> {
  const graceAgo = new Date(Date.now() - GRACE_HOURS * 60 * 60 * 1000);

  const clients = await prisma.client.findMany({
    where: {
      planStatus: "ACTIVE",
      razorpaySubId: { not: null },
      payments: { none: { status: "SUCCESSFUL" } },
    },
    select: {
      id: true,
      businessName: true,
      ownerName: true,
      dunningStartedAt: true,
      subscriptions: {
        where: { status: { in: ["ACTIVE", "PENDING", "TRIAL"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, createdAt: true, planTier: true },
      },
    },
  });

  let swept = 0;
  for (const client of clients) {
    const sub = client.subscriptions[0];
    // No cancellable sub, older than the grace window, and created after baseline.
    if (!sub || sub.createdAt >= graceAgo || sub.createdAt < BASELINE) continue;

    try {
      await prisma.client.update({
        where: { id: client.id },
        data: {
          planStatus: "PAST_DUE",
          // Dunning timeline starts at checkout (dunning cron day-1 = 1 day after).
          dunningStartedAt: client.dunningStartedAt || sub.createdAt,
        },
      });

      logger.warn(
        { clientId: client.id, subId: sub.id, subAge: sub.createdAt.toISOString() },
        "Unpaid-activation sweep: ACTIVE client with no successful payment swept to PAST_DUE"
      );

      await enqueueNotification({
        recipient: "owner",
        leadId: "",
        clientId: client.id,
        type: "ACCOUNT_SUSPENDED",
        data: {
          message: `To finish activating your ${sub.planTier} subscription, complete your payment. Calls will resume automatically once payment is done.`,
          reactivateUrl: `${config.FRONTEND_URL}/dashboard/billing`,
        },
      }).catch(() => {});

      swept++;
    } catch (err: any) {
      logger.warn({ clientId: client.id, err: err.message }, "Unpaid-activation sweep failed for client");
    }
  }

  return { swept };
}
