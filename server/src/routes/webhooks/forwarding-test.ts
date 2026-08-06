/**
 * Forwarding Test Endpoint — authenticated route for testing lead forwarding.
 *
 * POST /api/v1/forwarding/test
 *
 * Unlike the anonymous SMS/email webhooks (which rely on From number lookup),
 * this endpoint is JWT-protected and uses the authenticated client's ID directly.
 * This allows brokers to test forwarding without needing to actually send an SMS.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { parseSmsLead } from "../../utils/sms-lead-parser";
import { enqueueCall } from "../../workers/queues";
import { emitNewLead } from "../../services/websocket.service";
import { tryAcquireLock, releaseLock } from "../../utils/distributed-lock";
import { logger } from "../../utils/logger";

export default async function forwardingTestRoutes(fastify: FastifyInstance) {
  // ─── Test forwarding — authenticated ──────────────────────────
  fastify.post("/forwarding/test", {
    schema: {
      body: {
        type: "object",
        required: ["phone", "body"],
        properties: {
          phone: { type: "string", minLength: 10 },
          body: { type: "string", minLength: 5 },
        },
      },
    },
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{ Body: { phone: string; body: string } }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { phone, body } = request.body;
    const requestId = (request as unknown as Record<string, unknown>).requestId || "test-no-id";

    logger.info({ clientId, phone, bodyLen: body.length, requestId }, "[FORWARDING-TEST] Testing lead forwarding");

    // Get client details for limit/status checks
    const client = await fastify.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        plan: true,
        planStatus: true,
        callsThisMonth: true,
        callsLimit: true,
        leadsThisMonth: true,
      },
    });

    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }

    if (client.planStatus !== "TRIAL" && client.planStatus !== "ACTIVE") {
      return reply.status(402).send({ error: "Account inactive" });
    }

    // FIX Round-2 #6: monthly leads cap (plan.leads)
    const { checkMonthlyLeadsCapacity, monthlyLeadsCapError } = await import("../../utils/lead-limits");
    const monthlyLeads = await checkMonthlyLeadsCapacity(fastify.prisma, clientId, client.plan);
    if (!monthlyLeads.canIngest) {
      return reply.status(429).send(monthlyLeadsCapError(monthlyLeads.limit));
    }

    // FIX P0-3: Call quota check — leads are ALWAYS stored. If the broker is
    // out of monthly calls, the lead is kept and only the auto-call is skipped
    // (with an owner notification), instead of rejecting the forwarded lead.
    const callAllowed = client.plan === "PRO" || client.callsThisMonth < client.callsLimit;

    // Parse the test body
    const parsed = parseSmsLead(body);
    if (!parsed || !parsed.phone) {
      return reply.status(400).send({
        error: "Could not extract lead info from the provided text",
        hint: "Make sure the text includes a name and phone number. Example: 'Rahul Sharma 9876543210 2BHK Andheri 80L'",
        examples: [
          "Rahul Sharma 9876543210 2BHK Andheri 80L",
          "New lead: Priya Patel, 9988776655, budget 1.2 Cr, wants 2BHK in Bandra",
        ],
      });
    }

    // Dedup with distributed lock (same pattern as main ingest webhook)
    const dedupLockId = `dedup:${clientId}:${parsed.phone}`;
    const lockAcquired = await tryAcquireLock(fastify, dedupLockId, 5);

    let existing: any = null;
    let lead: any = null;

    try {
      if (lockAcquired) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        existing = await fastify.prisma.lead.findFirst({
          where: {
            clientId,
            phone: parsed.phone,
            receivedAt: { gte: thirtyDaysAgo },
            status: { notIn: ["COLD", "CONVERTED"] },
          },
        });

        if (!existing) {
          lead = await fastify.prisma.lead.create({
            data: {
              clientId,
              name: parsed.name,
              phone: parsed.phone,
              email: parsed.email || null,
              source: "test_forward",
              budget: parsed.budget || null,
              location: parsed.location || null,
              propertyType: parsed.propertyType || null,
              bedrooms: parsed.bedrooms || null,
              status: "PENDING",
              receivedAt: new Date(),
              rawPayload: {
                testBody: body,
                parsedAt: new Date().toISOString(),
                method: "forwarding_test",
              },
            },
          });
        }
      } else {
        // Fallback without lock
        lead = await fastify.prisma.lead.create({
          data: {
            clientId,
            name: parsed.name,
            phone: parsed.phone,
            email: parsed.email || null,
            source: "test_forward",
            portalSource: parsed.source,
            budget: parsed.budget || null,
            location: parsed.location || null,
            propertyType: parsed.propertyType || null,
            bedrooms: parsed.bedrooms || null,
            status: "PENDING",
            receivedAt: new Date(),
            rawPayload: {
              testBody: body,
              parsedAt: new Date().toISOString(),
              method: "forwarding_test",
            },
          },
        });
      }
    } finally {
      if (lockAcquired) {
        await releaseLock(fastify, dedupLockId);
      }
    }

    if (existing) {
      return reply.status(200).send({
        status: "duplicate",
        message: "A lead with this phone number already exists in the last 30 days",
        lead: existing,
      });
    }

    if (!lead) {
      return reply.status(500).send({ error: "Failed to create lead" });
    }

    // FIX Round-2 #6: consume monthly leads allowance (race-safe)
    const { tryConsumeMonthlyLead } = await import("../../utils/lead-limits");
    await tryConsumeMonthlyLead(fastify.prisma, clientId, client.plan);

    // Enqueue AI call (non-blocking) — only if broker has call quota
    Promise.allSettled([
      (async () => {
        try {
          if (callAllowed) {
            await enqueueCall({
              leadId: lead.id,
              clientId,
              callType: "QUALIFICATION",
              attempt: 1,
            });
          } else {
            await fastify.prisma.ownerNotification.create({
              data: {
                clientId,
                leadId: lead.id,
                type: "CALL_SKIPPED_LIMIT",
                message: `Test lead (${parsed.name}) received — AI call skipped because your monthly call limit is reached. Upgrade to resume AI calls.`,
                status: "sent",
                sentAt: new Date(),
              },
            }).catch(() => {});
          }
        } catch { /* non-blocking */ }
      })(),
      emitNewLead(lead.id, lead.name, "test_forward", clientId).catch(() => {}),
    ]);

    logger.info({ clientId, leadId: lead.id, phone: parsed.phone, requestId },
      "[FORWARDING-TEST] Test lead created successfully");

    return reply.status(200).send({
      status: "created",
      callSkipped: !callAllowed,
      message: callAllowed
        ? "Test lead created — AI call queued."
        : "Test lead created — AI call SKIPPED because your monthly call limit is reached.",
      leadId: lead.id,
      lead: {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        source: lead.source,
        budget: lead.budget,
        location: lead.location,
      },
      parsed: {
        name: parsed.name,
        phone: parsed.phone,
        email: parsed.email,
        budget: parsed.budget,
        location: parsed.location,
        propertyType: parsed.propertyType,
        bedrooms: parsed.bedrooms,
      },
    });
  });
}
