import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * T8 — Admin integration-status registry logic.
 *
 * The route handler mixes Prisma queries with pure mapping logic. We extract
 * and test the pure parts (provider labeling, summary reduction, serviceable
 * gate) by driving them through a mocked Prisma client via the real handler,
 * the same pattern used by platform-credit-monitor.test.ts.
 */

// The route module only needs fastify-shaped objects; no real server is built.
type IntegrationRow = {
  id: string;
  provider: string;
  name: string;
  description?: string | null;
  status: "ACTIVE" | "INACTIVE" | "ERROR" | "DISCONNECTED";
  syncFrequency: string;
  lastSyncAt: Date | null;
  nextSyncAt: Date | null;
  totalSynced: number;
  totalErrors: number;
  lastErrorMessage: string | null;
  lastErrorAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ClientRow = {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone?: string;
  plan: string;
  planStatus: string;
  city: string;
  leadSources?: unknown[];
  territory: { city: string; zone: string } | null;
  integrations: IntegrationRow[];
  _count: { leads: number; calls: number; bookings: number };
};

function makeIntegration(overrides: Partial<IntegrationRow> = {}): IntegrationRow {
  return {
    id: "int_1",
    provider: "indiamart",
    name: "IndiaMART",
    description: null,
    status: "ACTIVE",
    syncFrequency: "auto",
    lastSyncAt: new Date("2026-11-01T10:00:00Z"),
    nextSyncAt: null,
    totalSynced: 10,
    totalErrors: 0,
    lastErrorMessage: null,
    lastErrorAt: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-11-01T10:00:00Z"),
    ...overrides,
  };
}

function makeClient(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: "c1",
    businessName: "Test Broker",
    ownerName: "Owner",
    email: "owner@test.com",
    phone: "9999999999",
    plan: "STARTER",
    planStatus: "ACTIVE",
    city: "Mumbai",
    territory: null,
    integrations: [],
    _count: { leads: 1, calls: 2, bookings: 3 },
    ...overrides,
  };
}

// Build the route against an in-memory fastify double; handlers captured for
// direct invocation with mock request/reply objects.
function buildRouteHarness(db: { clients: ClientRow[] }) {
  const handlers: Record<string, (req: any, reply: any) => Promise<unknown>> = {};
  const fastify = {
    addHook: vi.fn(),
    // Every route in this module is a GET; capture handlers by path so the
    // tests can invoke them with mock request/reply objects.
    get: vi.fn((path: string, handler: (req: any, reply: any) => Promise<unknown>) => {
      handlers[path] = handler;
    }),
    log: { info: vi.fn() },
    prisma: {
      client: {
        findMany: async (args: any) => {
          let rows = [...db.clients];
          if (args?.where?.integrations?.some) {
            const wanted = args.where.integrations.some;
            rows = rows.filter((c) =>
              c.integrations.some((i) =>
                wanted.status ? i.status === wanted.status : (wanted.status?.in ?? []).includes(i.status)
              )
            );
          }
          const skip = args?.skip ?? 0;
          const take = args?.take ?? rows.length;
          return rows.slice(skip, skip + take);
        },
        count: async (args: any) => {
          let rows = [...db.clients];
          if (args?.where?.integrations?.some) {
            const wanted = args.where.integrations.some;
            rows = rows.filter((c) =>
              c.integrations.some((i) =>
                wanted.status ? i.status === wanted.status : (wanted.status?.in ?? []).includes(i.status)
              )
            );
          }
          return rows.length;
        },
        findFirst: async (args: any) =>
          db.clients.find((c) => c.id === args?.where?.id) ?? null,
      },
    },
  };
  // Load the module fresh and capture its handlers.
  return import("../routes/admin/integrations").then(async (mod) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (mod.default as any)(fastify as any);
    return { handlers, fastify };
  });
}

function makeReply() {
  return { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
}

beforeEach(() => {
  vi.resetModules();
});

describe("T8 admin integration registry", () => {
  it("lists tenants with derived per-tenant summaries (ACTIVE/ERROR counts, lastSync, totals)", async () => {
    const db = {
      clients: [
        makeClient({
          integrations: [
            makeIntegration({ id: "i1", status: "ACTIVE", totalSynced: 120, totalErrors: 2, lastSyncAt: new Date("2026-11-03T09:00:00Z") }),
            makeIntegration({ id: "i2", provider: "justdial", name: "JustDial", status: "ERROR", totalSynced: 5, totalErrors: 4, lastSyncAt: new Date("2026-11-04T09:00:00Z"), lastErrorMessage: "parse failed" }),
          ],
        }),
        makeClient({ id: "c2", businessName: "Idle Broker", integrations: [] }),
      ],
    };
    const { handlers } = await buildRouteHarness(db);
    const res = await handlers["/admin/integrations"]({ query: {} }, makeReply());

    expect((res as any).total).toBe(2);
    const first = (res as any).items[0];
    expect(first.client.businessName).toBe("Test Broker");
    expect(first.summary.totalIntegrations).toBe(2);
    expect(first.summary.activeCount).toBe(1);
    expect(first.summary.errorCount).toBe(1);
    expect(first.summary.totalSynced).toBe(125);
    expect(first.summary.totalErrors).toBe(6);
    expect(first.summary.lastSyncAt.toISOString()).toBe("2026-11-04T09:00:00.000Z");
    // providerInfo is attached for UI labeling
    expect(first.integrations[0].providerInfo.kind).toBe("api");
    expect(first.integrations[1].providerInfo.kind).toBe("forwarding");
  });

  it("filters tenants by integration status=? (ERROR)", async () => {
    const db = {
      clients: [
        makeClient({ id: "c1", integrations: [makeIntegration({ status: "ERROR" })] }),
        makeClient({ id: "c2", businessName: "Clean", integrations: [makeIntegration({ id: "i9", status: "ACTIVE" })] }),
      ],
    };
    const { handlers } = await buildRouteHarness(db);
    const res = await handlers["/admin/integrations"]({ query: { status: "ERROR" } }, makeReply());
    // Mocked prisma double implements the same filter: only c1 has an ERROR row
    expect((res as any).total).toBe(1);
    expect((res as any).items[0].client.id).toBe("c1");
  });

  it("flags non-serviceable planStatus (PAST_DUE) via serviceable=false", async () => {
    const db = {
      clients: [
        makeClient({
          planStatus: "PAST_DUE",
          integrations: [makeIntegration({ status: "ACTIVE" })],
        }),
      ],
    };
    const { handlers } = await buildRouteHarness(db);
    const res = await handlers["/admin/integrations"]({ query: {} }, makeReply());
    expect((res as any).items[0].client.serviceable).toBe(false);
  });

  it("returns 404 for unknown clientId on the detail endpoint", async () => {
    const { handlers } = await buildRouteHarness({ clients: [] });
    const reply = makeReply();
    await handlers["/admin/integrations/:clientId"]({ params: { clientId: "nope" } }, reply);
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it("detail endpoint: strips secret settings keys, attaches provider info + summary", async () => {
    const db = {
      clients: [
        makeClient({
          integrations: [
            makeIntegration({
              provider: "indiamart",
              settings: { mobile: "9999999999", lastPullTime: "2026-11-03T00:00:00.000Z", secretInternalFlag: true } as never,
            } as Partial<IntegrationRow> & { settings: unknown } as any),
          ],
        }),
      ],
    };
    const { handlers } = await buildRouteHarness(db);
    const res = await handlers["/admin/integrations/:clientId"](
      { params: { clientId: "c1" } },
      makeReply()
    );

    const body = res as any;
    // Credentials are never selected at all — the whole response is checked:
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toContain("apiSecret");
    expect(raw).not.toContain("credentials");
    // Approved (non-secret) settings keys survive the filter
    const integration = body.integrations[0];
    expect(integration.settings.lastPullTime).toBe("2026-11-03T00:00:00.000Z");
    // IndiaMART settings contain the registered mobile — but mobile is a
    // lookup key, not a credential; still, the whitelist must NOT pass it
    // through (registers as PII).
    expect(integration.settings.mobile).toBeUndefined();
    expect(integration.providerInfo.name).toBe("IndiaMART");
    expect(body.summary.activeCount).toBe(1);
    expect(body.client.counts.leads).toBe(1);
  });

  it("portal ingestion guide lists every supported provider with steps", async () => {
    const { handlers } = await buildRouteHarness({ clients: [] });
    const res = await handlers["/admin/portal-ingestion-guide"]({}, makeReply());

    const body = res as any;
    const providers = body.providers.map((p: { provider: string }) => p.provider);
    // Same catalog as the client-facing Integrations page
    expect(providers).toEqual(
      expect.arrayContaining(["indiamart", "facebook", "justdial", "99acres", "magicbricks", "housing", "google"])
    );
    for (const p of body.providers) {
      // Every provider must ship actionable steps (or explicitly inherit from justdial)
      expect(Array.isArray(p.steps) && p.steps.length > 0).toBe(true);
    }
    // Channels + links are present for ops copy-paste
    expect(body.ingestionChannels.length).toBeGreaterThanOrEqual(5);
    expect(body.sourceDoc).toBe("docs/portal-ingestion-setup.md");
  });
});
