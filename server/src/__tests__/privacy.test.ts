/**
 * DPDP Phase 1.3 — privacy endpoints (consent + data erasure).
 *
 * Covers the Settings → Privacy & Data flow the frontend relies on:
 *   GET /me/privacy        → consent + erasure state
 *   POST /me/privacy/consent → re-affirm consent
 *   POST /me/privacy/erasure-request → first request records it + notifies admins,
 *                                      repeat is idempotent, processed → 400
 *
 * Uses a Fastify app with the real clientSettingsRoutes registered and a mocked
 * prisma client — no live DB.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";

vi.mock("@prisma/client", () => {
  const mockPrisma = {
    client: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    ownerNotification: {
      create: vi.fn(),
    },
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
});

import clientSettingsRoutes from "../routes/client/settings";

const prisma = new PrismaClient() as any;

async function buildApp() {
  const app = Fastify({ logger: false });
  app.decorate("prisma", prisma);
  // The settings routes require fastify.authenticate — provide a minimal
  // decorator that sets request.clientId like the real JWT auth does.
  app.decorate("authenticate", async (request: any) => {
    request.clientId = "client-1";
  });
  await app.register(clientSettingsRoutes, { prefix: "/api/v1" });
  await app.ready();
  return app;
}

describe("DPDP privacy endpoints (Phase 1.3)", () => {
  let app: any;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const basePrivacy = {
    consentGivenAt: new Date("2026-08-10T10:00:00Z"),
    consentVersion: "1.0",
    dataErasureRequestedAt: null,
    dataErasureProcessedAt: null,
  };

  it("GET /me/privacy returns consent + erasure state", async () => {
    prisma.client.findUnique.mockResolvedValueOnce(basePrivacy);

    const res = await app.inject({ method: "GET", url: "/api/v1/me/privacy" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.consentActive).toBe(true);
    expect(body.consentVersion).toBe("1.0");
    expect(body.erasureRequested).toBe(false);
    expect(body.slaDays).toBe(30);
  });

  it("POST /me/privacy/consent re-affirms consent", async () => {
    prisma.client.update.mockResolvedValueOnce({ ...basePrivacy, consentGivenAt: new Date() });

    const res = await app.inject({ method: "POST", url: "/api/v1/me/privacy/consent" });
    expect(res.statusCode).toBe(200);
    expect(res.json().consentVersion).toBe("1.0");
    expect(prisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ consentVersion: "1.0" }) })
    );
  });

  it("erasure-request records the request + notifies admins on first call", async () => {
    prisma.client.findUnique.mockResolvedValueOnce({
      businessName: "Test Realty",
      email: "broker@test.com",
      dataErasureRequestedAt: null,
      dataErasureProcessedAt: null,
    });
    prisma.client.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.ownerNotification.create.mockResolvedValueOnce({});
    // re-read for the idempotent response
    prisma.client.findUnique.mockResolvedValueOnce({
      dataErasureRequestedAt: new Date(),
      dataErasureProcessedAt: null,
    });

    const res = await app.inject({ method: "POST", url: "/api/v1/me/privacy/erasure-request" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.erasureRequested).toBe(true);
    expect(body.erasureRequestedAt).toBeTruthy();
    expect(body.slaDays).toBe(30);
    expect(prisma.client.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dataErasureRequestedAt: null, dataErasureProcessedAt: null }),
        data: expect.objectContaining({ dataErasureRequestedAt: expect.any(Date) }),
      })
    );
    expect(prisma.ownerNotification.create).toHaveBeenCalledTimes(1);
    expect(prisma.ownerNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "DATA_ERASURE_REQUEST" }) })
    );
  });

  it("erasure-request is idempotent — no duplicate notification", async () => {
    // First read: already requested, not processed
    prisma.client.findUnique.mockResolvedValueOnce({
      businessName: "Test Realty",
      email: "broker@test.com",
      dataErasureRequestedAt: new Date("2026-08-10T11:00:00Z"),
      dataErasureProcessedAt: null,
    });
    // updateMany loses the race (count 0)
    prisma.client.updateMany.mockResolvedValueOnce({ count: 0 });
    // re-read confirms the existing request
    prisma.client.findUnique.mockResolvedValueOnce({
      dataErasureRequestedAt: new Date("2026-08-10T11:00:00Z"),
      dataErasureProcessedAt: null,
    });

    const res = await app.inject({ method: "POST", url: "/api/v1/me/privacy/erasure-request" });
    expect(res.statusCode).toBe(200);
    expect(res.json().erasureRequested).toBe(true);
    // Dates are JSON-serialized to ISO strings over the wire
    expect(res.json().erasureRequestedAt).toBe(new Date("2026-08-10T11:00:00Z").toISOString());
    // No notification on the losing/second request
    expect(prisma.ownerNotification.create).not.toHaveBeenCalled();
  });

  it("erasure-request returns 400 when erasure was already processed", async () => {
    prisma.client.findUnique.mockResolvedValueOnce({
      businessName: "Test Realty",
      email: "broker@test.com",
      dataErasureRequestedAt: new Date("2026-08-10T11:00:00Z"),
      dataErasureProcessedAt: new Date("2026-08-20T11:00:00Z"),
    });

    const res = await app.inject({ method: "POST", url: "/api/v1/me/privacy/erasure-request" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("already been processed");
  });
});
