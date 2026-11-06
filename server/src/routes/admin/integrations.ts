import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/**
 * Admin Integration Status Registry — V2 T8.
 *
 * Single admin view of every tenant's lead-source integrations, backed by the
 * `Integration` model (status: ACTIVE / INACTIVE / ERROR / DISCONNECTED).
 *
 * Endpoints:
 *   GET /admin/integrations                — paginated tenant × integration table
 *   GET /admin/integrations/:clientId     — one tenant's integration detail + summary
 *   GET /admin/portal-ingestion-guide     — ops-facing setup checklist (JSON copy of
 *                                           docs/portal-ingestion-setup.md)
 *
 * Auth: authenticateAdmin on every route (same guard as every other /admin/*).
 * Credentials (apiKey/apiSecret/credentials JSON) are NEVER returned — only
 * status, sync metrics and error metadata. The admin registry is read-only.
 */
export default async function adminIntegrationRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticateAdmin);

  // ─── Provider labels (mirrors the client-side catalog) ──────────
  // Kept as a small local map so the admin registry doesn't import the client
  // routes module (it registers its own Fastify instance as a side effect).
  type ProviderKind = "api" | "forwarding" | "sync";
  const PROVIDER_INFO: Record<string, { name: string; kind: ProviderKind; setupPage: string }> = {
    indiamart: { name: "IndiaMART", kind: "api", setupPage: "/dashboard/integrations" },
    facebook: { name: "Facebook Lead Ads", kind: "api", setupPage: "/dashboard/integrations" },
    justdial: { name: "JustDial", kind: "forwarding", setupPage: "/dashboard/forwarding" },
    "99acres": { name: "99acres", kind: "forwarding", setupPage: "/dashboard/forwarding" },
    magicbricks: { name: "MagicBricks", kind: "forwarding", setupPage: "/dashboard/forwarding" },
    housing: { name: "Housing.com", kind: "forwarding", setupPage: "/dashboard/forwarding" },
    google: { name: "Google Sheets", kind: "sync", setupPage: "/dashboard/sheets-sync" },
  };

  function providerInfo(provider: string) {
    return (
      PROVIDER_INFO[provider] ?? { name: provider, kind: "api" as ProviderKind, setupPage: "/dashboard/integrations" }
    );
  }

  // ─── Serviceable plan statuses (same set ingestion gates on) ────
  // Mirrors routes/webhooks/ingest.ts: only TRIAL and ACTIVE may ingest. A
  // tenant whose plan is PAST_DUE/CANCELLED can't ingest — surface that so an
  // admin reading the registry doesn't chase a config problem that is actually
  // a billing problem.
  const SERVICEABLE_STATUSES = ["TRIAL", "ACTIVE"] as const;

  // ─── GET /admin/integrations — paginated tenant × integration table ──
  fastify.get("/admin/integrations", async (request: FastifyRequest) => {
    const {
      page = "1",
      limit = "50",
      search,
      status, // integration status filter: ACTIVE | ERROR | INACTIVE | DISCONNECTED
      health, // "issues" → tenants with ≥1 ERROR/DISCONNECTED integration
    } = request.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 50));

    // Build the Client where-clause from the requested statuses so pagination
    // stays correct (we filter inside Prisma, not after mapping).
    const clientWhere: Record<string, unknown> = {};
    if (search) {
      clientWhere.OR = [
        { businessName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { ownerName: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status || health === "issues") {
      clientWhere.integrations = {
        // In tenant integrations an ERROR/DISCONNECTED row is the actionable
        // state; INACTIVE just means "not switched on yet".
        some: status
          ? { status: status as "ACTIVE" | "INACTIVE" | "ERROR" | "DISCONNECTED" }
          : { status: { in: ["ERROR", "DISCONNECTED"] } },
      };
    }

    const [clients, total] = await Promise.all([
      fastify.prisma.client.findMany({
        where: clientWhere,
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          businessName: true,
          ownerName: true,
          email: true,
          plan: true,
          planStatus: true,
          city: true,
          territory: { select: { city: true, zone: true } },
          integrations: {
            orderBy: [{ status: "asc" }, { provider: "asc" }],
            select: {
              id: true,
              provider: true,
              name: true,
              description: true,
              status: true,
              syncFrequency: true,
              lastSyncAt: true,
              nextSyncAt: true,
              totalSynced: true,
              totalErrors: true,
              lastErrorMessage: true,
              lastErrorAt: true,
              createdAt: true,
            },
          },
        },
      }),
      fastify.prisma.client.count({ where: clientWhere }),
    ]);

    const items = clients.map((c) => {
      const integrations = c.integrations.map((i) => ({ ...i, providerInfo: providerInfo(i.provider) }));
      const activeCount = integrations.filter((i) => i.status === "ACTIVE").length;
      const errorCount = integrations.filter((i) => i.status === "ERROR" || i.status === "DISCONNECTED").length;
      return {
        client: {
          id: c.id,
          businessName: c.businessName,
          ownerName: c.ownerName,
          email: c.email,
          plan: c.plan,
          planStatus: c.planStatus,
          city: c.city,
          territory: c.territory,
          // Mirrors the ingestion gate: a non-serviceable plan explains
          // "why no leads" without opening the billing page.
          serviceable: (SERVICEABLE_STATUSES as readonly string[]).includes(c.planStatus),
        },
        integrations,
        summary: {
          totalIntegrations: integrations.length,
          activeCount,
          errorCount,
          notConfigured: integrations.length - activeCount - errorCount,
          totalSynced: integrations.reduce((s, i) => s + (i.totalSynced || 0), 0),
          totalErrors: integrations.reduce((s, i) => s + (i.totalErrors || 0), 0),
          lastSyncAt: integrations.reduce<Date | null>(
            (latest, i) => (i.lastSyncAt && (!latest || i.lastSyncAt > latest) ? i.lastSyncAt : latest),
            null
          ),
        },
      };
    });

    return {
      items,
      total,
      page: pageNum,
      limit: pageSize,
      pages: Math.ceil(total / pageSize),
    };
  });

  // ─── GET /admin/integrations/:clientId — one tenant's detail ─────
  fastify.get("/admin/integrations/:clientId", async (
    request: FastifyRequest<{ Params: { clientId: string } }>,
    reply: FastifyReply
  ) => {
    const { clientId } = request.params;

    const client = await fastify.prisma.client.findFirst({
      where: { id: clientId },
      select: {
        id: true,
        businessName: true,
        ownerName: true,
        email: true,
        phone: true,
        plan: true,
        planStatus: true,
        city: true,
        leadSources: true,
        territory: { select: { city: true, zone: true } },
        integrations: {
          orderBy: [{ status: "asc" }, { provider: "asc" }],
          select: {
            id: true,
            provider: true,
            name: true,
            description: true,
            status: true,
            settings: true,
            syncFrequency: true,
            lastSyncAt: true,
            nextSyncAt: true,
            totalSynced: true,
            totalErrors: true,
            lastErrorMessage: true,
            lastErrorAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        _count: { select: { leads: true, calls: true, bookings: true } },
      },
    });

    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }

    // Settings can carry per-provider progress (e.g. IndiaMART lastPullTime).
    // Only an explicit whitelist of non-secret keys is exposed below — raw
    // credentials (apiKey/apiSecret/credentials) are never selected at all.
    return {
      client: {
        id: client.id,
        businessName: client.businessName,
        ownerName: client.ownerName,
        email: client.email,
        phone: client.phone,
        plan: client.plan,
        planStatus: client.planStatus,
        city: client.city,
        territory: client.territory,
        leadSources: client.leadSources || [],
        serviceable: (SERVICEABLE_STATUSES as readonly string[]).includes(client.planStatus),
        counts: {
          leads: client._count.leads,
          calls: client._count.calls,
          bookings: client._count.bookings,
        },
      },
      integrations: client.integrations.map((i) => ({
        id: i.id,
        provider: i.provider,
        providerInfo: providerInfo(i.provider),
        name: i.name,
        description: i.description,
        status: i.status,
        // syncFrequency + lastPullTime-style progress live in settings; only
        // approved, non-secret settings are exposed here:
        settings: typeof i.settings === "object" && i.settings !== null
          ? Object.fromEntries(
              Object.entries(i.settings as Record<string, unknown>).filter(([k]) =>
                ["syncFrequency", "lastPullTime", "lastQueryIds", "pushApiConfigured"].includes(k)
              )
            )
          : {},
        syncFrequency: i.syncFrequency,
        lastSyncAt: i.lastSyncAt,
        nextSyncAt: i.nextSyncAt,
        totalSynced: i.totalSynced,
        totalErrors: i.totalErrors,
        lastErrorMessage: i.lastErrorMessage,
        lastErrorAt: i.lastErrorAt,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      })),
      summary: {
        totalIntegrations: client.integrations.length,
        activeCount: client.integrations.filter((i) => i.status === "ACTIVE").length,
        errorCount: client.integrations.filter((i) => i.status === "ERROR" || i.status === "DISCONNECTED").length,
        totalSynced: client.integrations.reduce((s, i) => s + (i.totalSynced || 0), 0),
        totalErrors: client.integrations.reduce((s, i) => s + (i.totalErrors || 0), 0),
      },
    };
  });

  // ─── GET /admin/portal-ingestion-guide — ops setup checklist ────
  // Read-only JSON mirror of docs/portal-ingestion-setup.md. Keeps the admin
  // panel free to render a checklist without depending on a markdown renderer,
  // and gives ops a single place to copy setup steps for a new tenant.
  fastify.get("/admin/portal-ingestion-guide", async () => {
    return {
      title: "Portal Lead Ingestion — Setup Guide",
      purpose:
        "Make the core promise true — a broker with JustDial, IndiaMART, 99acres, MagicBricks, Housing.com accounts gets every enquiry AI-called automatically. Code is done; this covers the dashboard/account actions needed to turn it on.",
      providers: [
        {
          provider: "indiamart",
          label: "IndiaMART",
          method: "Official IndiaMART Leads API — real-time Push webhook + 5-min Pull poller fallback",
          builtStatus: "complete",
          steps: [
            "Broker: log in to seller.indiamart.com, Lead Manager → (⋮ menu) → CRM Integration → Generate Key",
            "The CRM key is emailed to their registered email",
            "Dashboard → Integrations → IndiaMART → Connect: enter the registered mobile number + paste the CRM key → Save & Verify",
            "Enable real-time Push API from IndiaMART's own side (Lead Manager → Import/Export Leads → Push API → platform 'Converza' + webhook URL from the Integrations page)",
          ],
          caveats: [
            "IndiaMART Leads API is a PAID add-on — if key generation fails, the broker's account manager must enable it.",
            "Pull API pulls every 5 min as a backfill; Push API (real-time) is the primary path.",
          ],
          docs: "https://help.indiamart.com/knowledge-base/im-lms-leads-api/",
        },
        {
          provider: "facebook",
          label: "Facebook Lead Ads",
          method: "Official Meta leadgen webhook + Graph API lead fetch",
          builtStatus: "complete",
          steps: [
            "Create a Meta app (type Business) at developers.facebook.com",
            "Add the Facebook Login product and configure the Page webhook (callback URL + verify token)",
            "Subscribe the webhook to the leadgen field",
            "Set FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_VERIFY_TOKEN env vars",
            "Broker connects from the Integrations page (OAuth or paste a long-lived Page Access Token)",
          ],
          caveats: [
            "For production lead volume, Meta may require app review with leads_retrieval permission.",
          ],
          docs: "https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/",
        },
        {
          provider: "justdial",
          label: "JustDial",
          method: "SMS/email forwarding — broker forwards enquiry SMS/email, we parse + AI-call",
          builtStatus: "complete",
          steps: [
            "Buy an SMS-enabled number (MessageBird recommended for India, or Twilio)",
            "Point the provider's incoming-SMS webhook at /webhooks/sms/incoming-messagebird (MessageBird) or /webhooks/sms/incoming (Twilio)",
            "Forward the portal enquiry SMS from the broker's phone to the Converza number",
          ],
          caveats: ["Without a configured forwarding provider this whole path fails closed (403)."],
          docs: "https://www.justdial.com/",
        },
        {
          provider: "99acres",
          label: "99acres",
          method: "Same SMS/email forwarding engine as JustDial",
          builtStatus: "complete",
          steps: ["Reuse the same forwarding number/email as JustDial.", "Forward the enquiry SMS/email from 99acres to the same Converza inbox/number."],
        },
        {
          provider: "magicbricks",
          label: "MagicBricks",
          method: "Same SMS/email forwarding engine as JustDial",
          builtStatus: "complete",
          steps: ["Reuse the same forwarding number/email as JustDial.", "Forward the enquiry SMS/email from MagicBricks to the same Converza inbox/number."],
        },
        {
          provider: "housing",
          label: "Housing.com",
          method: "Same SMS/email forwarding engine as JustDial",
          builtStatus: "complete",
          steps: ["Reuse the same forwarding number/email as JustDial.", "Forward the enquiry SMS/email from Housing.com to the same Converza inbox/number."],
        },
        {
          provider: "google",
          label: "Google Sheets",
          method: "Bidirectional sync via service-account (sheets-sync-v2.service.ts)",
          builtStatus: "complete",
          steps: [
            "Create a Google Cloud project → enable Google Sheets API",
            "Create a service account → download the JSON key",
            "Dashboard → Sheets Sync → paste the client email + private key",
            "Share the Google Sheet with the service-account email (Editor)",
          ],
          docs: "https://developers.google.com/sheets/api/quickstart/nodejs",
        },
      ],
      ingestionChannels: [
        {
          channel: "IndiaMART (API)",
          needsSetup: "Per-broker CRM key + registered mobile (Integrations page → Save & Verify)",
        },
        {
          channel: "SMS forwarding (JustDial / 99acres / MagicBricks / Housing)",
          needsSetup: "MessageBird number (preferred) or Twilio number + webhook config",
        },
        {
          channel: "Email forwarding (backup channel for all portals)",
          needsSetup:
            "IMAP mailbox creds (IMAP_HOST/IMAP_PORT/IMAP_USER/IMAP_PASS) OR an inbound-email service POSTing to /webhooks/email/incoming",
        },
        {
          channel: "Zapier / website forms",
          needsSetup: "Custom webhook source (Settings → create source → copy token)",
        },
        {
          channel: "WhatsApp incoming",
          needsSetup: "No setup — works today",
        },
      ],
      note: "Credentials are read-only here. Per-broker setup actions live in the broker dashboard (Integrations / Forwarding / Sheets Sync). Admin's job is to see which tenant is stuck and nudge them.",
      sourceDoc: "docs/portal-ingestion-setup.md",
    };
  });
}
