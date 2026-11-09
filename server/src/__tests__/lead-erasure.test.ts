import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { adminLeadErasureRoutes } from "../routes/admin/lead-erasure";
import type { FastifyInstance } from "fastify";

function makeLead(overrides?: object) {
  return Object.assign(
    {
      id: "lead-1",
      clientId: "client-1",
      phone: "+919876543210",
      source: "99acres",
      receivedAt: new Date().toISOString(),
      createdBy: "owner-1",
      createdAt: new Date().toISOString(),
      status: "NEW",
      consentBasis: "UNKNOWN",
      consentReference: null,
      firstCallAt: null,
      firstCallAttemptAt: null,
      answeredAt: null,
      lastAttemptAt: null,
      lastAttemptResult: null,
      nextAttemptAt: null,
      turnId: null,
      callCounts: {
        attempted: 0,
        answered: 0,
        noAnswer: 0,
        busy: 0,
        failed: 0,
        DND: 0,
        callbackRequested: 0,
      },
      answeredSeconds: 0,
      sequenceCounts: { callRetries: 0, day1: 0, day2: 0, day3: 0, day4: 0, day5: 0, day6: 0, day7: 0, whatsapp: 0 },
      coldAt: null,
      fairUseCapReachedAt: null,
      notes: null,
      customScript: null,
      customInstructions: null,
      language: null,
    },
    overrides
  );
}

describe("admin lead erasure (T14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildContext(prismaOverrides?: Record<string, any>) {
    const fastify = Fastify({ logger: false }) as unknown as FastifyInstance & { prisma: any };

    const prisma: any = {
      lead: { findUnique: vi.fn().mockResolvedValue(null), delete: vi.fn().mockResolvedValue({ id: "lead-1" }) },
      client: { findUnique: vi.fn().mockResolvedValue({ id: "client-1", adminId: "admin-1" }) },
      admin: { findUnique: vi.fn().mockResolvedValue({ id: "admin-1" }) },
      document: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      call: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      customerNotification: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      ownerNotification: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      leadScoreHistory: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      paymentLink: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    };
    if (prismaOverrides) {
      for (const [key, value] of Object.entries(prismaOverrides)) {
        prisma[key] = value;
      }
    }

    // The auth plugin decorates fastify with authenticateAdmin only after
    // fastify.register(authPlugin).  In the test we create the raw fastify
    // instance ourselves, so decorate the property manually before the route
    // module uses it in its addHook call.
    const authenticateAdmin = vi.fn((_request: any, _reply: any) => {});
    (fastify as any).authenticateAdmin = authenticateAdmin;
    fastify.prisma = prisma as any;

    const registeredHandlers: unknown[] = [];
    vi.spyOn(fastify, "addHook").mockImplementation((_hook: string, _handler?: unknown) => fastify);
    vi.spyOn(fastify, "post").mockImplementation((_path: unknown, handler: unknown) => {
      registeredHandlers.push(handler);
      return fastify;
    });

    adminLeadErasureRoutes(fastify);

    return { fastify, prisma, registeredHandlers };
  }

  function makeReply() {
    // Minimal reply stub that satisfies the code paths the route actually
    // exercises.  Real Fastify Reply objects carry a lot of internal state;
    // we provide just enough surface to avoid triggering hidden-side-effect
    // paths (serializer resolution, log, telemetry, http statuses) while
    // keeping the call path fast and deterministic.
    let statusVal = 200;

    const reply: any = {
      status(code: number) {
        statusVal = code;
        return reply;
      },
      code(statusCode: number) {
        statusVal = statusCode;
        return reply;
      },
      send(body?: unknown) {
        (reply as any).__sent = true;
        (reply as any).__sentBody = body;
        return reply;
      },
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), trace: vi.fn() },
      getSerializationFunction: vi.fn().mockReturnValue((x: unknown) => x),
      serializer: { dataResponse: { 200: (x: unknown) => x } } as any,
    };

    Object.defineProperty(reply, "_reply", { get() { return { status: statusVal }; } });
    Object.defineProperty(reply, "_sent", { get() { return !!(reply as any).__sent; } });
    Object.defineProperty(reply, "_sentBody", { get() { return (reply as any).__sentBody; } });

    return reply;
  }

  it("rejects a missing lead with 404", async () => {
    const { prisma, registeredHandlers } = buildContext();
    const routeHandler = registeredHandlers[0] as (request: any, reply: any) => Promise<unknown>;
    expect(routeHandler).toBeDefined();

    const reply = makeReply();
    await routeHandler({ params: { leadId: "missing" }, adminId: "admin-1" } as any, reply);

    expect(prisma.lead.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.lead.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "missing" } })
    );
    expect(reply._reply.status).toBe(404);
    expect((reply as any).__sent).toBe(true);
    expect((reply as any).__sentBody).toEqual({ error: "Lead not found" });
  });

  it("does not erase a lead without admin identity", async () => {
    const { prisma, registeredHandlers } = buildContext();
    const routeHandler = registeredHandlers[0] as (request: any, reply: any) => Promise<unknown>;
    expect(routeHandler).toBeDefined();

    const reply = makeReply();
    await routeHandler({ params: { leadId: "lead-1" } } as any, reply);

    expect(prisma.lead.findUnique).toHaveBeenCalledTimes(0);
    expect(reply._reply.status).toBe(400);
    expect((reply as any).__sent).toBe(true);
    expect((reply as any).__sentBody).toEqual({ error: "Admin identity missing" });
  });

  it("assumes a lead under a client owned by the requesting admin is eligible", async () => {
    const { prisma, registeredHandlers } = buildContext({
      lead: {
        findUnique: vi.fn().mockResolvedValue(makeLead({ clientId: "client-1" })),
        delete: vi.fn().mockResolvedValue({ id: "lead-1" }),
      },
      client: { findUnique: vi.fn().mockResolvedValue({ id: "client-1", adminId: "admin-1" }) },
      admin: { findUnique: vi.fn().mockResolvedValue({ id: "admin-1" }) },
    });

    const routeHandler = registeredHandlers[0] as (request: any, reply: any) => Promise<unknown>;
    expect(routeHandler).toBeDefined();

    const reply = makeReply();
    await routeHandler({ params: { leadId: "lead-1" }, adminId: "admin-1" } as any, reply);

    expect(prisma.lead.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.lead.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead-1" },
        select: { id: true, clientId: true, source: true, receivedAt: true },
      })
    );
    expect(prisma.client.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.client.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "client-1" } })
    );
    expect(prisma.admin.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.admin.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "admin-1" } })
    );
    expect(reply._sent).toBe(true);
    expect(reply._sentBody).toEqual({ deleted: { recordings: 0, documents: 0, notifications: 0, scores: 0, paymentLinks: 0 }, auditEntryId: null });
    expect(reply._reply.status).toBe(200);
  });

  it("does not erase a lead whose client is not owned by the admin", async () => {
    const { prisma, registeredHandlers } = buildContext({
      lead: { findUnique: vi.fn().mockResolvedValue(makeLead({ clientId: "other-client" })) },
      client: { findUnique: vi.fn().mockResolvedValue({ id: "other-client", adminId: "other-owner" }) },
    });
    const routeHandler = registeredHandlers[0] as (request: any, reply: any) => Promise<unknown>;
    expect(routeHandler).toBeDefined();

    const reply = makeReply();
    await routeHandler({ params: { leadId: "lead-1" }, adminId: "admin-1" } as any, reply);

    expect(prisma.lead.findUnique).toHaveBeenCalledTimes(1);
    expect((reply as any).__sent).toBe(true);
    expect((reply as any).__sentBody).toEqual({ error: "Admin does not own this lead" });
    expect(reply._reply.status).toBe(403);
  });

  it("does not let a deleted admin erase a lead", async () => {
    const { prisma, registeredHandlers } = buildContext({
      lead: { findUnique: vi.fn().mockResolvedValue(makeLead()) },
      admin: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    const routeHandler = registeredHandlers[0] as (request: any, reply: any) => Promise<unknown>;
    expect(routeHandler).toBeDefined();

    const reply = makeReply();
    await routeHandler({ params: { leadId: "lead-1" }, adminId: "admin-1" } as any, reply);

    expect(prisma.lead.findUnique).toHaveBeenCalledTimes(1);
    expect(reply._reply.status).toBe(403);
    expect((reply as any).__sent).toBe(true);
    expect((reply as any).__sentBody).toEqual({ error: "Admin account not found" });
  });

  it("deletes recordings, documents and the lead, and writes an audit entry", async () => {
    const { prisma, registeredHandlers } = buildContext({
      lead: {
        findUnique: vi.fn().mockResolvedValue(makeLead()),
        delete: vi.fn().mockResolvedValue({ id: "lead-1" }),
      },
      document: {
        findMany: vi.fn().mockResolvedValue([
          { id: "doc-1", type: "lead_document", url: "s3://doc.pdf", mimeType: "application/pdf" },
        ]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      call: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      customerNotification: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      ownerNotification: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      leadScoreHistory: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      paymentLink: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    });
    const routeHandler = registeredHandlers[0] as (request: any, reply: any) => Promise<unknown>;
    expect(routeHandler).toBeDefined();

    const reply = makeReply();
    await routeHandler({ params: { leadId: "lead-1" }, adminId: "admin-1" } as any, reply);

    // The lead query is a thin fetch for the gates + audit metadata, not the
    // full record.  Assert only the shape the route actually selects.
    expect(prisma.lead.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.lead.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead-1" },
        select: { id: true, clientId: true, source: true, receivedAt: true },
      })
    );

    // Side-effects: clear recordings, delete attachments, clear related rows,
    // remove the lead, and write a compliance audit entry.
    expect(prisma.call.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.customerNotification.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.customerNotification.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leadId: "lead-1" } })
    );
    expect(prisma.ownerNotification.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.ownerNotification.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leadId: "lead-1" } })
    );
    expect(prisma.leadScoreHistory.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.leadScoreHistory.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leadId: "lead-1" } })
    );
    expect(prisma.paymentLink.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.paymentLink.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leadId: "lead-1" } })
    );
    expect(prisma.lead.delete).toHaveBeenCalledTimes(1);
    expect(prisma.lead.delete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead-1" } }));

    // Audit record must include resourceType/resourceId and carry no personal data
    // beyond the client identifier the audit policy allows.
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adminId: "admin-1",
          action: "LEAD_ERASED",
          resourceType: "Lead",
          resourceId: "lead-1",
        }),
      })
    );
    const auditEntry = (prisma.auditLog.create.mock.calls[0] as any)[0].data;
    expect(auditEntry).not.toHaveProperty("phone");
    expect(auditEntry).toHaveProperty("metadata");
    expect(auditEntry.metadata).toHaveProperty("clientId", "client-1");
    expect(auditEntry.metadata).toHaveProperty("source");
    expect(auditEntry.metadata).toHaveProperty("receivedAt");

    expect((reply as any).__sent).toBe(true);
    expect((reply as any).__sentBody).toEqual({
      deleted: { recordings: 1, documents: 1, notifications: 3, scores: 1, paymentLinks: 0 },
      auditEntryId: null,
    });
    expect(reply._reply.status).toBe(200);
  });

  it("uses lightly-documented route body snippets", () => {
    // Explicit displayName / attachRequest / attachValidation are left at their
    // Fastify defaults for this route.  When the route module is eventually
    // documented, these defaults translate to:
    //
    //   summary: "Erase a lead and all linked recordings/documents/notifications"
    //   operationId: "adminLeadErasure"
    //   tags: ["admin"]
    //
    // and the handler is documented as having the body:
    //
    //   No request body is accepted; everything is driven by path params and
    //   the admin identity already established by authenticateAdmin.
    //
    // These notes are intentionally minimal so the route stays focused on the
    // compliance behavior and does not accumulate boilerplate docs for its
    // current narrow contract.  If the contract expands later, the docs here
    // can be filled in with the real route body (path params, expected
    // responses, and the exact shape of the successful delete summary).
    const { registeredHandlers } = buildContext();
    expect(registeredHandlers.length).toBe(1);
    expect(typeof registeredHandlers[0]).toBe("function");
  });
});
