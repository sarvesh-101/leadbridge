import { Worker } from "bullmq";
import { PrismaClient, LeadStatus } from "@prisma/client";
import { config } from "../config";
import { CallJob, enqueueCall, enqueueNotification } from "./queues";
import { initiateOutboundCall } from "../services/exotel.service";
import { startCallSession } from "../services/pipecat.service";
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
      const exotelResponse = await initiateOutboundCall({
        from: client.exotelNumber || config.EXOTEL_CALLER_ID || "",
        to: lead.phone, callType, clientId, leadId, attempt,
      });

      await prisma.call.update({
        where: { id: call.id },
        data: { exotelCallSid: exotelResponse.callSid },
      });

      try {
        await startCallSession({
          leadId, clientId, callType, exotelCallSid: exotelResponse.callSid,
          toNumber: lead.phone, fromNumber: client.exotelNumber || config.EXOTEL_CALLER_ID || "",
          clientConfig: {
            businessName: client.businessName, ownerName: client.ownerName,
            language: client.language, callScript: client.callScript as Record<string, unknown> | null,
            agentId: client.agentId,
          },
          leadInfo: { name: lead.name, phone: lead.phone },
        });
      } catch (pipecatError: any) {
        job.log(`Pipecat session warning: ${pipecatError.message}`);
      }

      return { callId: call.id, exotelCallSid: exotelResponse.callSid };
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
  console.error(`Call worker job ${job?.id} failed:`, error.message);
});

export default callWorker;
