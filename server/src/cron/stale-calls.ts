/**
 * Stale-Call Unstick Sweep — every 10 minutes.
 *
 * Closes the stranded-lead loop (P2 workflow fix): a lead whose AI call was
 * dispatched but whose final Omnidimension status webhook was lost (their
 * outage, a missed retry, app crash mid-call) stays in status CALLING forever:
 *   • the call worker's QUALIFICATION gate only dispatches for
 *     PENDING / NO_ANSWER / CALL_FAILED → every future call silently skips,
 *   • the 30-day phone dedupe treats it as a live non-terminal lead →
 *     re-ingestion is blocked too.
 * One lost webhook = a lead the AI never calls again. This sweep re-opens the
 * lead so the normal retry/rating pipeline takes over.
 *
 * Rules (lead in CALLING with updatedAt older than 3h):
 *   - no Call row at all          → worker died pre-create: release to PENDING
 *   - latest Call is ingoing      → provider never reported an end: mark the
 *                                   call FAILED, release the lead to NO_ANSWER
 *   - latest Call already terminal → webhook updated the call but not the
 *                                   lead: just release the lead to NO_ANSWER
 * A genuinely late webhook (>3h) still processes fine — its dedupe was skipped
 * for in-progress events, so the completed/failed event lands on the intact
 * Call row and updates it normally.
 */

import { prisma } from "../utils/prisma-shared";
import { logger } from "../utils/logger";
import { enqueueNotification } from "../workers/queues";
import { emitStatusChange } from "../services/websocket.service";

const STALE_AFTER_HOURS = 3;

const IN_FLIGHT_CALL_STATUSES = ["INITIATED", "RINGING", "ANSWERED"];

export async function unstickStaleCalls(): Promise<{ unstuck: number }> {
  const cutoff = new Date(Date.now() - STALE_AFTER_HOURS * 60 * 60 * 1000);

  const leads = await prisma.lead.findMany({
    where: { status: "CALLING", updatedAt: { lt: cutoff } },
    select: {
      id: true,
      name: true,
      clientId: true,
      calls: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true },
      },
    },
  });

  let unstuck = 0;

  for (const lead of leads) {
    try {
      const lastCall = lead.calls[0];

      if (!lastCall) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "PENDING", nextRetryAt: null },
        });
      } else if (IN_FLIGHT_CALL_STATUSES.includes(lastCall.status)) {
        // Never received a terminal webhook — mark the call FAILED and release
        // the lead (NO_ANSWER is callable, so the retry pipeline continues).
        await prisma.call.update({
          where: { id: lastCall.id },
          data: { status: "FAILED" },
        });
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "NO_ANSWER", nextRetryAt: null },
        });

        await enqueueNotification({
          recipient: "owner",
          leadId: lead.id,
          clientId: lead.clientId,
          type: "NO_ANSWER",
          data: {
            leadName: lead.name,
            message: "A call to this lead didn't get a final status from the calling provider — it was released for retry.",
          },
        }).catch(() => {});

        await emitStatusChange(lead.id, "NO_ANSWER", lead.clientId, { final: false, swept: true });
      } else {
        // Call already terminal — only the lead's own status got stranded.
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "NO_ANSWER", nextRetryAt: null },
        });

        await emitStatusChange(lead.id, "NO_ANSWER", lead.clientId, { final: false, swept: true });
      }

      unstuck++;
    } catch (err: any) {
      logger.warn({ leadId: lead.id, err: err.message }, "Stale-call sweep failed for lead");
    }
  }

  return { unstuck };
}
