/**
 * V2 (T15) — "Test with my own number" during onboarding.
 *
 * POST /client/onboarding/test-call
 *   - places ONE AI call to the broker's verified own phone using their script
 *   - does NOT consume a lead-handled slot (source = onboarding_test is excluded
 *     from metering, exactly like the doc requires)
 *   - rate limited to 3 per day per broker
 *   - respects the 09:00–21:00 IST calling window (reschedules, never dials out of hours)
 *   - stamps Client.firstCallAt for the onboarding-speed median (set by call completion)
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { enqueueCall } from "../../workers/queues";
import { isWithinCallingWindow, nextWindowStart } from "../../utils/call-window";
import { logger } from "../../utils/logger";

const MAX_PER_DAY = 3;
const DAY = 24 * 60 * 60 * 1000;

export default async function onboardingTestRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post("/client/onboarding/test-call", async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = request.clientId!;

    const client = await fastify.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, phone: true, planStatus: true, firstCallAt: true, callScript: true },
    });
    if (!client) return reply.status(404).send({ error: "Client not found" });
    if (client.planStatus !== "TRIAL" && client.planStatus !== "ACTIVE") {
      return reply.status(403).send({ error: "Activate your account to place a test call." });
    }

    const since = new Date(Date.now() - DAY);
    const todayCount = await fastify.prisma.lead.count({
      where: { clientId, source: "onboarding_test", createdAt: { gte: since } },
    });
    if (todayCount >= MAX_PER_DAY) {
      return reply.status(429).send({
        error: `Test calls are limited to ${MAX_PER_DAY} per day. Try again tomorrow.`,
      });
    }

    // Own-number call only — never an arbitrary third party.
    const lead = await fastify.prisma.lead.create({
      data: {
        clientId,
        name: "Onboarding test call",
        phone: client.phone,
        source: "onboarding_test",
        portalSource: null,
        status: "PENDING",
        receivedAt: new Date(),
        rawPayload: { kind: "onboarding_test", requestedAt: new Date().toISOString() },
      },
    });

    const withinWindow = isWithinCallingWindow();
    const delayMs = withinWindow ? 0 : Math.max(0, nextWindowStart().getTime() - Date.now());

    await enqueueCall(
      { leadId: lead.id, clientId, callType: "QUALIFICATION", attempt: 1 },
      delayMs
    );

    if (!client.firstCallAt) {
      await fastify.prisma.client.update({
        where: { id: clientId },
        data: { firstCallAt: new Date() },
      });
    }

    logger.info({ clientId, leadId: lead.id, delayMs }, "Onboarding test call queued");

    return {
      queued: true,
      leadId: lead.id,
      withinCallingWindow: withinWindow,
      scheduledInSeconds: Math.round(delayMs / 1000),
      message: withinWindow
        ? "Your phone will ring in about 30 seconds."
        : "Demo calls run 9 AM to 9 PM IST. Your test call is scheduled for the next window.",
      countsAsLead: false,
    };
  });
}
