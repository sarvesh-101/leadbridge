import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { config } from "../config";
import { WebhookRetryJob, enqueueCall, enqueueExtraction, enqueueNotification } from "./queues";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();

/**
 * WEBHOOK RETRY Worker — processes Omnidimension webhooks that arrived
 * before the dispatch_call response could store the call ID in the DB.
 *
 * Retries the webhook processing with a small delay to allow the DB write
 * to complete. Gives up after maxAttempts.
 */
const webhookRetryWorker = new Worker<WebhookRetryJob>(
  "webhook-retry",
  async (job) => {
    const { payload, retryCount } = job.data;
    const callLogId = (payload.call_sid || payload.call_id) as string | undefined;

    if (!callLogId) {
      job.log("Invalid webhook payload — missing call_sid/call_id");
      return { skipped: true, reason: "Missing call ID" };
    }

    job.log(`Retry attempt ${retryCount + 1} for call ${callLogId}`);

    // Try to find the call record now — it should exist if the delay was enough
    const call = await prisma.call.findFirst({
      where: {
        OR: [
          { omnidimensionCallId: callLogId },
          { exotelCallSid: callLogId },
        ],
      },
      include: { lead: true },
    });

    if (!call) {
      // Still not found — if we've exhausted retries, log and skip
      if (retryCount >= 4) {
        logger.warn({ callLogId, retryCount }, "Webhook retry exhausted — call record never found");
        return { skipped: true, reason: "Retries exhausted" };
      }

      // Re-enqueue with incremented retry count
      throw new Error(`Call record ${callLogId} not found after retry ${retryCount + 1}`);
    }

    job.log(`Call record ${call.id} found on retry ${retryCount + 1}`);

    // ─── Process the webhook now that we have the call record ────────
    const event = payload as Record<string, unknown>;
    const callStatus = (event.call_status as string || "").toLowerCase();
    const duration = (event.call_duration as number) || 0;
    const lead = call.lead;

    switch (callStatus) {
      case "completed":
      case "success": {
        const updateData: Record<string, unknown> = { status: "COMPLETED" };
        if (duration > 0) updateData.duration = duration;

        const callReport = event.call_report as Record<string, unknown> | undefined;
        if (callReport) {
          if (callReport.summary) updateData.summary = callReport.summary as string;
          if (callReport.full_conversation) updateData.transcript = callReport.full_conversation as string;
          if (callReport.extracted_variables) updateData.extractedData = callReport.extracted_variables;
        }

        await prisma.call.update({
          where: { id: call.id },
          data: updateData,
        });

        await enqueueExtraction({
          callId: call.id,
          leadId: call.leadId,
          clientId: call.clientId,
          transcript: (callReport?.full_conversation as string) || "",
        });
        break;
      }

      case "no-answer":
      case "no_answer": {
        await prisma.call.update({
          where: { id: call.id },
          data: { status: "NO_ANSWER" },
        });

        if (call.type === "QUALIFICATION" && (lead.callAttempts || 0) < (lead.maxAttempts || 3)) {
          const delayMs = lead.callAttempts === 1 ? 2 * 60 * 60 * 1000 : 4 * 60 * 60 * 1000;
          await enqueueCall({
            leadId: lead.id,
            clientId: call.clientId,
            callType: "QUALIFICATION",
            attempt: (lead.callAttempts || 0) + 1,
          }, delayMs);
        } else {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "NO_ANSWER" },
          });
          await enqueueNotification({
            recipient: "owner", leadId: lead.id, clientId: call.clientId,
            type: "NO_ANSWER", data: { leadName: lead.name },
          });
        }
        break;
      }

      case "busy":
      case "failed": {
        await prisma.call.update({
          where: { id: call.id },
          data: { status: callStatus === "busy" ? "BUSY" : "FAILED" },
        });

        if ((lead.callAttempts || 0) < (lead.maxAttempts || 3)) {
          const delayMs = lead.callAttempts === 1 ? 2 * 60 * 60 * 1000 : 4 * 60 * 60 * 1000;
          await enqueueCall({
            leadId: lead.id, clientId: call.clientId,
            callType: call.type as "QUALIFICATION" | "BOOKING_REMINDER" | "FOLLOWUP_D1" | "FOLLOWUP_D3",
            attempt: (lead.callAttempts || 0) + 1,
          }, delayMs);
        }
        break;
      }
    }

    return { processed: true, callId: call.id, onRetry: true, retryCount };
  },
  {
    connection: { url: config.REDIS_URL, maxRetriesPerRequest: null },
    concurrency: 10,
    lockDuration: 15000,
    // The queue itself has `attempts: 5`, so retry 5x with increasing backoff
    settings: {
      backoffStrategy: (attemptsMade: number) => Math.min(attemptsMade * 2000, 10000),
    },
  }
);

webhookRetryWorker.on("failed", (job, error) => {
  logger.warn({ jobId: job?.id, err: error.message }, "Webhook retry worker job failed");
});

export default webhookRetryWorker;
