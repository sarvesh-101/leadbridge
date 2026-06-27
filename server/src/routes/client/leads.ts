import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { enqueueCall } from "../../workers/queues";
import { canTransition, STATUS_DISPLAY } from "../../utils/lifecycle";

export default async function clientLeadRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── List Leads ───────────────────────────────────────────────
  fastify.get("/leads", async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { page = "1", limit = "20", status, source, search, from, to, qualified, updatedSince } =
      request.query as Record<string, string>;

    const where: Record<string, unknown> = { clientId };

    if (status && status !== "all") {
      where.status = status;
    }
    if (source && source !== "all") {
      where.source = source;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }
    if (from || to) {
      where.receivedAt = {};
      if (from) (where.receivedAt as Record<string, unknown>).gte = new Date(from);
      if (to) (where.receivedAt as Record<string, unknown>).lte = new Date(to);
    }

    // Filter by updatedSince — used by frontend WebSocket polling fallback
    // Uses Lead.updatedAt to detect status changes on existing leads
    if (updatedSince) {
      where.updatedAt = { gte: new Date(updatedSince) };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [leads, total] = await Promise.all([
      fastify.prisma.lead.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: { booking: true, _count: { select: { calls: true, customerNotifications: true } } },
        orderBy: { createdAt: "desc" },
      }),
      fastify.prisma.lead.count({ where }),
    ]);

    return { leads, total, page: parseInt(page), limit: parseInt(limit) };
  });

  // ─── Get Lead ─────────────────────────────────────────────────
  fastify.get("/leads/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const lead = await fastify.prisma.lead.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
      include: {
        booking: true,
        calls: { orderBy: { createdAt: "desc" } },
        customerNotifications: { orderBy: { sentAt: "desc" } },
      },
    });

    if (!lead) {
      return reply.status(404).send({ error: "Lead not found" });
    }

    // Get owner notifications for this lead's booking
    const ownerNotifications = lead.bookingId
      ? await fastify.prisma.ownerNotification.findMany({
          where: { bookingId: lead.bookingId },
          orderBy: { sentAt: "desc" },
        })
      : [];

    return { ...lead, ownerNotifications };
  });

  // ─── Create Lead (manual entry) ──────────────────────────────
  fastify.post("/leads", {
    schema: {
      body: {
        type: "object",
        required: ["name", "phone"],
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          source: { type: "string", default: "manual" },
        },
      },
    },
    config: {
      rateLimit: {
        max: 30, // Max 30 manual leads per minute per user
        timeWindow: "1 minute",
      },
    },
  }, async (request: FastifyRequest<{ Body: { name: string; phone: string; email?: string; source?: string } }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { name, phone, email, source = "manual" } = request.body;

    // Check client usage limits
    const client = await fastify.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return reply.status(404).send({ error: "Client not found" });

    if (client.planStatus !== "TRIAL" && client.planStatus !== "ACTIVE") {
      return reply.status(403).send({ error: "Account is not active. Please check your subscription." });
    }

    if (client.plan !== "PRO" && client.callsThisMonth >= client.callsLimit) {
      return reply.status(429).send({ error: "Monthly call limit reached. Upgrade your plan." });
    }

    // Deduplicate — check same phone in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const existing = await fastify.prisma.lead.findFirst({
      where: {
        clientId,
        phone,
        receivedAt: { gte: thirtyDaysAgo },
      },
    });

    if (existing) {
      // Update raw payload only, don't re-call
      await fastify.prisma.lead.update({
        where: { id: existing.id },
        data: { rawPayload: { ...(existing.rawPayload as Record<string, unknown>), duplicateFrom: new Date().toISOString() } },
      });
      return reply.status(200).send({ lead: existing, duplicate: true });
    }

    const lead = await fastify.prisma.lead.create({
      data: {
        clientId,
        name,
        phone,
        email,
        source,
        rawPayload: {},
        status: "PENDING",
        receivedAt: new Date(),
      },
    });

    // Enqueue immediate call
    await enqueueCall({
      leadId: lead.id,
      clientId,
      callType: "QUALIFICATION",
      attempt: 1,
    });

    return reply.status(201).send({ lead });
  });

  // ─── Update Lead Status (broker confirms VISITED or CONVERTED) ─
  fastify.patch("/leads/:id/status", async (request: FastifyRequest<{
    Params: { id: string };
    Body: { status: string };
  }>, reply: FastifyReply) => {
    const lead = await fastify.prisma.lead.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!lead) {
      return reply.status(404).send({ error: "Lead not found" });
    }

    const newStatus = request.body.status;

    // Allow VISITED and CONVERTED for broker overrides
    if (!["VISITED", "CONVERTED"].includes(newStatus) && !canTransition(lead.status, newStatus)) {
      return reply.status(400).send({
        error: `Cannot transition from ${lead.status} to ${newStatus}`,
      });
    }

    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === "VISITED") updateData.visitedAt = new Date();
    if (newStatus === "CONVERTED") updateData.convertedAt = new Date();
    if (newStatus === "COLD") updateData.coldAt = new Date();

    const updated = await fastify.prisma.lead.update({
      where: { id: lead.id },
      data: updateData,
    });

    // If VISITED, also update booking
    if (newStatus === "VISITED" && lead.bookingId) {
      await fastify.prisma.booking.update({
        where: { id: lead.bookingId },
        data: { status: "VISITED", visitedAt: new Date() },
      });
    }

    return { lead: updated };
  });

  // ─── Add Notes ────────────────────────────────────────────────
  fastify.patch("/leads/:id/notes", async (request: FastifyRequest<{
    Params: { id: string };
    Body: { notes?: string };
  }>, reply: FastifyReply) => {
    const lead = await fastify.prisma.lead.update({
      where: { id: request.params.id, clientId: request.clientId },
      data: { rawPayload: { notes: request.body.notes } },
    });
    return { lead };
  });
}
