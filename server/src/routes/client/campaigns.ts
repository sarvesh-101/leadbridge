/**
 * Campaign Routes — ported from FastAPI Python backend.
 *
 * Automated follow-up workflows with multi-step task sequences.
 * Supports targeting by lead source, status, location, tags, and score.
 * Tasks can be: CALL, WHATSAPP, SMS, EMAIL, DELAY, CONDITION, WEBHOOK, etc.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// Valid values for frontend enum mapping
const CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"] as const;
const CAMPAIGN_TYPES = ["FOLLOW_UP", "RE_ENGAGEMENT", "NO_SHOW_RECOVERY", "WELCOME", "PROMOTIONAL", "CUSTOM"] as const;
const TASK_ACTIONS = [
  "CALL", "WHATSAPP", "SMS", "EMAIL", "DELAY", "CONDITION",
  "WEBHOOK", "UPDATE_LEAD_STATUS", "ASSIGN_LEAD", "UPDATE_SCORE", "TAG_LEAD", "CUSTOM",
] as const;

export default async function clientCampaignRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── List Campaigns ────────────────────────────────────────────
  fastify.get("/campaigns", async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { status, campaignType } = request.query as Record<string, string>;

    const where: Record<string, unknown> = { clientId };
    if (status && CAMPAIGN_STATUSES.includes(status as any)) {
      where.status = status;
    }
    if (campaignType && CAMPAIGN_TYPES.includes(campaignType as any)) {
      where.campaignType = campaignType;
    }

    const campaigns = await fastify.prisma.campaign.findMany({
      where,
      include: {
        tasks: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { campaigns };
  });

  // ─── Create Campaign ──────────────────────────────────────────
  fastify.post("/campaigns", {
    schema: {
      body: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1 },
          description: { type: "string" },
          campaignType: { type: "string", enum: CAMPAIGN_TYPES },
          targetLeadSources: { type: "array", items: { type: "string" } },
          targetLeadStatuses: { type: "array", items: { type: "string" } },
          targetLocations: { type: "array", items: { type: "string" } },
          targetTags: { type: "array", items: { type: "string" } },
          targetMinScore: { type: "integer" },
          targetMaxScore: { type: "integer" },
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
          workingHoursStart: { type: "string" },
          workingHoursEnd: { type: "string" },
          workingDays: { type: "array", items: { type: "integer" } },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: {
      name: string;
      description?: string;
      campaignType?: string;
      targetLeadSources?: string[];
      targetLeadStatuses?: string[];
      targetLocations?: string[];
      targetTags?: string[];
      targetMinScore?: number;
      targetMaxScore?: number;
      startDate?: string;
      endDate?: string;
      workingHoursStart?: string;
      workingHoursEnd?: string;
      workingDays?: number[];
    };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const {
      name, description, campaignType, targetLeadSources, targetLeadStatuses,
      targetLocations, targetTags, targetMinScore, targetMaxScore,
      startDate, endDate, workingHoursStart, workingHoursEnd, workingDays,
    } = request.body;

    const campaign = await fastify.prisma.campaign.create({
      data: {
        clientId,
        name,
        description: description || null,
        campaignType: (campaignType as any) || "CUSTOM",
        targetLeadSources: targetLeadSources ?? [],
        targetLeadStatuses: targetLeadStatuses ?? [],
        targetLocations: targetLocations ?? [],
        targetTags: targetTags ?? [],
        targetMinScore: targetMinScore ?? 0,
        targetMaxScore: targetMaxScore ?? 100,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        workingHoursStart: workingHoursStart || "09:00",
        workingHoursEnd: workingHoursEnd || "18:00",
        workingDays: workingDays ?? [1, 2, 3, 4, 5, 6],
      },
      include: { tasks: { orderBy: { order: "asc" } } },
    });

    return reply.status(201).send({ campaign });
  });

  // ─── Get Campaign ──────────────────────────────────────────────
  fastify.get("/campaigns/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const campaign = await fastify.prisma.campaign.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
      include: { tasks: { orderBy: { order: "asc" } } },
    });

    if (!campaign) {
      return reply.status(404).send({ error: "Campaign not found" });
    }

    return { campaign };
  });

  // ─── Update Campaign ───────────────────────────────────────────
  // Whitelisted fields to prevent overwriting immutable fields like id, clientId, createdAt
  const CAMPAIGN_UPDATABLE_FIELDS = [
    "name", "description", "campaignType", "status",
    "targetLeadSources", "targetLeadStatuses", "targetLocations", "targetTags",
    "targetMinScore", "targetMaxScore",
    "startDate", "endDate", "workingHoursStart", "workingHoursEnd", "workingDays",
  ];

  fastify.patch("/campaigns/:id", async (request: FastifyRequest<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>, reply: FastifyReply) => {
    const campaign = await fastify.prisma.campaign.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!campaign) {
      return reply.status(404).send({ error: "Campaign not found" });
    }

    // Only allow updating whitelisted fields
    const data = Object.fromEntries(
      CAMPAIGN_UPDATABLE_FIELDS
        .filter((k) => k in request.body)
        .map((k) => [k, request.body[k]])
    );

    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ error: "No valid fields to update" });
    }

    const updated = await fastify.prisma.campaign.update({
      where: { id: campaign.id },
      data: data as any,
      include: { tasks: { orderBy: { order: "asc" } } },
    });

    return { campaign: updated };
  });

  // ─── Activate Campaign ─────────────────────────────────────────
  fastify.post("/campaigns/:id/activate", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const campaign = await fastify.prisma.campaign.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!campaign) {
      return reply.status(404).send({ error: "Campaign not found" });
    }

    await fastify.prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "ACTIVE", activatedAt: new Date() },
    });

    return { message: "Campaign activated" };
  });

  // ─── Pause Campaign ────────────────────────────────────────────
  fastify.post("/campaigns/:id/pause", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const campaign = await fastify.prisma.campaign.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!campaign) {
      return reply.status(404).send({ error: "Campaign not found" });
    }

    await fastify.prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "PAUSED" },
    });

    return { message: "Campaign paused" };
  });

  // ─── Complete Campaign ─────────────────────────────────────────
  fastify.post("/campaigns/:id/complete", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const campaign = await fastify.prisma.campaign.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!campaign) {
      return reply.status(404).send({ error: "Campaign not found" });
    }

    await fastify.prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    return { message: "Campaign completed" };
  });

  // ─── Add Task to Campaign ──────────────────────────────────────
  fastify.post("/campaigns/:id/tasks", {
    schema: {
      body: {
        type: "object",
        required: ["name", "action", "order"],
        properties: {
          name: { type: "string" },
          action: { type: "string", enum: TASK_ACTIONS },
          order: { type: "integer" },
          config: { type: "object" },
          delayAfterPreviousHours: { type: "integer" },
          delayAfterPreviousMinutes: { type: "integer" },
          isCondition: { type: "boolean" },
          conditionField: { type: "string" },
          conditionOperator: { type: "string" },
          conditionValue: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Params: { id: string };
    Body: {
      name: string;
      action: string;
      order: number;
      config?: Record<string, unknown>;
      delayAfterPreviousHours?: number;
      delayAfterPreviousMinutes?: number;
      isCondition?: boolean;
      conditionField?: string;
      conditionOperator?: string;
      conditionValue?: string;
    };
  }>, reply: FastifyReply) => {
    // Verify campaign exists and belongs to client
    const campaign = await fastify.prisma.campaign.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!campaign) {
      return reply.status(404).send({ error: "Campaign not found" });
    }

    const {
      name, action, order, config, delayAfterPreviousHours,
      delayAfterPreviousMinutes, isCondition, conditionField,
      conditionOperator, conditionValue,
    } = request.body;

    const task = await fastify.prisma.campaignTask.create({
      data: {
        campaignId: campaign.id,
        name,
        action: action as any,
        order,
        config: (config ?? {}) as any,
        delayAfterPreviousHours: delayAfterPreviousHours ?? 0,
        delayAfterPreviousMinutes: delayAfterPreviousMinutes ?? 0,
        isCondition: isCondition ?? false,
        conditionField: conditionField ?? null,
        conditionOperator: conditionOperator ?? null,
        conditionValue: conditionValue ?? null,
      },
    });

    return reply.status(201).send({ task });
  });

  // ─── Delete Task ───────────────────────────────────────────────
  fastify.delete("/campaigns/:id/tasks/:taskId", async (request: FastifyRequest<{
    Params: { id: string; taskId: string };
  }>, reply: FastifyReply) => {
    const campaign = await fastify.prisma.campaign.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!campaign) {
      return reply.status(404).send({ error: "Campaign not found" });
    }

    await fastify.prisma.campaignTask.delete({
      where: { id: request.params.taskId },
    });

    return { message: "Task deleted" };
  });

  // ─── Delete Campaign ────────────────────────────────────────────
  fastify.delete("/campaigns/:id", async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const campaign = await fastify.prisma.campaign.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!campaign) {
      return reply.status(404).send({ error: "Campaign not found" });
    }

    // Tasks cascade-deleted automatically via Prisma schema
    await fastify.prisma.campaign.delete({
      where: { id: campaign.id },
    });

    return { message: "Campaign deleted" };
  });

  // ─── Campaign Analytics ────────────────────────────────────────
  fastify.get("/campaigns/analytics/summary", async (request: FastifyRequest) => {
    const clientId = request.clientId!;

    const campaigns = await fastify.prisma.campaign.findMany({
      where: { clientId },
      select: {
        status: true,
        leadsTargeted: true,
        leadsProcessed: true,
        callsMade: true,
        messagesSent: true,
        appointmentsBooked: true,
        conversions: true,
      },
    });

    const total = campaigns.length;
    const active = campaigns.filter((c) => c.status === "ACTIVE").length;
    const draft = campaigns.filter((c) => c.status === "DRAFT").length;
    const completed = campaigns.filter((c) => c.status === "COMPLETED").length;

    const totals = campaigns.reduce(
      (acc, c) => ({
        leadsTargeted: acc.leadsTargeted + c.leadsTargeted,
        leadsProcessed: acc.leadsProcessed + c.leadsProcessed,
        callsMade: acc.callsMade + c.callsMade,
        messagesSent: acc.messagesSent + c.messagesSent,
        appointments: acc.appointments + c.appointmentsBooked,
        conversions: acc.conversions + c.conversions,
      }),
      { leadsTargeted: 0, leadsProcessed: 0, callsMade: 0, messagesSent: 0, appointments: 0, conversions: 0 }
    );

    return {
      totalCampaigns: total,
      activeCampaigns: active,
      draftCampaigns: draft,
      completedCampaigns: completed,
      ...totals,
      conversionRate: totals.leadsProcessed > 0
        ? Math.round((totals.conversions / totals.leadsProcessed) * 100)
        : 0,
    };
  });
}
