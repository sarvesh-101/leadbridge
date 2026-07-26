/**
 * Demo Routes — Investor Presentation Endpoints
 *
 * These routes are ONLY available when DEMO_MODE=true.
 * They allow you to trigger simulated events that make the system
 * look fully functional during investor demos.
 *
 * Endpoints:
 *   POST /demo/seed-data     — Generate 50+ realistic leads with varied statuses
 *   POST /demo/trigger-call/:leadId  — Simulate AI calling a specific lead
 *   POST /demo/call-result/:leadId   — Simulate a call result (qualified/no-answer/etc.)
 *   POST /demo/trigger-followup/:leadId — Trigger next follow-up step
 *   POST /demo/simulate-day  — Fast-forward 24 hours (runs cron-style events)
 *   GET  /demo/status        — Show demo progress summary
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { LeadStatus } from "@prisma/client";
import { config } from "../config";
import { logger } from "../utils/logger";
import { emitStatusChange } from "../services/websocket.service";

// NOTE: These demo routes intentionally use direct Prisma operations instead of
// BullMQ queues (enqueueCall, enqueueNotification, etc.) because BullMQ requires
// Redis. For investor demos, we may not have Redis running. Direct DB operations
// ensure the demo works with just PostgreSQL.

const DEMO_LEAD_SOURCES = ["99acres", "MagicBricks", "Housing.com", "JustDial", "Facebook", "Google Ads", "WhatsApp", "IndiaMart"];
const DEMO_LOCATIONS_MUMBAI = [
  "Andheri West", "Andheri East", "Bandra West", "Bandra East", "Malad West",
  "Malad East", "Goregaon West", "Goregaon East", "Powai", "Juhu",
  "Dadar", "Worli", "Lower Parel", "Colaba", "Chembur",
];
const DEMO_BUDGETS = [
  "30L-50L", "50L-80L", "80L-1.2Cr", "1Cr-1.5Cr", "1.5Cr-2Cr", "2Cr-3Cr", "3Cr-5Cr",
];
const DEMO_TIMELINES = ["Immediate", "1 month", "2-3 months", "3-4 months", "6 months"];
const DEMO_FIRST_NAMES = [
  "Amit", "Priya", "Rahul", "Neha", "Vikram", "Ananya", "Suresh", "Pooja",
  "Deepak", "Kavita", "Rohit", "Shweta", "Manish", "Divya", "Alok",
  "Nandini", "Vivek", "Isha", "Gaurav", "Meera", "Tarun", "Ritu",
  "Harsh", "Bhavna", "Kunal", "Pallavi", "Siddharth", "Anjali", "Nitin", "Sonali",
];
const DEMO_LAST_NAMES = [
  "Sharma", "Patel", "Singh", "Verma", "Gupta", "Reddy", "Joshi", "Mehta",
  "Kumar", "Desai", "Nair", "Menon", "Chopra", "Agarwal", "Iyer",
];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone(): string {
  const prefix = ["98765", "99887", "91234", "97654", "88990", "87765", "96543", "90090"];
  return `+91${randomPick(prefix)}${String(Math.floor(100000 + Math.random() * 899999))}`;
}

export default async function demoRoutes(fastify: FastifyInstance) {
  // ─── Check DEMO_MODE (before auth so we fail fast) ──────────
  fastify.addHook("preHandler", async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!config.DEMO_MODE) {
      return reply.status(403).send({ error: "Demo routes only available in DEMO_MODE" });
    }
  });

  // ─── Authenticate all demo routes ───────────────────────────
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── GET /demo/status — Demo progress summary ───────────────
  fastify.get("/demo/status", async (request: FastifyRequest) => {
    const clientId = request.clientId!;

    const [leads, calls, bookings, notifications] = await Promise.all([
      fastify.prisma.lead.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 5 }),
      fastify.prisma.call.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 5 }),
      fastify.prisma.booking.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 5 }),
      fastify.prisma.ownerNotification.count({ where: { clientId } }),
    ]);

    const leadCounts = await fastify.prisma.lead.groupBy({
      by: ["status"],
      where: { clientId },
      _count: true,
    });

    const statusBreakdown = Object.fromEntries(
      leadCounts.map((l) => [l.status, l._count])
    );

    return {
      demoMode: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalLeads: leadCounts.reduce((sum, l) => sum + l._count, 0),
        totalCalls: calls.length,
        totalBookings: bookings.length,
        totalNotifications: notifications,
        statusBreakdown,
      },
      recentActivity: {
        leads: leads.map((l) => ({ id: l.id, name: l.name, status: l.status, createdAt: l.createdAt })),
        calls: calls.map((c) => ({ id: c.id, type: c.type, status: c.status, createdAt: c.createdAt })),
        bookings: bookings.map((b) => ({ id: b.id, status: b.status, visitDate: b.visitDate })),
      },
      demoActions: [
        { method: "POST", path: "/api/v1/demo/seed-data", description: "Generate 50+ realistic leads" },
        { method: "POST", path: "/api/v1/demo/trigger-call/:leadId", description: "Simulate AI calling a lead" },
        { method: "POST", path: "/api/v1/demo/call-result/:leadId", description: "Submit call result (qualified/no-answer)" },
        { method: "POST", path: "/api/v1/demo/trigger-followup/:leadId", description: "Trigger next follow-up" },
        { method: "POST", path: "/api/v1/demo/simulate-day", description: "Fast-forward 24 hours of events" },
      ],
    };
  });

  // ─── POST /demo/seed-data — Generate demo leads ────────────
  fastify.post("/demo/seed-data", async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = request.clientId!;

    const client = await fastify.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, businessName: true, city: true },
    });

    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }

    // Lead status distribution for realistic demo
    const statusDistribution: Array<{ status: LeadStatus; weight: number }> = [
      { status: "PENDING" as LeadStatus, weight: 15 },
      { status: "CALLING" as LeadStatus, weight: 8 },
      { status: "BOOKED" as LeadStatus, weight: 10 },
      { status: "VISITED" as LeadStatus, weight: 5 },
      { status: "CONVERTED" as LeadStatus, weight: 3 },
      { status: "NO_ANSWER" as LeadStatus, weight: 8 },
      { status: "NO_SHOW" as LeadStatus, weight: 4 },
      { status: "FOLLOWUP_D1" as LeadStatus, weight: 5 },
      { status: "FOLLOWUP_D2" as LeadStatus, weight: 3 },
      { status: "FOLLOWUP_D3" as LeadStatus, weight: 3 },
      { status: "COLD" as LeadStatus, weight: 5 },
      { status: "CALL_FAILED" as LeadStatus, weight: 3 },
    ];

    const totalWeight = statusDistribution.reduce((s, d) => s + d.weight, 0);
    const leadsToCreate = 50;
    let created = 0;
    let bookingsCreated = 0;

    for (let i = 0; i < leadsToCreate; i++) {
      // Pick status by weighted random
      let rand = Math.random() * totalWeight;
      let status: LeadStatus = "PENDING" as LeadStatus;
      for (const dist of statusDistribution) {
        rand -= dist.weight;
        if (rand <= 0) {
          status = dist.status;
          break;
        }
      }

      const firstName = randomPick(DEMO_FIRST_NAMES);
      const lastName = randomPick(DEMO_LAST_NAMES);
      const location = randomPick(DEMO_LOCATIONS_MUMBAI);
      const createdAt = new Date(Date.now() - Math.floor(Math.random() * 14 * 24 * 3600000));
      const score = status === "CONVERTED" ? 90 + Math.floor(Math.random() * 10)
        : status === "VISITED" ? 70 + Math.floor(Math.random() * 20)
        : status === "BOOKED" ? 60 + Math.floor(Math.random() * 20)
        : status === "CALLING" || status === "PENDING" ? 30 + Math.floor(Math.random() * 30)
        : Math.floor(Math.random() * 40);

      const lead = await fastify.prisma.lead.create({
        data: {
          clientId,
          name: `${firstName} ${lastName}`,
          phone: randomPhone(),
          source: randomPick(DEMO_LEAD_SOURCES),
          rawPayload: {},
          status,
          budget: randomPick(DEMO_BUDGETS),
          location,
          timeline: randomPick(DEMO_TIMELINES),
          score,
          callAttempts: ["CALLING", "FOLLOWUP_D1", "FOLLOWUP_D2", "FOLLOWUP_D3", "NO_ANSWER"]
            .includes(status) ? Math.floor(Math.random() * 2) + 1 : 0,
          firstCalledAt: ["CALLING", "BOOKED", "VISITED", "CONVERTED", "NO_SHOW", "FOLLOWUP_D1", "FOLLOWUP_D2", "FOLLOWUP_D3"]
            .includes(status) ? createdAt : null,
          createdAt,
          receivedAt: createdAt,
        },
      });

      // Create bookings for booked/visited/converted leads
      if (["BOOKED", "VISITED", "CONVERTED", "NO_SHOW"].includes(status)) {
        bookingsCreated++;
        const visitDate = new Date(Date.now() + Math.floor(Math.random() * 14 - 3) * 24 * 3600000);
        const booking = await fastify.prisma.booking.create({
          data: {
            clientId,
            visitDate,
            visitTime: `${10 + Math.floor(Math.random() * 7)}:${Math.random() > 0.5 ? "00" : "30"} ${Math.random() > 0.5 ? "AM" : "PM"}`,
            propertyAddress: `${location}, ${client.city || "Mumbai"}`,
            propertyName: `${Math.floor(Math.random() * 3) + 1}BHK Premium Apartment`,
            status: status === "VISITED" ? "VISITED" as any : status === "CONVERTED" ? "VISITED" as any : status === "NO_SHOW" ? "NO_SHOW" as any : "CONFIRMED" as any,
            confirmedAt: new Date(createdAt.getTime() + 3600000),
            visitedAt: ["VISITED", "CONVERTED"].includes(status) ? new Date() : null,
            noShowAt: status === "NO_SHOW" ? new Date() : null,
          },
        });

        await fastify.prisma.lead.update({
          where: { id: lead.id },
          data: { bookingId: booking.id, bookedAt: new Date(createdAt.getTime() + 3600000) },
        });

        await fastify.prisma.call.create({
          data: {
            clientId,
            leadId: lead.id,
            type: "QUALIFICATION",
            direction: "outbound",
            duration: Math.floor(Math.random() * 180) + 30,
            status: "COMPLETED" as any,
            transcript: `[DEMO] Simulated qualification call transcript for ${firstName} ${lastName}`,
            summary: `Lead qualified for visit at ${location}`,
          },
        });
      }

      // Create calls for calling/followup leads
      if (["CALLING", "FOLLOWUP_D1", "FOLLOWUP_D2", "FOLLOWUP_D3"].includes(status)) {
        await fastify.prisma.call.create({
          data: {
            clientId,
            leadId: lead.id,
            type: status === "CALLING" ? "QUALIFICATION" : `FOLLOWUP_${status === "FOLLOWUP_D1" ? "D1" : status === "FOLLOWUP_D2" ? "D2" : "D3"}` as any,
            direction: "outbound",
            duration: status === "FOLLOWUP_D2" ? null : Math.floor(Math.random() * 120) + 20,
            status: status === "FOLLOWUP_D2" ? "INITIATED" as any : status === "CALLING" ? "ANSWERED" as any : "COMPLETED" as any,
          },
        });
      }

      // Create notification records for booked leads
      if (["BOOKED", "VISITED", "CONVERTED"].includes(status)) {
        await fastify.prisma.customerNotification.create({
          data: {
            leadId: lead.id,
            type: "BOOKING_CONFIRMATION",
            channel: "simulated",
            message: `Namaste ${firstName}! Aapki property visit confirm ho gayi hai for ${location}.`,
            status: "sent",
            sentAt: createdAt,
          },
        });
        await fastify.prisma.ownerNotification.create({
          data: {
            clientId,
            leadId: lead.id,
            type: "BOOKING_CONFIRMED",
            message: `🔔 New Booking: ${firstName} ${lastName} — ${location}`,
            status: "sent",
            sentAt: createdAt,
          },
        });
      }

      created++;
    }

    logger.info({ clientId, created, bookingsCreated }, "🎯 [DEMO] Seed data generated");

    return reply.status(201).send({
      message: `✅ Generated ${created} demo leads with ${bookingsCreated} + bookings`,
      stats: {
        totalLeads: created,
        totalBookings: bookingsCreated,
        note: "Leads have varied statuses to show the full lifecycle. Refresh the dashboard to see them!",
      },
    });
  });

  // ─── POST /demo/trigger-call/:leadId — Simulate AI calling ──
  fastify.post("/demo/trigger-call/:leadId", async (
    request: FastifyRequest<{ Params: { leadId: string } }>, reply: FastifyReply
  ) => {
    const clientId = request.clientId!;
    const leadId = request.params.leadId;

    const lead = await fastify.prisma.lead.findFirst({
      where: { id: leadId, clientId },
    });

    if (!lead) {
      return reply.status(404).send({ error: "Lead not found" });
    }

    if (!["PENDING", "NO_ANSWER", "CALL_FAILED"].includes(lead.status)) {
      return reply.status(400).send({
        error: `Lead status is "${lead.status}" — can only call leads with PENDING, NO_ANSWER, or CALL_FAILED status`,
      });
    }

    const call = await fastify.prisma.call.create({
      data: {
        clientId,
        leadId,
        type: "QUALIFICATION",
        direction: "outbound",
        status: "INITIATED" as any,
        omnidimensionCallId: `demo-call-${Date.now()}`,
      },
    });

    await fastify.prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "CALLING" as LeadStatus,
        callAttempts: lead.callAttempts + 1,
        firstCalledAt: lead.firstCalledAt || new Date(),
      },
    });

    await emitStatusChange(leadId, "CALLING", clientId, { callId: call.id, demoMode: true });

    logger.info({ leadId, callId: call.id }, "📞 [DEMO] Call simulated — lead status updated to CALLING");

    return {
      message: `📞 Demo call initiated for ${lead.name}. The lead is now in CALLING status.`,
      callId: call.id,
      leadId,
      status: "CALLING",
      nextStep: "Use POST /demo/call-result/{leadId} to simulate the call outcome",
    };
  });

  // ─── POST /demo/call-result/:leadId — Simulate call outcome ─
  fastify.post("/demo/call-result/:leadId", async (
    request: FastifyRequest<{
      Params: { leadId: string };
      Body: { outcome?: "QUALIFIED" | "NOT_INTERESTED" | "NO_ANSWER" | "CALL_FAILED" };
    }>, reply: FastifyReply
  ) => {
    const clientId = request.clientId!;
    const leadId = request.params.leadId;
    const outcome = request.body?.outcome || "QUALIFIED";

    const lead = await fastify.prisma.lead.findFirst({
      where: { id: leadId, clientId },
    });

    if (!lead) {
      return reply.status(404).send({ error: "Lead not found" });
    }

    const lastCall = await fastify.prisma.call.findFirst({
      where: { leadId, clientId },
      orderBy: { createdAt: "desc" },
    });

    if (lastCall) {
      await fastify.prisma.call.update({
        where: { id: lastCall.id },
        data: {
          status: outcome === "QUALIFIED" ? "COMPLETED" as any : outcome === "NO_ANSWER" ? "NO_ANSWER" as any : "FAILED" as any,
          duration: outcome === "QUALIFIED" ? Math.floor(Math.random() * 150) + 60 : outcome === "NOT_INTERESTED" ? Math.floor(Math.random() * 40) + 15 : 0,
          transcript: `[DEMO] Simulated call outcome: ${outcome}`,
          summary: outcome === "QUALIFIED"
            ? "Lead interested — budget 1-2Cr, wants 2BHK in Andheri. Booked site visit."
            : outcome === "NOT_INTERESTED"
              ? "Lead not interested at this time."
              : `Call ${outcome === "NO_ANSWER" ? "not answered" : "failed"}`,
        },
      });
    }

    if (outcome === "QUALIFIED") {
      const visitDate = new Date(Date.now() + Math.floor(Math.random() * 5 + 1) * 24 * 3600000);
      const location = lead.location || "Andheri West";

      const booking = await fastify.prisma.booking.create({
        data: {
          clientId,
          visitDate,
          visitTime: `${10 + Math.floor(Math.random() * 7)}:00 ${Math.random() > 0.5 ? "AM" : "PM"}`,
          propertyAddress: `${location}, Mumbai`,
          propertyName: "2BHK Premium Apartment",
          status: "CONFIRMED" as any,
          confirmedAt: new Date(),
          sourceCallId: lastCall?.id,
        },
      });

      await fastify.prisma.lead.update({
        where: { id: leadId },
        data: {
          status: "BOOKED" as LeadStatus,
          bookingId: booking.id,
          bookedAt: new Date(),
          propertyType: "flat",
          bedrooms: "2BHK",
          sentiment: "positive",
        },
      });

      await emitStatusChange(leadId, "BOOKED", clientId, { bookingId: booking.id, demoMode: true });

      logger.info({ leadId, bookingId: booking.id }, "✅ [DEMO] Lead qualified — visit booked!");

      return {
        message: `✅ ${lead.name} is interested! Site visit booked for ${visitDate.toLocaleDateString("en-IN")}.`,
        outcome: "BOOKED",
        booking: {
          id: booking.id,
          visitDate: visitDate.toISOString(),
          visitTime: booking.visitTime,
          address: booking.propertyAddress,
        },
      };
    } else if (outcome === "NOT_INTERESTED") {
      // Direct DB transition to D1 follow-up (no Redis/BullMQ needed)
      await fastify.prisma.lead.update({
        where: { id: leadId },
        data: { status: "FOLLOWUP_D1" as LeadStatus, followupD1At: new Date() },
      });
      await fastify.prisma.call.create({
        data: {
          clientId, leadId,
          type: "FOLLOWUP_D1",
          direction: "outbound",
          status: "COMPLETED" as any,
          duration: Math.floor(Math.random() * 60) + 20,
          transcript: `[DEMO] Follow-up D1 call to ${lead.name} after no-show`,
        },
      });

      return {
        message: `ℹ️ ${lead.name} is not interested right now. D1 follow-up triggered.`,
        outcome: "NOT_INTERESTED",
        followupStarted: true,
      };
    } else if (outcome === "NO_ANSWER") {
      await fastify.prisma.lead.update({
        where: { id: leadId },
        data: { status: "NO_ANSWER" as LeadStatus, callAttempts: (lead.callAttempts || 0) + 1 },
      });

      return {
        message: `📞 ${lead.name} didn't answer. You can retry using POST /demo/trigger-call/${leadId}.`,
        outcome: "NO_ANSWER",
        retryEndpoint: `POST /demo/trigger-call/${leadId}`,
      };
    } else {
      await fastify.prisma.lead.update({
        where: { id: leadId },
        data: { status: "CALL_FAILED" as LeadStatus },
      });

      return {
        message: `❌ Could not reach ${lead.name}. Lead marked as CALL_FAILED.`,
        outcome: "CALL_FAILED",
      };
    }
  });

  // ─── POST /demo/trigger-followup/:leadId — Simulate follow-up ─
  fastify.post("/demo/trigger-followup/:leadId", async (
    request: FastifyRequest<{ Params: { leadId: string }; Body: { day?: 1 | 2 | 3 } }>, reply: FastifyReply
  ) => {
    const clientId = request.clientId!;
    const leadId = request.params.leadId;
    const day = request.body?.day || 1;

    const lead = await fastify.prisma.lead.findFirst({
      where: { id: leadId, clientId },
    });

    if (!lead) {
      return reply.status(404).send({ error: "Lead not found" });
    }

    const followupStatuses: Record<number, LeadStatus> = {
      1: "FOLLOWUP_D1" as LeadStatus,
      2: "FOLLOWUP_D2" as LeadStatus,
      3: "FOLLOWUP_D3" as LeadStatus,
    };

    const newStatus = followupStatuses[day];
    if (!newStatus) {
      return reply.status(400).send({ error: "Invalid follow-up day. Use 1, 2, or 3." });
    }

    await fastify.prisma.lead.update({
      where: { id: leadId },
      data: {
        status: newStatus,
        ...(day === 1 ? { followupD1At: new Date() } : {}),
        ...(day === 2 ? { followupD2At: new Date() } : {}),
        ...(day === 3 ? { followupD3At: new Date() } : {}),
      },
    });

    const callType = day === 1 ? ("FOLLOWUP_D1" as const) : day === 3 ? ("FOLLOWUP_D3" as const) : undefined;

    if (callType) {
      await fastify.prisma.call.create({
        data: {
          clientId,
          leadId,
          type: callType,
          direction: "outbound",
          status: "COMPLETED" as any,
          duration: Math.floor(Math.random() * 90) + 20,
          transcript: `[DEMO] Follow-up D${day} call with ${lead.name}`,
        },
      });

      // Direct DB notification (no Redis needed)
      await fastify.prisma.ownerNotification.create({
        data: {
          clientId, leadId,
          type: `FOLLOWUP_D${day}_SENT`,
          message: `📞 D${day} follow-up: Call completed with ${lead.name}`,
          status: "sent",
          sentAt: new Date(),
        },
      });
    }

    if (day === 2) {
      // Direct DB notification (no Redis needed)
      await fastify.prisma.customerNotification.create({
        data: {
          leadId,
          type: "FOLLOWUP_D2_MESSAGE",
          channel: "simulated",
          message: `Namaste! Kya aap ${lead.location || "apni preferred location"} mein property dekhna chahenge?`,
          status: "sent",
          sentAt: new Date(),
        },
      });
    }

    await emitStatusChange(leadId, newStatus, clientId, { followupDay: day, demoMode: true });

    return {
      message: `📋 Follow-up D${day} triggered for ${lead.name}. Status: ${newStatus}`,
      status: newStatus,
    };
  });

  // ─── POST /demo/simulate-day — Simulate 24 hours of events ──
  fastify.post("/demo/simulate-day", async (request: FastifyRequest) => {
    const clientId = request.clientId!;

    const newLeadsCount = Math.floor(Math.random() * 3) + 3;
    const newLeads: Array<{ id: string; name: string }> = [];

    for (let i = 0; i < newLeadsCount; i++) {
      const firstName = randomPick(DEMO_FIRST_NAMES);
      const lastName = randomPick(DEMO_LAST_NAMES);
      const location = randomPick(DEMO_LOCATIONS_MUMBAI);

      const lead = await fastify.prisma.lead.create({
        data: {
          clientId,
          name: `${firstName} ${lastName}`,
          phone: randomPhone(),
          source: randomPick(DEMO_LEAD_SOURCES),
          rawPayload: {},
          status: "PENDING" as LeadStatus,
          budget: randomPick(DEMO_BUDGETS),
          location,
          timeline: randomPick(DEMO_TIMELINES),
        },
      });
      newLeads.push({ id: lead.id, name: lead.name });
    }

    const pendingLeads = await fastify.prisma.lead.findMany({
      where: { clientId, status: "PENDING" },
      take: 3,
    });

    for (const lead of pendingLeads) {
      await fastify.prisma.lead.update({
        where: { id: lead.id },
        data: { status: "CALLING" as LeadStatus, callAttempts: 1, firstCalledAt: new Date() },
      });

      await fastify.prisma.call.create({
        data: {
          clientId,
          leadId: lead.id,
          type: "QUALIFICATION",
          direction: "outbound",
          status: "INITIATED" as any,
        },
      });
    }

    const callingLeads = await fastify.prisma.lead.findMany({
      where: { clientId, status: "CALLING" },
      take: 2,
    });

    for (const lead of callingLeads) {
      const visitDate = new Date(Date.now() + Math.floor(Math.random() * 5 + 1) * 24 * 3600000);
      const booking = await fastify.prisma.booking.create({
        data: {
          clientId,
          visitDate,
          visitTime: "11:00 AM",
          propertyAddress: `${lead.location || "Andheri West"}, Mumbai`,
          propertyName: "Premium Apartment",
          status: "CONFIRMED" as any,
          confirmedAt: new Date(),
        },
      });

      await fastify.prisma.lead.update({
        where: { id: lead.id },
        data: { status: "BOOKED" as LeadStatus, bookingId: booking.id, bookedAt: new Date() },
      });
    }

    return {
      message: `✅ Simulated 24 hours!`,
      events: {
        newLeadsIngested: newLeadsCount,
        callsInitiated: pendingLeads.length,
        leadsQualified: callingLeads.length,
        totalNewBookings: callingLeads.length,
      },
      newLeads,
    };
  });
}
