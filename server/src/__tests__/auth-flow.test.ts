/**
 * Auth-flow test for FIX Round-2 #3 (email verification).
 *
 * Covers the full verification lifecycle the frontend relies on:
 *   register (requiresVerification) → login BLOCKED (403) → verify-email →
 *   login SUCCEEDS (200 + tokens).
 *
 * Also covers the SMTP-failure edge (emailSent=false) and duplicate-email 409.
 *
 * Uses a Fastify app with the real authRoutes registered and a mocked prisma
 * client + mocked sendEmail — no live DB, no live SMTP.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import Fastify from "fastify";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

vi.mock("@prisma/client", () => {
  const mockPrisma = {
    client: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
});

vi.mock("../services/email.service", () => ({
  sendEmail: vi.fn(),
}));

import authRoutes from "../routes/auth";
import { sendEmail } from "../services/email.service";

const prisma = new PrismaClient() as any;
const mockSendEmail = sendEmail as unknown as ReturnType<typeof vi.fn>;

async function buildApp() {
  const app = Fastify({ logger: false });
  app.decorate("prisma", prisma);
  // The logout route uses fastify.authenticate — provide a minimal decorator.
  app.decorate("authenticate", async (request: any, reply: any) => {
    if (!request.headers?.authorization?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Missing or invalid authorization header" });
    }
  });
  await app.register(authRoutes, { prefix: "/api/v1" });
  await app.ready();
  return app;
}

describe("Email verification flow (FIX Round-2 #3)", () => {
  let app: any;
  let passwordHash = "";

  beforeAll(async () => {
    passwordHash = await bcrypt.hash("Password123", 4);
    app = await buildApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseClient = {
    id: "client-1",
    businessName: "Test Realty",
    ownerName: "Test Owner",
    email: "broker@test.com",
    phone: "+919876543210",
    city: "Mumbai",
    zone: null,
    ownerWhatsapp: "+919876543210",
    passwordHash: "",
    plan: "GROWTH",
    planStatus: "TRIAL",
    callsThisMonth: 0,
    callsLimit: 500,
    leadSources: ["manual"],
    adminId: null,
    emailVerified: false,
    verificationToken: "tok-123",
    verificationTokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  };

  it("register → login blocked (403) → verify → login succeeds (200 + tokens)", async () => {
    mockSendEmail.mockResolvedValue(true);

    // 1. Register: no existing account → creates unverified client
    prisma.client.findUnique.mockResolvedValueOnce(null); // existing check
    prisma.client.create.mockResolvedValue({ ...baseClient, passwordHash });

    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "broker@test.com",
        password: "Password123",
        businessName: "Test Realty",
        ownerName: "Test Owner",
        phone: "+919876543210",
        city: "Mumbai",
      },
    });
    expect(reg.statusCode).toBe(201);
    const regBody = reg.json();
    expect(regBody.requiresVerification).toBe(true);
    expect(regBody.emailSent).toBe(true);
    expect(regBody.accessToken).toBeUndefined(); // no tokens until verified
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    // 2. Login is BLOCKED while unverified
    prisma.client.findUnique.mockResolvedValueOnce({ ...baseClient, passwordHash });
    const loginBlocked = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "broker@test.com", password: "Password123" },
    });
    expect(loginBlocked.statusCode).toBe(403);
    expect(loginBlocked.json().verificationRequired).toBe(true);
    expect(loginBlocked.json().accessToken).toBeUndefined();

    // 3. Verify via emailed token → marks verified + returns tokens
    prisma.client.findFirst.mockResolvedValueOnce({ ...baseClient, passwordHash });
    prisma.client.update.mockResolvedValueOnce({ ...baseClient, passwordHash, emailVerified: true });

    const verify = await app.inject({
      method: "GET",
      url: "/api/v1/auth/verify-email?token=tok-123",
    });
    expect(verify.statusCode).toBe(200);
    const verifyBody = verify.json();
    expect(verifyBody.accessToken).toBeTruthy();
    expect(verifyBody.refreshToken).toBeTruthy();
    expect(prisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ emailVerified: true }) })
    );

    // 4. Login now SUCCEEDS
    prisma.client.findUnique.mockResolvedValueOnce({ ...baseClient, passwordHash, emailVerified: true });
    const loginOk = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "broker@test.com", password: "Password123" },
    });
    expect(loginOk.statusCode).toBe(200);
    expect(loginOk.json().accessToken).toBeTruthy();
    expect(loginOk.json().user?.role).toBe("client");
  });

  it("register returns emailSent=false + warning message when SMTP is down", async () => {
    mockSendEmail.mockResolvedValue(false);
    prisma.client.findUnique.mockResolvedValueOnce(null);
    prisma.client.create.mockResolvedValue({ ...baseClient, passwordHash });

    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "new@test.com",
        password: "Password123",
        businessName: "New Realty",
        ownerName: "New Owner",
        phone: "+919876543211",
        city: "Delhi",
      },
    });
    expect(reg.statusCode).toBe(201);
    const body = reg.json();
    expect(body.requiresVerification).toBe(true);
    expect(body.emailSent).toBe(false);
    expect(body.message).toContain("could not be sent");
  });

  it("register returns 409 for an existing email", async () => {
    prisma.client.findUnique.mockResolvedValueOnce({ id: "existing", email: "dup@test.com" });

    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "dup@test.com",
        password: "Password123",
        businessName: "Dup Realty",
        ownerName: "Dup",
        phone: "+919876543212",
        city: "Mumbai",
      },
    });
    expect(reg.statusCode).toBe(409);
    expect(prisma.client.create).not.toHaveBeenCalled();
  });

  it("resend-verification returns emailSent=false when SMTP is down (frontend warning)", async () => {
    mockSendEmail.mockResolvedValue(false);
    prisma.client.findUnique.mockResolvedValueOnce({ ...baseClient, emailVerified: false });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/resend-verification",
      payload: { email: "broker@test.com" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.emailSent).toBe(false);
    expect(body.message).toContain("If an account exists");
  });

  it("verify-email rejects an invalid/expired token", async () => {
    prisma.client.findFirst.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/verify-email?token=wrong-token",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("Invalid or expired");
  });
});
