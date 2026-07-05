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

    // Auto-assign lead to team member (round-robin/workload-based)
    const { assignLead } = await import("../../services/lead-assignment.service");
    assignLead(clientId, lead.id).catch(() => {});

    // Auto-match lead to properties for suggestions + notification
    const { matchLeadToProperties } = await import("../../services/property-matching.service");
    matchLeadToProperties(lead.id, clientId).catch(() => {});

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

    const clientId = request.clientId!;

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

    // Record scoring outcome for feedback training loop
    if (["CONVERTED", "COLD", "VISITED"].includes(newStatus)) {
      const { recordScoringOutcome } = await import("../../services/scoring.service");
      recordScoringOutcome(lead.id, newStatus.toLowerCase() as any).catch(() => {});
    }

    // Create audit log entry for team member tracking
    await fastify.prisma.auditLog.create({
      data: {
        clientId,
        userId: request.userId || request.clientId || null,
        action: `lead.status_changed`,
        resourceType: "lead",
        resourceId: lead.id,
        changes: { from: lead.status, to: newStatus, changedBy: "broker" },
        status: "success",
      },
    });

    return { lead: updated };
  });

  // ─── Manual Score Override ──────────────────────────────────────
  fastify.patch("/leads/:id/score", async (request: FastifyRequest<{
    Params: { id: string };
    Body: { score: number; reason?: string };
  }>, reply: FastifyReply) => {
    const lead = await fastify.prisma.lead.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!lead) {
      return reply.status(404).send({ error: "Lead not found" });
    }

    const { score, reason } = request.body;
    const clampedScore = Math.max(0, Math.min(100, score));

    await fastify.prisma.lead.update({
      where: { id: lead.id },
      data: { score: clampedScore },
    });

    // Track in score history
    await fastify.prisma.leadScoreHistory.create({
      data: {
        leadId: lead.id,
        score: clampedScore,
        factors: {},
        source: "manual",
        reason: reason || "Manual override by broker",
      },
    });

    return { score: clampedScore };
  });

  // ─── Get Score History ─────────────────────────────────────────
  fastify.get("/leads/:id/score-history", async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const lead = await fastify.prisma.lead.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!lead) {
      return reply.status(404).send({ error: "Lead not found" });
    }

    const history = await fastify.prisma.leadScoreHistory.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return { history };
  });

  // ─── Score Breakdown ───────────────────────────────────────────
  fastify.get("/leads/:id/score-breakdown", async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const lead = await fastify.prisma.lead.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!lead) {
      return reply.status(404).send({ error: "Lead not found" });
    }

    const { scoreLead } = await import("../../services/scoring.service");
    const { score, factors } = await scoreLead(lead.id);

    // Factor definitions with labels and icons for frontend display
    const factorLabels: Record<string, { label: string; description: string; weight: string }> = {
      source: { label: "Source Quality", description: "Quality score based on lead source", weight: "20%" },
      latency: { label: "Response Speed", description: "Faster response = higher score", weight: "15%" },
      timeline: { label: "Timeline Urgency", description: "Immediate buyers score highest", weight: "20%" },
      budget: { label: "Budget Fit", description: "Budget range match score", weight: "15%" },
      propertyType: { label: "Property Match", description: "Property type preference", weight: "10%" },
      callHour: { label: "Call Timing", description: "Business hours preference", weight: "10%" },
      territory: { label: "Territory Match", description: "Location match with broker territory", weight: "10%" },
      sentiment: { label: "Sentiment", description: "Call sentiment boost or penalty", weight: "Bonus" },
    };

    // Get the last 5 score history entries for trend
    const history = await fastify.prisma.leadScoreHistory.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Generate AI-style explanation based on factors
    const topFactor = Object.entries(factors)
      .filter(([k]) => k !== "error")
      .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))[0];

    const explanation = generateScoreExplanation(score, factors, topFactor?.[0] || "");

    return {
      score,
      factors,
      factorLabels,
      explanation,
      history,
    };
  });

  // ─── Re-score Lead ────────────────────────────────────────────
  fastify.post("/leads/:id/re-score", async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const lead = await fastify.prisma.lead.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!lead) {
      return reply.status(404).send({ error: "Lead not found" });
    }

    const { scoreLead } = await import("../../services/scoring.service");
    const result = await scoreLead(lead.id);

    return { score: result.score, factors: result.factors };
  });

  // ─── Scoring Accuracy Analysis ─────────────────────────────────
  fastify.get("/scoring/accuracy", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const { calculateScoringAccuracy } = await import("../../services/scoring.service");
    const accuracy = await calculateScoringAccuracy(clientId);
    return accuracy;
  });

  // ─── Scoring Weight Recalibration ──────────────────────────────
  fastify.get("/scoring/recalibrate", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const { recalibrateWeights } = await import("../../services/scoring.service");
    const result = await recalibrateWeights(clientId);
    return result;
  });

  // ─── Scoring Explainability Insights ───────────────────────────
  fastify.get("/leads/:id/scoring-insights", async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const lead = await fastify.prisma.lead.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!lead) {
      return reply.status(404).send({ error: "Lead not found" });
    }

    const { getScoringInsights } = await import("../../services/scoring.service");
    const insights = await getScoringInsights(lead.id);
    return insights;
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

/**
 * Generate a natural-language explanation of why a lead has its score.
 * Used by the score breakdown endpoint.
 */
function generateScoreExplanation(
  score: number,
  factors: Record<string, number>,
  topFactorKey: string
): string {
  const level = score >= 70 ? "high" : score >= 40 ? "moderate" : "low";

  const factorExplanations: Record<string, string> = {
    source: "the lead came from a quality source",
    latency: "the lead was contacted quickly",
    timeline: "the lead has an urgent timeline",
    budget: "the lead's budget aligns well with typical deals",
    propertyType: "the lead's property preference matches common listings",
    callHour: "the call happened during business hours",
    territory: "the lead is within the broker's territory",
    sentiment: "the call sentiment affects the score",
  };

  const topExplanation = factorExplanations[topFactorKey] || "various factors align";

  const topPhrase = score >= 50
    ? `The strongest contributor is that ${topExplanation}.`
    : `The main factor dragging the score is that ${topExplanation}.`;

  return `This lead has a **${level} conversion probability** (${score}/100). ${topPhrase} Overall, the lead shows ${level === "high" ? "strong buying intent and should be prioritized for follow-up." : level === "moderate" ? "some interest but may need additional nurturing before closing." : "limited engagement signals. Consider re-engagement campaigns or re-qualification."}`;
}
