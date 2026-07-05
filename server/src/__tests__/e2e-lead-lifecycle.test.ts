/**
 * E2E Test: Lead Lifecycle
 *
 * Tests the lead ingestion → database → status transition flow
 * using the live PostgreSQL database.
 *
 * These tests automatically skip if no PostgreSQL database is reachable,
 * making them safe to run in CI without a service container.
 *
 * Run: npx vitest run src/__tests__/e2e-lead-lifecycle.test.ts
 * Requires: DATABASE_URL_PRISMA pointing to a running PostgreSQL
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { canTransition, validateTransition, isTerminal, isCallable, isInFollowup } from "../utils/lifecycle";
import { scoreLead } from "../services/scoring.service";

// Use a test-specific Prisma client connecting to the live DB
const prisma = new PrismaClient();

// Test identifiers — use a unique prefix to avoid collisions
const TEST_PREFIX = `e2e-test-${Date.now()}`;
const testClientId = `${TEST_PREFIX}-client`;
const testLeadId = `${TEST_PREFIX}-lead-1`;
const testBookingId = `${TEST_PREFIX}-booking-1`;
const testCallId = `${TEST_PREFIX}-call-1`;

// Synchronous check — evaluated at module load time, before describe() runs.
// E2E tests only run when RUN_E2E_TESTS=true is explicitly set.
const runE2E = process.env.RUN_E2E_TESTS === "true";
const describeDb = runE2E ? describe : describe.skip;

describeDb("E2E: Full Lead Lifecycle", () => {
  beforeAll(async () => {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    // Cleanup test data in reverse dependency order
    // Cleanup test data — individual catches so one failure doesn't block others
    try { await prisma.call.deleteMany({ where: { leadId: { startsWith: TEST_PREFIX } } }); } catch { /* noop */ }
    try { await prisma.booking.deleteMany({ where: { clientId: testClientId } }); } catch { /* noop */ }
    try { await prisma.customerNotification.deleteMany({ where: { leadId: { startsWith: TEST_PREFIX } } }); } catch { /* noop */ }
    try { await prisma.ownerNotification.deleteMany({ where: { clientId: testClientId } }); } catch { /* noop */ }
    try { await prisma.lead.deleteMany({ where: { id: { startsWith: TEST_PREFIX } } }); } catch { /* noop */ }
    try { await prisma.client.deleteMany({ where: { id: { startsWith: TEST_PREFIX } } }); } catch { /* noop */ }
    try { await prisma.webhookSource.deleteMany({ where: { clientId: testClientId } }); } catch { /* noop */ }
    await prisma.$disconnect();
  });

  // ─── PART 1: Lead Arrives ─────────────────────────────────────
  it("creates a lead with PENDING status like a portal webhook would", async () => {
    // Create client (simulates admin onboarding)
    await prisma.client.create({
      data: {
        id: testClientId,
        businessName: "E2E Test Broker",
        ownerName: "Test Owner",
        email: `${TEST_PREFIX}@test.com`,
        phone: "+919999999999",
        city: "Mumbai",
        ownerWhatsapp: "+919999999998",
        passwordHash: "$2a$12$test",
        plan: "GROWTH",
        planStatus: "ACTIVE",
        callsLimit: 300,
      },
    });

    // Simulate lead ingestion (POST /webhooks/ingest/:token)
    const lead = await prisma.lead.create({
      data: {
        id: testLeadId,
        clientId: testClientId,
        name: "Rahul Test",
        phone: "+919876543210",
        source: "99acres",
        rawPayload: { name: "Rahul Test", phone: "9876543210", source: "99acres" },
        status: "PENDING",
        receivedAt: new Date(),
      },
    });

    expect(lead.id).toBe(testLeadId);
    expect(lead.status).toBe("PENDING");
    expect(lead.name).toBe("Rahul Test");
    expect(lead.source).toBe("99acres");
  });

  // ─── PART 2: Call Worker Dispatches ───────────────────────────
  it("simulates call worker: PENDING → CALLING + creates Call record", async () => {
    expect(isCallable("PENDING")).toBe(true);

    // Update lead status
    await prisma.lead.update({
      where: { id: testLeadId },
      data: { status: "CALLING", firstCalledAt: new Date() },
    });

    // Create call record (simulates call.worker.ts dispatch)
    await prisma.call.create({
      data: {
        id: testCallId,
        clientId: testClientId,
        leadId: testLeadId,
        type: "QUALIFICATION",
        direction: "outbound",
        status: "INITIATED",
        omnidimensionCallId: `omni-${testCallId}`, // Returned from dispatch_call API
      },
    });

    // Verify
    const lead = await prisma.lead.findUnique({ where: { id: testLeadId } });
    expect(lead?.status).toBe("CALLING");
    expect(lead?.firstCalledAt).toBeInstanceOf(Date);

    const call = await prisma.call.findUnique({ where: { id: testCallId } });
    expect(call?.omnidimensionCallId).toBe(`omni-${testCallId}`);
  });

  // ─── PART 3: Webhook Received (Qualification → Booked) ───────
  it("simulates Omnidimension webhook: LEAD BOOKED with booking + notification records", async () => {
    // Update call as completed with extracted data
    await prisma.call.update({
      where: { id: testCallId },
      data: {
        status: "COMPLETED",
        duration: 145,
        summary: "Lead interested in 2BHK in Andheri West, budget 1-2Cr, agreed to visit Sunday 11AM",
        transcript: "AI: Namaste! Main LeadBridge AI assistant hoon... Customer: Haan, main 2BHK dhundh raha hoon...",
      },
    });

    // Increment client usage (simulates webhook handler)
    await prisma.client.update({
      where: { id: testClientId },
      data: { callsThisMonth: { increment: 1 } },
    });

    // Create booking (simulates handleQualificationOutcome)
    const booking = await prisma.booking.create({
      data: {
        id: testBookingId,
        clientId: testClientId,
        visitDate: new Date("2026-06-21"),
        visitTime: "11:00 AM",
        propertyAddress: "Andheri West, Mumbai",
        status: "CONFIRMED",
        sourceCallId: testCallId,
      },
    });
    expect(booking.status).toBe("CONFIRMED");

    // Update lead with booking
    await prisma.lead.update({
      where: { id: testLeadId },
      data: {
        status: "BOOKED",
        bookingId: booking.id,
        bookedAt: new Date(),
        budget: "1Cr-2Cr",
        location: "Andheri West",
        timeline: "immediate",
        propertyType: "flat",
        bedrooms: "2BHK",
        sentiment: "positive",
      },
    });

    // Simulate WhatsApp notification creation
    await prisma.customerNotification.create({
      data: {
        leadId: testLeadId,
        type: "BOOKING_CONFIRMATION",
        channel: "whatsapp",
        message: "Namaste Rahul Test! Aapki property visit confirm ho gayi hai...",
        status: "sent",
      },
    });

    await prisma.ownerNotification.create({
      data: {
        clientId: testClientId,
        bookingId: booking.id,
        type: "BOOKING_CONFIRMED",
        message: "🔔 New Booking Alert - Rahul Test...",
        status: "sent",
      },
    });

    // Verify
    const lead = await prisma.lead.findUnique({
      where: { id: testLeadId },
      include: { booking: true, customerNotifications: true },
    });
    expect(lead?.status).toBe("BOOKED");
    expect(lead?.booking?.status).toBe("CONFIRMED");
    expect(lead?.customerNotifications.length).toBeGreaterThan(0);
    expect(lead?.budget).toBe("1Cr-2Cr");
    expect(lead?.location).toBe("Andheri West");
  });

  // ─── PART 4: Reminder Sent → Booking Day → No-Show → Follow-up ─
  it("simulates booking day: BOOKED → REMINDED → NO_SHOW → starts follow-up", async () => {
    // Booking day reminder
    expect(canTransition("BOOKED", "REMINDED")).toBe(true);
    await prisma.lead.update({
      where: { id: testLeadId },
      data: { status: "REMINDED" },
    });
    await prisma.booking.update({
      where: { id: testBookingId },
      data: { status: "REMINDED", reminderSentAt: new Date() },
    });

    let lead = await prisma.lead.findUnique({ where: { id: testLeadId } });
    expect(lead?.status).toBe("REMINDED");

    // Lead didn't show — no-show detected by cron
    expect(canTransition("REMINDED", "NO_SHOW")).toBe(true);
    await prisma.lead.update({
      where: { id: testLeadId },
      data: { status: "NO_SHOW" },
    });
    await prisma.booking.update({
      where: { id: testBookingId },
      data: { status: "NO_SHOW", noShowAt: new Date() },
    });

    // Verify lead is in follow-up state
    lead = await prisma.lead.findUnique({ where: { id: testLeadId } });
    expect(lead?.status).toBe("NO_SHOW");
    expect(isInFollowup("NO_SHOW")).toBe(true);

    // D1 follow-up call sent
    expect(canTransition("NO_SHOW", "FOLLOWUP_D1")).toBe(true);
    await prisma.lead.update({
      where: { id: testLeadId },
      data: { status: "FOLLOWUP_D1", followupD1At: new Date() },
    });

    lead = await prisma.lead.findUnique({ where: { id: testLeadId } });
    expect(lead?.status).toBe("FOLLOWUP_D1");
    expect(lead?.followupD1At).toBeInstanceOf(Date);
  });

  // ─── PART 5: Follow-up D3 → Cold ──────────────────────────────
  it("simulates follow-up sequence ending in COLD", async () => {
    // D2 WhatsApp sent
    expect(canTransition("FOLLOWUP_D1", "FOLLOWUP_D2")).toBe(true);
    await prisma.lead.update({
      where: { id: testLeadId },
      data: { status: "FOLLOWUP_D2", followupD2At: new Date() },
    });

    // Simulate D2 WhatsApp message
    await prisma.customerNotification.create({
      data: {
        leadId: testLeadId,
        type: "FOLLOWUP_D2_MESSAGE",
        channel: "whatsapp",
        message: "Namaste, hum samajhte hain aap kal nahi aa paaye. Kya aap interested hain?",
        status: "sent",
      },
    });

    // D3 final call sent
    expect(canTransition("FOLLOWUP_D2", "FOLLOWUP_D3")).toBe(true);
    await prisma.lead.update({
      where: { id: testLeadId },
      data: { status: "FOLLOWUP_D3", followupD3At: new Date() },
    });

    let lead = await prisma.lead.findUnique({ where: { id: testLeadId } });
    expect(lead?.status).toBe("FOLLOWUP_D3");

    // No response — mark COLD
    expect(canTransition("FOLLOWUP_D3", "COLD")).toBe(true);
    await prisma.lead.update({
      where: { id: testLeadId },
      data: { status: "COLD", coldAt: new Date() },
    });

    await prisma.ownerNotification.create({
      data: {
        clientId: testClientId,
        type: "COLD_LEAD",
        message: "❄️ Rahul Test did not respond after 3 follow-ups...",
        status: "sent",
      },
    });

    lead = await prisma.lead.findUnique({ where: { id: testLeadId } });
    expect(lead?.status).toBe("COLD");
    expect(lead?.coldAt).toBeInstanceOf(Date);
    expect(isTerminal("COLD")).toBe(true);
  });

  // ─── PART 6: Re-booking from Follow-up ────────────────────────
  it("simulates rebooking from follow-up D1 back to REBOOKED", async () => {
    // Reset lead to NO_SHOW for rebooking test
    const rebookLeadId = `${TEST_PREFIX}-lead-rebook`;
    const rebookBookingId = `${TEST_PREFIX}-booking-rebook`;

    await prisma.lead.create({
      data: {
        id: rebookLeadId,
        clientId: testClientId,
        name: "Priya Rebook",
        phone: "+919876543211",
        source: "magicbricks",
        rawPayload: {},
        status: "NO_SHOW",
        receivedAt: new Date(),
      },
    });

    // D1 call → rebooked!
    expect(canTransition("NO_SHOW", "FOLLOWUP_D1")).toBe(true);
    await prisma.lead.update({
      where: { id: rebookLeadId },
      data: { status: "FOLLOWUP_D1", followupD1At: new Date() },
    });

    // Customer agreed to rebook
    const newBooking = await prisma.booking.create({
      data: {
        id: rebookBookingId,
        clientId: testClientId,
        visitDate: new Date("2026-06-28"),
        visitTime: "3:00 PM",
        propertyAddress: "Andheri West, Mumbai",
        status: "CONFIRMED",
      },
    });

    // Lead rebooked
    expect(canTransition("FOLLOWUP_D1", "BOOKED")).toBe(true);
    await prisma.lead.update({
      where: { id: rebookLeadId },
      data: { status: "REBOOKED", bookingId: newBooking.id, bookedAt: new Date() },
    });

    const lead = await prisma.lead.findUnique({ where: { id: rebookLeadId } });
    expect(lead?.status).toBe("REBOOKED");
    expect(lead?.bookingId).toBe(rebookBookingId);

    // Cleanup rebook test data
    await prisma.booking.delete({ where: { id: rebookBookingId } });
    await prisma.lead.delete({ where: { id: rebookLeadId } });
  });

  // ─── PART 7: Lead Score Calculation ───────────────────────────
  it("calculates lead score correctly for a high-intent lead", async () => {
    await prisma.lead.update({
      where: { id: testLeadId },
      data: {
        budget: "1Cr-2Cr",
        propertyType: "flat",
        timeline: "immediate",
        sentiment: "positive",
      },
    });

    const { score, factors } = await scoreLead(testLeadId);
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
    expect(factors.sentiment).toBe(10);
  });

  // ─── PART 8: State Machine Enforcement ────────────────────────
  it("enforces valid state transitions only", async () => {
    expect(canTransition("CONVERTED", "PENDING")).toBe(false);
    expect(canTransition("CONVERTED", "COLD")).toBe(false);
    expect(canTransition("COLD", "PENDING")).toBe(false);
    expect(canTransition("PENDING", "CONVERTED")).toBe(false);
    expect(canTransition("PENDING", "COLD")).toBe(true);
    expect(canTransition("COLD", "CONVERTED")).toBe(false);

    // validateTransition should throw for invalid
    expect(() => validateTransition("COLD", "PENDING")).toThrow();
    expect(() => validateTransition("CONVERTED", "PENDING")).toThrow();

    // validateTransition should return the status for valid
    const result = validateTransition("PENDING", "CALLING");
    expect(result).toBe("CALLING");
  });
});
