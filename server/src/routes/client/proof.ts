/**
 * V2 (T11) — broker Proof dashboard endpoint.
 *
 * GET /client/proof
 *   - last 7 days computed live (same functions as the weekly report)
 *   - 12-week trend from WeeklyBrokerMetric snapshots
 */
import { FastifyInstance, FastifyRequest } from "fastify";
import { computeProofMetrics, weekStartFor } from "../../services/proof-metrics";
import { monthlyCharged } from "../../config/plans";

const DAY = 24 * 60 * 60 * 1000;

export default async function clientProofRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/client/proof", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const to = new Date();
    const from = new Date(to.getTime() - 7 * DAY);

    const client = await fastify.prisma.client.findUnique({
      where: { id: clientId },
      select: { plan: true },
    });

    const [leads, bookings, trend] = await Promise.all([
      fastify.prisma.lead.findMany({
        where: { clientId, receivedAt: { gte: from, lte: to } },
        select: {
          id: true, receivedAt: true, firstCallDelaySeconds: true, status: true,
          budget: true, location: true, propertyType: true, timeline: true,
          calls: { select: { status: true, createdAt: true } },
        },
      }),
      fastify.prisma.booking.findMany({
        where: { clientId, visitDate: { gte: from, lte: to } },
        select: { visitDate: true, status: true },
      }),
      fastify.prisma.weeklyBrokerMetric.findMany({
        where: { clientId },
        orderBy: { weekStart: "desc" },
        take: 12,
        select: {
          weekStart: true, weekEnd: true, leadsReceived: true, medianFirstCallSeconds: true,
          reachRate: true, qualifiedRate: true, visitsBooked: true, visitsCompleted: true,
          costPerCompletedVisit: true,
        },
      }),
    ]);

    const plan = client?.plan === "LAUNCH" ? "STARTER" : client?.plan;
    const planCharged = plan ? monthlyCharged(plan as "STARTER" | "GROWTH" | "PRO") : 0;
    const current = computeProofMetrics(leads, bookings, { from, to }, planCharged);

    return {
      current,
      period: { from, to },
      trend: trend.reverse(),
      weekStartForToday: weekStartFor(to),
      definitions: {
        medianFirstCallSeconds: "Median seconds from max(receivedAt, window open) to the first call attempt.",
        reachRate: "Leads with at least one answered call ÷ leads with at least one call attempt.",
        qualifiedRate: "Leads with a completed qualification ÷ leads reached.",
        costPerCompletedVisit: "Prorated plan price for the period ÷ completed site visits (n/a when zero).",
      },
    };
  });
}
