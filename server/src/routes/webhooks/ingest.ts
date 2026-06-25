import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@prisma/client";
import { parseLead, parseWithMapping } from "../../utils/lead-parser";
import { enqueueCall } from "../../workers/queues";
import { emitNewLead } from "../../services/websocket.service";

/**
 * Lead Ingestion Webhook — receives leads from portals.
 * POST /api/v1/webhooks/ingest/:token
 *
 * The token maps to a WebhookSource which maps to a Client.
 */
export default async function ingestWebhookRoutes(fastify: FastifyInstance) {
  // ─── Portal Webhook Ingestion ─────────────────────────────────
  fastify.post("/webhooks/ingest/:token", {
    config: { rateLimit: { max: 200, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
    const { token } = request.params;
    const payload = request.body as Record<string, unknown>;

    // Find webhook source by token
    const source = await fastify.prisma.webhookSource.findUnique({
      where: { token },
      include: {
        client: {
          select: {
            id: true,
            planStatus: true,
            plan: true,
            callsThisMonth: true,
            callsLimit: true,
            ownerWhatsapp: true,
          },
        },
      },
    });

    if (!source || !source.active) {
      return reply.status(404).send({ error: "Invalid or inactive webhook source" });
    }

    const client = source.client;
    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }

    // Check account status
    if (client.planStatus !== "TRIAL" && client.planStatus !== "ACTIVE") {
      return reply.status(402).send({ error: "Account inactive" });
    }

    // Check call limit (skip check for PRO)
    if (client.plan !== "PRO" && client.callsThisMonth >= client.callsLimit) {
      return reply.status(429).send({ error: "Call limit reached" });
    }

    // Parse the payload
    let leadData: { name: string; phone: string; email?: string };
    try {
      if (source.parserConfig && Object.keys(source.parserConfig as Record<string, unknown>).length > 0) {
        // Use custom field mapping
        leadData = parseWithMapping(payload, source.parserConfig as unknown as Record<string, string>);
      } else {
        // Use source-based auto-detection
        leadData = parseLead(source.name, payload);
      }
    } catch (parseError: any) {
      return reply.status(400).send({ error: `Failed to parse lead: ${parseError.message}` });
    }

    if (!leadData.phone || leadData.phone.length < 10) {
      return reply.status(400).send({ error: "Invalid phone number" });
    }

    // Deduplicate — check same phone + clientId in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const existing = await fastify.prisma.lead.findFirst({
      where: {
        clientId: client.id,
        phone: leadData.phone,
        receivedAt: { gte: thirtyDaysAgo },
      },
    });

    if (existing) {
      // Update raw payload, skip call
      await fastify.prisma.lead.update({
        where: { id: existing.id },
        data: { rawPayload: payload as Prisma.InputJsonValue },
      });
      return reply.status(200).send({ lead: existing, duplicate: true });
    }

    // Create the lead
    const lead = await fastify.prisma.lead.create({
      data: {
        clientId: client.id,
        name: leadData.name,
        phone: leadData.phone,
        email: leadData.email || null,
        source: source.name,
        rawPayload: payload as Prisma.InputJsonValue,
        status: "PENDING",
        receivedAt: new Date(),
      },
    });

    // Enqueue immediate call (within seconds)
    await enqueueCall({
      leadId: lead.id,
      clientId: client.id,
      callType: "QUALIFICATION",
      attempt: 1,
    });

    // Publish WebSocket event for real-time dashboard update
    await emitNewLead(lead.id, lead.name, source.name, client.id).catch(() => {});

    return reply.status(200).send({ lead, duplicate: false });
  });

  // ─── Email-based lead ingestion ───────────────────────────────
  fastify.post("/webhooks/email/:token", {
    config: { rateLimit: { max: 50, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
    // For now, email parsing is treated similarly to webhook
    // In production, this would parse email content
    const { token } = request.params;
    const payload = request.body as Record<string, unknown>;

    const source = await fastify.prisma.webhookSource.findUnique({
      where: { token },
      include: { client: true },
    });

    if (!source || !source.active) {
      return reply.status(404).send({ error: "Invalid webhook source" });
    }

    // For email sources, try to extract lead info from email body
    const emailBody = (payload.body || payload.text || "") as string;
    const subject = (payload.subject || "") as string;

    // Basic extraction from email
    const nameMatch = emailBody.match(/(?:Name|name)[:\s]+([A-Za-z\s]+)/);
    const phoneMatch = emailBody.match(/(?:Phone|phone|Mobile|mobile)[:\s]+([0-9+\-\s]{10,15})/);
    const emailMatch = emailBody.match(/(?:Email|email)[:\s]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);

    const name = nameMatch?.[1]?.trim() || subject || "Unknown";
    const phone = phoneMatch?.[1]?.replace(/\D/g, "") || "";
    const email = emailMatch?.[1] || undefined;

    if (!phone || phone.length < 10) {
      return reply.status(400).send({ error: "Could not extract phone number from email" });
    }

    // Deduplicate and create lead (same logic as above)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const existing = await fastify.prisma.lead.findFirst({
      where: {
        clientId: source.clientId,
        phone: `+91${phone.slice(-10)}`,
        receivedAt: { gte: thirtyDaysAgo },
      },
    });

    if (existing) {
      return reply.status(200).send({ lead: existing, duplicate: true });
    }

    const lead = await fastify.prisma.lead.create({
      data: {
        clientId: source.clientId,
        name,
        phone: `+91${phone.slice(-10)}`,
        email,
        source: source.name,
        rawPayload: payload as Prisma.InputJsonValue,
        status: "PENDING",
      },
    });

    await enqueueCall({
      leadId: lead.id,
      clientId: source.clientId,
      callType: "QUALIFICATION",
      attempt: 1,
    });

    // Publish WebSocket event
    await emitNewLead(lead.id, lead.name, source.name, source.clientId).catch(() => {});

    return reply.status(200).send({ lead, duplicate: false });
  });
}
