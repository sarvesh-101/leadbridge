/**
 * Forwarded-email routing — end-to-end through the ingestion pipeline.
 *
 * The real-world case: Gmail/portal auto-forward rules keep the PORTAL's `From`
 * header, so the only reliable routing key is the per-broker recipient address
 * (`<mailbox>+<token>@<domain>`) that survives in To / Delivered-To /
 * X-Forwarded-To. These tests drive `processForwardedEmail` with the payload
 * shapes the IMAP poller and webhook providers actually produce.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// No Redis, no sockets, no LLM: this test is about which broker gets the lead.
vi.mock("../workers/queues", () => ({ enqueueCall: async () => {} }));
vi.mock("../services/websocket.service", () => ({ emitNewLead: async () => {} }));
vi.mock("../services/lead-assignment.service", () => ({ assignLead: async () => {} }));
vi.mock("../services/property-matching.service", () => ({ matchLeadToProperties: async () => {} }));
vi.mock("../services/deepseek.service", () => ({ extractLeadFromForwardedText: async () => null }));
vi.mock("../utils/distributed-lock", () => ({
  tryAcquireLock: async () => true,
  releaseLock: async () => {},
}));
// Parsing is covered by its own tests — pin it so routing is the only variable.
vi.mock("../utils/sms-lead-parser", () => ({
  parseSmsLead: () => ({ name: "Amit Singh", phone: "+919876543210", source: "justdial" }),
}));

const { processForwardedEmail } = await import("../services/email-ingestion.service");

// The address prefix comes from the polled mailbox, so pin it to the mailbox a
// production IMAP poller would read — `forward+<token>@converza.tech`.
const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  process.env.IMAP_USER = "forward@converza.tech";
  delete process.env.FORWARDING_DOMAIN;
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

interface Broker {
  id: string;
  businessName: string;
  plan: string;
  planStatus: string;
  callsThisMonth: number;
  callsLimit: number;
  leadsThisMonth: number;
  email: string;
  inboundToken: string | null;
}

function broker(overrides: Partial<Broker> & Pick<Broker, "id" | "email">): Broker {
  return {
    businessName: `Broker ${overrides.id}`,
    plan: "GROWTH",
    planStatus: "ACTIVE",
    callsThisMonth: 0,
    callsLimit: 600,
    leadsThisMonth: 0,
    inboundToken: null,
    ...overrides,
  };
}

/** Minimal Prisma stand-in: only the queries the pipeline makes. */
function harness(brokers: Broker[]) {
  const created: Array<Record<string, unknown>> = [];

  const prisma = {
    client: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.inboundToken !== undefined) {
          return brokers.find((b) => b.inboundToken === where.inboundToken) ?? null;
        }
        const email = where.email as string | { equals: string } | undefined;
        if (email) {
          const wanted = (typeof email === "string" ? email : email.equals).toLowerCase();
          return brokers.find((b) => b.email.toLowerCase() === wanted) ?? null;
        }
        return null;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const found = brokers.find((b) => b.id === where.id);
        return found ? { leadsThisMonth: found.leadsThisMonth } : null;
      },
      updateMany: async () => ({ count: 1 }),
    },
    lead: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const lead = { id: `lead-${created.length + 1}`, ...data };
        created.push(lead);
        return lead;
      },
    },
    ownerNotification: { create: async () => ({}) },
  };

  const fastify = { prisma, redis: null, requestId: "test-request" } as never;
  return { fastify, created };
}

const ALPHA = broker({ id: "client-alpha", email: "alpha@example.com", inboundToken: "alpha12345" });
const BETA = broker({ id: "client-beta", email: "beta@example.com", inboundToken: "beta123456" });

const PORTAL_FROM = "no-reply@magicbricks.com";
const ENQUIRY = "MagicBricks Enquiry - Amit Singh, +91-9876543210, 2BHK in Andheri West";

describe("forwarded email routing", () => {
  it("routes an auto-forwarded portal email by Delivered-To, not by sender", async () => {
    const { fastify, created } = harness([ALPHA, BETA]);

    const result = await processForwardedEmail(fastify, {
      from: PORTAL_FROM,
      subject: "New enquiry",
      text: ENQUIRY,
      // Gmail keeps the portal's To header; our address lands in Delivered-To.
      recipients: ["", "", "Delivered-To: forward+alpha12345@converza.tech\nX-Forwarded-To: forward+alpha12345@converza.tech"],
    });

    expect(result.status).toBe("created");
    expect(created).toHaveLength(1);
    expect(created[0].clientId).toBe(ALPHA.id);
    expect((created[0].rawPayload as Record<string, unknown>).matchedBy).toBe("recipient");
  });

  it("sends the same portal blast to different brokers by their own token", async () => {
    const { fastify, created } = harness([ALPHA, BETA]);

    await processForwardedEmail(fastify, {
      from: PORTAL_FROM,
      subject: "New enquiry",
      text: ENQUIRY,
      recipients: ["Converza <forward+beta123456@converza.tech>"],
    });

    expect(created).toHaveLength(1);
    expect(created[0].clientId).toBe(BETA.id);
  });

  it("reads SendGrid's object envelope for the recipient address", async () => {
    const { fastify, created } = harness([ALPHA, BETA]);

    const result = await processForwardedEmail(fastify, {
      from: PORTAL_FROM,
      subject: "New enquiry",
      text: ENQUIRY,
      recipients: [{ to: ["forward+alpha12345@converza.tech"], from: PORTAL_FROM }],
    });

    expect(result.status).toBe("created");
    expect(created[0].clientId).toBe(ALPHA.id);
  });

  it("still routes a manual forward by the broker's sender address", async () => {
    const { fastify, created } = harness([ALPHA, BETA]);

    const result = await processForwardedEmail(fastify, {
      from: "Beta@Example.com",
      subject: "Fwd: New enquiry",
      text: ENQUIRY,
      recipients: ["forward@converza.tech"],
    });

    expect(result.status).toBe("created");
    expect(created[0].clientId).toBe(BETA.id);
    expect((created[0].rawPayload as Record<string, unknown>).matchedBy).toBe("sender");
  });

  it("ignores a portal email that matches no broker", async () => {
    const { fastify, created } = harness([ALPHA, BETA]);

    const result = await processForwardedEmail(fastify, {
      from: PORTAL_FROM,
      subject: "New enquiry",
      text: ENQUIRY,
      recipients: ["forward@converza.tech"],
    });

    expect(result).toEqual({ status: "ignored", reason: "no_broker" });
    expect(created).toHaveLength(0);
  });

  it("does not route to an unknown token even if the sender matches a broker", async () => {
    const { fastify, created } = harness([ALPHA, BETA]);

    const result = await processForwardedEmail(fastify, {
      from: BETA.email,
      subject: "New enquiry",
      text: ENQUIRY,
      recipients: ["Delivered-To: forward+zzzz999999@converza.tech"],
    });

    // Token was present but matched no broker → sender fallback applies.
    expect(result.status).toBe("created");
    expect(created[0].clientId).toBe(BETA.id);
  });
});
