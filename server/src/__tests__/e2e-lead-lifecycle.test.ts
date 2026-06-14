/**
 * E2E Test: Lead Lifecycle
 *
 * Tests the lead ingestion → database → status transition flow
 * using the live PostgreSQL database.
 *
 * This test runs against the actual database (not mocked) and verifies:
 * 1. A lead can be created via the Prisma client
 * 2. The lead starts in PENDING status
 * 3. Lead status transitions follow the lifecycle state machine
 * 4. Scoring works on the created lead
 *
 * Run: npx vitest run src/__tests__/e2e-lead-lifecycle.test.ts
 * Requires: DATABASE_URL_PRISMA pointing to a running PostgreSQL
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, LeadStatus } from "@prisma/client";
import { canTransition, validateTransition, isTerminal } from "../utils/lifecycle";
import { scoreLead } from "../services/scoring.service";

// Use a test-specific Prisma client connecting to the live DB
const prisma = new PrismaClient();

// Test identifiers — use a unique prefix to avoid collisions
const TEST_PREFIX = `e2e-test-${Date.now()}`;
const testClientId = `${TEST_PREFIX}-client`;
const testLeadId = `${TEST_PREFIX}-lead-1`;

describe("E2E: Lead Lifecycle", () => {
  beforeAll(async () => {
    // Ensure database is accessible
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup test data in reverse dependency order
    try {
      // 1. Delete calls referencing test leads
      await prisma.call.deleteMany({ where: { leadId: { startsWith: TEST_PREFIX } } });
    } catch { /* no calls */ }
    try {
      // 2. Delete bookings referencing test leads
      await prisma.booking.deleteMany({ where: { clientId: testClientId } });
    } catch { /* no bookings */ }
    try {
      // 3. Delete notifications
      await prisma.customerNotification.deleteMany({ where: { leadId: { startsWith: TEST_PREFIX } } });
    } catch { /* no notifications */ }
    try {
      await prisma.ownerNotification.deleteMany({ where: { clientId: testClientId } });
    } catch { /* no notifications */ }
    try {
      // 4. Delete leads
      await prisma.lead.deleteMany({ where: { id: { startsWith: TEST_PREFIX } } });
    } catch { /* already clean */ }
    try {
      // 5. Delete test client
      await prisma.client.delete({ where: { id: testClientId } });
    } catch { /* already clean */ }
    await prisma.$disconnect();
  });

  it("connects to the database", async () => {
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    expect(result).toBeDefined();
  });

  it("creates a lead with PENDING status", async () => {
    // Create a minimal client for the test lead
    const client = await prisma.client.create({
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
      },
    });
    expect(client.id).toBe(testClientId);

    const lead = await prisma.lead.create({
      data: {
        id: testLeadId,
        clientId: testClientId,
        name: "Rahul Test",
        phone: "+919876543210",
        source: "99acres",
        rawPayload: { test: true, source: "99acres" },
        status: "PENDING",
        receivedAt: new Date(),
      },
    });

    expect(lead.id).toBe(testLeadId);
    expect(lead.status).toBe("PENDING");
    expect(lead.name).toBe("Rahul Test");
    expect(lead.phone).toBe("+919876543210");
    expect(lead.source).toBe("99acres");
  });

  it("can transition PENDING → CALLING", async () => {
    expect(canTransition("PENDING", "CALLING")).toBe(true);

    await prisma.lead.update({
      where: { id: testLeadId },
      data: { status: "CALLING", firstCalledAt: new Date() },
    });

    const lead = await prisma.lead.findUnique({ where: { id: testLeadId } });
    expect(lead?.status).toBe("CALLING");
    expect(lead?.firstCalledAt).toBeInstanceOf(Date);
  });

  it("can transition CALLING → BOOKED", async () => {
    expect(canTransition("CALLING", "BOOKED")).toBe(true);

    await prisma.lead.update({
      where: { id: testLeadId },
      data: { status: "BOOKED", bookedAt: new Date() },
    });

    const lead = await prisma.lead.findUnique({ where: { id: testLeadId } });
    expect(lead?.status).toBe("BOOKED");
  });

  it("can transition BOOKED → REMINDED", async () => {
    expect(canTransition("BOOKED", "REMINDED")).toBe(true);

    await prisma.lead.update({
      where: { id: testLeadId },
      data: { status: "REMINDED" },
    });

    const lead = await prisma.lead.findUnique({ where: { id: testLeadId } });
    expect(lead?.status).toBe("REMINDED");
  });

  it("can transition REMINDED → VISITED", async () => {
    expect(canTransition("REMINDED", "VISITED")).toBe(true);

    await prisma.lead.update({
      where: { id: testLeadId },
      data: { status: "VISITED", visitedAt: new Date() },
    });

    const lead = await prisma.lead.findUnique({ where: { id: testLeadId } });
    expect(lead?.status).toBe("VISITED");
  });

  it("can transition VISITED → CONVERTED", async () => {
    expect(canTransition("VISITED", "CONVERTED")).toBe(true);

    await prisma.lead.update({
      where: { id: testLeadId },
      data: { status: "CONVERTED", convertedAt: new Date() },
    });

    const lead = await prisma.lead.findUnique({ where: { id: testLeadId } });
    expect(lead?.status).toBe("CONVERTED");
    expect(lead?.convertedAt).toBeInstanceOf(Date);
  });

  it("CONVERTED is a terminal state", async () => {
    expect(isTerminal("CONVERTED")).toBe(true);
    expect(isTerminal("PENDING")).toBe(false);
  });

  it("scores the lead correctly", async () => {
    // Update lead with scoring data
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
    expect(factors.sentiment).toBe(10); // Positive sentiment boost
  });

  it("enforces valid state transitions only", async () => {
    // CONVERTED is terminal — no further transitions allowed
    expect(canTransition("CONVERTED", "PENDING")).toBe(false);
    expect(canTransition("CONVERTED", "COLD")).toBe(false);

    // COLD is terminal
    expect(canTransition("COLD", "PENDING")).toBe(false);

    // PENDING → CONVERTED (skip states) not allowed
    expect(canTransition("PENDING", "CONVERTED")).toBe(false);
  });
});
