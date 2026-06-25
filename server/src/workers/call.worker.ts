import { Worker } from "bullmq";
import { PrismaClient, LeadStatus } from "@prisma/client";
import { config } from "../config";
import { logger } from "../utils/logger";
import { CallJob, enqueueCall, enqueueNotification } from "./queues";
import { dispatchCall } from "../services/omnidimension.service";
import { emitCallStarted, emitCallEnded, emitStatusChange } from "../services/websocket.service";

const prisma = new PrismaClient();

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

    if (lead.callAttempts >= lead.maxAttempts) {
      await prisma.lead.update({ where: { id: leadId }, data: { status: "NO_ANSWER" as LeadStatus } });
      await enqueueNotification({
        recipient: "owner", leadId, clientId, type: "NO_ANSWER",
        data: { leadName: lead.name },
      });
      await emitStatusChange(leadId, "NO_ANSWER", clientId, { final: true });
      return { skipped: true, reason: "Max attempts reached" };
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
      const agentId = client.omnidimensionAgentId;

      if (!agentId) {
        throw new Error(`Client ${clientId} has no omnidimensionAgentId configured`);
      }

      // Build call context with lead and client info for the Omnidimension agent
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

      const omnidimResponse = await dispatchCall({
        agentId,
        toNumber: lead.phone,
        callContext,
      });

      await prisma.call.update({
        where: { id: call.id },
        data: { omnidimensionCallId: String(omnidimResponse.requestId) },
      });

      return { callId: call.id, omnidimensionCallId: omnidimResponse.requestId };
    } catch (error: any) {
      await prisma.call.update({
        where: { id: call.id },
        data: { status: "FAILED", transcript: `Call failed: ${error.message}` },
      });
      await prisma.client.update({
        where: { id: clientId },
        data: { callsThisMonth: { increment: 1 } },
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
  if (job) {
    const { clientId, leadId } = job.data;
    await prisma.client.update({
      where: { id: clientId },
      data: { callsThisMonth: { increment: 1 } },
    });
    // Look up the most recent call for this lead to emit the end event
    const lastCall = await prisma.call.findFirst({
      where: { leadId, clientId },
      orderBy: { createdAt: "desc" },
    });
    if (lastCall) {
      await emitCallEnded(leadId, lastCall.id, "completed", clientId);
    }
  }
});

callWorker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, err: error.message }, "Call worker job failed");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await callWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await callWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

export default callWorker;
