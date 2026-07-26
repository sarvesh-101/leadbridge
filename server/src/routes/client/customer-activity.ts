/**
 * Customer Portal Activity — broker-facing endpoint to view what leads
 * have done on the customer portal (OTP logins, booking confirms/reschedules/cancels).
 *
 * This reads from the AuditLog table where action starts with "customer.".
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export default async function customerActivityRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── Get customer portal activity for a specific lead ─────────
  fastify.get("/customer-activity/:leadId", async (
    request: FastifyRequest<{ Params: { leadId: string } }>,
    reply: FastifyReply
  ) => {
    const clientId = request.clientId!;
    const { leadId } = request.params;

    // Verify the lead belongs to this client
    const lead = await fastify.prisma.lead.findFirst({
      where: { id: leadId, clientId },
      select: { id: true },
    });

    if (!lead) {
      return reply.status(404).send({ error: "Lead not found" });
    }

    // Fetch all audit log entries for this lead's customer portal actions
    const logs = await fastify.prisma.auditLog.findMany({
      where: {
        clientId,
        resourceId: leadId,
        action: { startsWith: "customer." },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Also fetch customer WhatsApp notifications for the lead
    const notifications = await fastify.prisma.customerNotification.findMany({
      where: { leadId },
      orderBy: { sentAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        channel: true,
        message: true,
        status: true,
        sentAt: true,
      },
    });

    // Fetch owner notifications for this lead (booking-related)
    const ownerNotifs = await fastify.prisma.ownerNotification.findMany({
      where: { leadId },
      orderBy: { sentAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        message: true,
        status: true,
        sentAt: true,
      },
    });

    return {
      customerLogins: logs.filter((l) => l.action === "customer.otp.verify.success"),
      bookingActions: logs.filter((l) => l.action.startsWith("customer.booking.")),
      allActivity: logs,
      whatsappMessages: notifications,
      ownerNotifications: ownerNotifs,
    };
  });

  // ─── Customer portal activity summary (for dashboard widget) ──
  fastify.get("/customer-activity/summary", async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const clientId = request.clientId!;
    const daysBack = 7;

    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const logs = await fastify.prisma.auditLog.findMany({
      where: {
        clientId,
        action: { startsWith: "customer." },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        action: true,
        resourceId: true,
        createdAt: true,
        changes: true,
      },
    });

    // Aggregate by action type
    const actionCounts: Record<string, number> = {};
    for (const log of logs) {
      const shortAction = log.action.replace("customer.", "");
      actionCounts[shortAction] = (actionCounts[shortAction] || 0) + 1;
    }

    // Count unique leads who used the portal
    const uniqueLeads = new Set(logs.map((l) => l.resourceId).filter(Boolean));

    return {
      period: `${daysBack} days`,
      totalActions: logs.length,
      uniqueLeads: uniqueLeads.size,
      actionCounts,
      recentActivity: logs.slice(0, 20),
    };
  });
}
