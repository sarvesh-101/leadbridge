import { Worker } from "bullmq";
import { LeadStatus } from "@prisma/client";
import { config } from "../config";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma-shared";
import { CallJob, enqueueCall, enqueueNotification } from "./queues";
import { getVoiceAIProvider } from "../services/voice";
import { emitCallStarted, emitCallEnded, emitStatusChange } from "../services/websocket.service";
import { canDispatchCall, canBrokerDispatchCall, incrementBrokerCallCount } from "../services/credit-manager.service";

// Track which calls have had their billing increment already applied

const callWorker = new Worker<CallJob>(
  "call",
  async (job) => {
    const { leadId, clientId, callType, attempt } = job.data;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    const client = await prisma.client.findUnique({ where: { id: clientId } });

    if (!lead || !client) {
      throw new Error(`Lead or Client not found: lead=${leadId}, client=${clientId}`);
    }

    if (callType === "QUALIFICATION" && !["PENDING", "NO_ANSWER", "CALL_FAILED"].includes(lead.status)) {
      job.log(`Skipping — lead status is ${lead.status}, not in callable state`);
      return { skipped: true, reason: `Status ${lead.status} not callable` };
    }

    // ─── WORKING HOURS CHECK ──────────────────────────────────────
    // Don't call leads outside 8:00 AM - 8:00 PM IST (Asia/Kolkata)
    // Real estate calls outside these hours create bad customer experience
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // UTC+5:30
    const istTime = new Date(now.getTime() + istOffset);
    const currentHourIST = istTime.getUTCHours();
    const WORKING_HOUR_START = 8;  // 8:00 AM IST
    const WORKING_HOUR_END = 20;   // 8:00 PM IST

    if (currentHourIST < WORKING_HOUR_START || currentHourIST >= WORKING_HOUR_END) {
      // Re-queue the call for next working hour start (8:00 AM IST next day or today)
      const nextCallTime = new Date(istTime);
      nextCallTime.setUTCHours(WORKING_HOUR_START, 0, 0, 0);
      if (currentHourIST >= WORKING_HOUR_END) {
        // Past end of day — schedule for tomorrow 8:00 AM
        nextCallTime.setUTCDate(nextCallTime.getUTCDate() + 1);
      }
      const delayMs = Math.max(0, nextCallTime.getTime() - now.getTime());

      job.log(`⏰ Outside working hours (${currentHourIST}:00 IST) — re-queuing for ${nextCallTime.toISOString()}`);
      await enqueueCall({
        leadId, clientId, callType, attempt,
      }, delayMs);

      return { skipped: true, reason: `Outside working hours, re-queued for ${delayMs}ms delay` };
    }

    if (lead.callAttempts >= lead.maxAttempts) {
      await prisma.lead.update({ where: { id: leadId }, data: { status: "NO_ANSWER" as LeadStatus } });
      await enqueueNotification({
        recipient: "owner", leadId, clientId, type: "NO_ANSWER",
        data: { leadName: lead.name },
      });
      await emitStatusChange(leadId, "NO_ANSWER", clientId, { final: true });
      return { skipped: true, reason: "Max attempts reached" };
    }

    // ─── ACCOUNT STATUS CHECK ────────────────────────────────────
    // Block calls if account is PAST_DUE, CANCELLED, or EXPIRED
    if (client.planStatus !== "TRIAL" && client.planStatus !== "ACTIVE") {
      job.log(`⛔ Account ${client.planStatus} — call blocked`);
      logger.warn({ leadId, clientId, planStatus: client.planStatus }, "Call blocked — account not active");
      await enqueueNotification({
        recipient: "owner", leadId, clientId, type: "ACCOUNT_INACTIVE",
        data: {
          leadName: lead.name,
          message: `Call blocked because your account is ${client.planStatus}. Please renew your subscription to resume AI calls.`,
        },
      });
      return { skipped: true, reason: `Account ${client.planStatus}` };
    }

    // ─── TRIAL TOTAL CALL LIMIT ───────────────────────────────────
    // Trial accounts get a hard cap on total calls to prevent platform credit drain.
    // Limit: 50 total calls during entire trial period.
    const TRIAL_MAX_CALLS = 50;
    if (client.planStatus === "TRIAL") {
      const totalTrialCalls = await prisma.call.count({
        where: { clientId },
      });
      if (totalTrialCalls >= TRIAL_MAX_CALLS) {
        job.log(`⛔ Trial call limit reached: ${totalTrialCalls}/${TRIAL_MAX_CALLS}`);
        logger.warn({ leadId, clientId, totalTrialCalls }, "Call blocked — trial limit reached");
        await enqueueNotification({
          recipient: "owner", leadId, clientId, type: "TRIAL_LIMIT_REACHED",
          data: {
            leadName: lead.name,
            message: `Your trial has used ${totalTrialCalls} of ${TRIAL_MAX_CALLS} AI calls. Subscribe to a plan to continue.`,
          },
        });
        return { skipped: true, reason: `Trial limit ${totalTrialCalls}/${TRIAL_MAX_CALLS}` };
      }
    }

    // ─── BROKER CALL LIMIT CHECK ─────────────────────────────────
    // HARD STOP: Check if broker has remaining credits
    const brokerCheck = await canBrokerDispatchCall(prisma, clientId);
    if (!brokerCheck.canProceed) {
      job.log(`⛔ Broker call limit reached: ${brokerCheck.reason}`);
      logger.warn({ leadId, clientId, reason: brokerCheck.reason }, "Call blocked — broker limit reached");
      await enqueueNotification({
        recipient: "owner", leadId, clientId, type: "CALL_LIMIT_REACHED",
        data: {
          leadName: lead.name,
          message: brokerCheck.reason || "Call limit reached",
        },
      });
      return { skipped: true, reason: brokerCheck.reason };
    }

    // Send usage warning at 80% threshold
    if (brokerCheck.needsWarning) {
      job.log(`⚠️ Broker at ${brokerCheck.credits.usagePercent}% usage (${brokerCheck.credits.callsThisMonth}/${brokerCheck.credits.callsLimit} base calls used)`);
      await enqueueNotification({
        recipient: "owner", leadId, clientId, type: "USAGE_WARNING",
        data: {
          leadName: lead.name,
          message: `You've used ${brokerCheck.credits.callsThisMonth} of ${brokerCheck.credits.callsLimit} base calls this month (${brokerCheck.credits.rolloverCalls} rollover remaining). Upgrade to avoid interruption.`,
        },
      }).catch(() => {});
    }

    // ─── PLATFORM CREDIT CHECK ───────────────────────────────────
    if (!config.DEMO_MODE) {
      const creditCheck = await canDispatchCall(prisma);
      if (!creditCheck.canProceed) {
        job.log(`⚠️ Platform credits low: ${creditCheck.reason}`);
        logger.warn({ leadId, clientId, reason: creditCheck.reason }, "Call blocked — platform credits exhausted");
        await enqueueNotification({
          recipient: "owner", leadId, clientId, type: "CREDIT_EXHAUSTED",
          data: {
            leadName: lead.name,
            message: `Call could not be dispatched: ${creditCheck.reason}. Please contact support.`,
          },
        });
        return { skipped: true, reason: creditCheck.reason };
      }
    }

    const call = await prisma.call.create({
      data: {
        clientId, leadId, type: callType, direction: "outbound",
        status: "INITIATED",
      },
    });

    const statusMap: Record<string, LeadStatus> = {
      QUALIFICATION: "CALLING" as LeadStatus,
      BOOKING_REMINDER: "REMINDED" as LeadStatus,
      FOLLOWUP_D1: "FOLLOWUP_D1" as LeadStatus,
      FOLLOWUP_D3: "FOLLOWUP_D3" as LeadStatus,
    };

    const newStatus = statusMap[callType] || ("CALLING" as LeadStatus);

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: newStatus,
        callAttempts: lead.callAttempts + 1,
        firstCalledAt: lead.firstCalledAt || new Date(),
      },
    });

    await emitCallStarted(leadId, call.id, clientId);
    await emitStatusChange(leadId, newStatus, clientId, { callId: call.id, callType });

    try {
      const agentId = client.omniAgentId || String(client.omnidimensionAgentId || "");

      if (!agentId) {
        throw new Error(`Client ${clientId} has no AI agent configured`);
      }

      // Build call context with lead and client info
      const callContext = {
        lead_name: lead.name,
        lead_phone: lead.phone,
        business_name: client.businessName,
        owner_name: client.ownerName,
        call_type: callType,
        lead_id: leadId,
        client_id: clientId,
        language: client.language,
        call_attempt: attempt,
      };

      const voiceAI = getVoiceAIProvider();
      const voiceResult = await voiceAI.dispatchCall({
        agentId,
        toNumber: lead.phone,
        callContext,
      });

      await prisma.call.update({
        where: { id: call.id },
        data: { omnidimensionCallId: String(voiceResult.requestId) },
      });

      return { callId: call.id, omnidimensionCallId: voiceResult.requestId };
    } catch (error: any) {
      await prisma.call.update({
        where: { id: call.id },
        data: { status: "FAILED", transcript: `Call failed: ${error.message}` },
      });
      await emitCallEnded(leadId, call.id, "failed", clientId);
      throw error;
    }
  },
  {
    connection: { url: config.REDIS_URL, maxRetriesPerRequest: null },
    concurrency: 5,
    lockDuration: 60000,
  }
);

callWorker.on("completed", async (job) => {
  if (!job) return;
  const { clientId, leadId } = job.data;

  // Use the latest call record's ID to identify this dispatch.
  const lastCall = await prisma.call.findFirst({
    where: { leadId, clientId },
    orderBy: { createdAt: "desc" },
  });
  if (!lastCall) return;

  // DB-backed idempotency marker — survives restarts (replaces the old in-memory
  // Set which reset on restart and could double-bill if a job was redelivered).
  await prisma.$transaction(async (tx) => {
    const existing = await tx.creditTransaction.findFirst({
      where: { callId: lastCall.id, type: "BROKER_CALL" },
    });
    if (existing) return;

    // Record the marker first, then increment — atomic, so concurrent/redelivered
    // completions can never bill the same dispatch twice.
    await tx.creditTransaction.create({
      data: {
        type: "BROKER_CALL",
        amount: 0,
        minutes: 0,
        description: "Broker call count increment (idempotency marker)",
        clientId,
        callId: lastCall.id,
        metadata: { leadId },
      },
    });
    await incrementBrokerCallCount(tx as any, clientId);
  });

  await emitCallEnded(leadId, lastCall.id, "completed", clientId);
});

callWorker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, err: error.message }, "Call worker job failed");
});

// Graceful shutdown — close worker only (shared Prisma disconnects in index.ts)
process.on("SIGTERM", async () => {
  await callWorker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await callWorker.close();
  process.exit(0);
});

export default callWorker;
