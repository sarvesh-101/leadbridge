import { Worker } from "bullmq";
import { PrismaClient, LeadStatus } from "@prisma/client";
import { config } from "../config";
import { logger } from "../utils/logger";
import { FollowupJob, enqueueCall, enqueueNotification, enqueueFollowup } from "./queues";
import { isInFollowup } from "../utils/lifecycle";
import { emitStatusChange } from "../services/websocket.service";
import { getOptimalFollowupTiming } from "../services/smart-scheduler.service";

const prisma = new PrismaClient();

const followupWorker = new Worker<FollowupJob>(
  "followup",
  async (job) => {
    const { leadId, clientId, day } = job.data;
    const now = new Date();

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    const client = await prisma.client.findUnique({ where: { id: clientId } });

    if (!lead || !client) {
      throw new Error(`Lead or Client not found`);
    }

    if (!isInFollowup(lead.status)) {
      job.log(`Lead status ${lead.status} — skipping follow-up, lead already handled`);
      return { skipped: true, reason: `Lead in ${lead.status} state` };
    }

    switch (day) {
      case 1: {
        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "FOLLOWUP_D1" as LeadStatus, followupD1At: now },
        });

        await enqueueCall({ leadId, clientId, callType: "FOLLOWUP_D1", attempt: 1 });
        await emitStatusChange(leadId, "FOLLOWUP_D1", clientId, { followupDay: 1 });

        await enqueueNotification({
          recipient: "owner", leadId, clientId, type: "FOLLOWUP_D1_SENT",
          data: { leadName: lead.name, result: "Day 1 follow-up call initiated", dashboardLink: `${config.FRONTEND_URL}/dashboard/leads/${leadId}` },
        });

        // ⚡ ADVANCED: Use smart scheduler for D2 timing
        const { d2Delay } = await getOptimalFollowupTiming(leadId);
        await enqueueFollowup({ leadId, clientId, day: 2 }, d2Delay);
        job.log(`D2 scheduled with smart timing: ${Math.round(d2Delay / 3600000)}h from now`);

        return { day: 1, action: "call", nextFollowup: `D2 in ${Math.round(d2Delay / 3600000)}h` };
      }

      case 2: {
        const leadAfterD1 = await prisma.lead.findUnique({ where: { id: leadId } });
        if (leadAfterD1 && !["NO_SHOW", "FOLLOWUP_D1", "FOLLOWUP_D2"].includes(leadAfterD1.status)) {
          job.log(`Lead responded to D1 — skipping D2`);
          return { skipped: true, reason: "Lead responded to D1" };
        }

        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "FOLLOWUP_D2" as LeadStatus, followupD2At: now },
        });

        await enqueueNotification({
          recipient: "customer", leadId, clientId, type: "FOLLOWUP_D2_MESSAGE",
          data: { location: lead.location || "your preferred area", businessName: client.businessName },
        });

        await enqueueNotification({
          recipient: "owner", leadId, clientId, type: "FOLLOWUP_D2_SENT",
          data: { leadName: lead.name, result: "Day 2 WhatsApp follow-up sent", dashboardLink: `${config.FRONTEND_URL}/dashboard/leads/${leadId}` },
        });

        await emitStatusChange(leadId, "FOLLOWUP_D2", clientId, { followupDay: 2 });

        // ⚡ ADVANCED: Use smart scheduler for D3 timing
        const { d3Delay } = await getOptimalFollowupTiming(leadId);
        await enqueueFollowup({ leadId, clientId, day: 3 }, d3Delay);

        return { day: 2, action: "whatsapp", nextFollowup: `D3 in ${Math.round(d3Delay / 3600000)}h` };
      }

      case 3: {
        const leadAfterD2 = await prisma.lead.findUnique({ where: { id: leadId } });
        if (leadAfterD2 && !["NO_SHOW", "FOLLOWUP_D1", "FOLLOWUP_D2", "FOLLOWUP_D3"].includes(leadAfterD2.status)) {
          job.log(`Lead responded to D2 — skipping D3`);
          return { skipped: true, reason: "Lead responded to D2" };
        }

        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "FOLLOWUP_D3" as LeadStatus, followupD3At: now },
        });

        await enqueueCall({ leadId, clientId, callType: "FOLLOWUP_D3", attempt: 1 });
        await emitStatusChange(leadId, "FOLLOWUP_D3", clientId, { followupDay: 3, final: true });

        await enqueueNotification({
          recipient: "owner", leadId, clientId, type: "FOLLOWUP_D3_SENT",
          data: { leadName: lead.name, result: "Day 3 final follow-up call initiated", dashboardLink: `${config.FRONTEND_URL}/dashboard/leads/${leadId}` },
        });

        return { day: 3, action: "call", isFinal: true };
      }
    }
  },
  {
    connection: { url: config.REDIS_URL, maxRetriesPerRequest: null },
    concurrency: 5,
    lockDuration: 30000,
  }
);

followupWorker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, err: error.message }, "Followup worker job failed");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await followupWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await followupWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

export default followupWorker;
