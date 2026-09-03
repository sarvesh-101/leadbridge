/**
 * Integration Routes — manages third-party lead source connections.
 *
 * Two REAL kinds of lead sources are supported:
 *
 *   1. kind: "api"  — IndiaMART. Official Leads API (Push webhook + Pull
 *      API poller). The broker saves their CRM key + registered mobile; leads
 *      are ingested in real-time and the AI calling pipeline starts.
 *
 *   2. kind: "forwarding" — JustDial, 99acres, MagicBricks, Housing.com.
 *      These portals have no public lead API; leads arrive as SMS/email
 *      notifications that the broker forwards to their Converza inbox
 *      (see /dashboard/forwarding). The "connection" is the forwarding setup,
 *      not an API credential.
 *
 * Providers that previously showed a fake "Connect" button with no ingestion
 * (Facebook, Google, Zoho, Zapier) have been removed from the catalog.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { encrypt, decrypt } from "../../utils/encryption";
import { config } from "../../config";

type ProviderKind = "api" | "forwarding";

// Static catalog of available integration providers
const AVAILABLE_PROVIDERS: Record<string, {
  name: string; description: string; docsUrl: string; type: string; kind: ProviderKind; setupSteps: string[];
}> = {
  indiamart: {
    name: "IndiaMART", description: "Real-time lead import via the official IndiaMART Leads API",
    docsUrl: "https://help.indiamart.com/knowledge-base/im-lms-leads-api/", type: "lead_source", kind: "api",
    setupSteps: [
      "Log in to seller.indiamart.com with your IndiaMART account",
      "Go to Lead Manager → (⋮ menu) → CRM Integration → Generate Key (direct link: seller.indiamart.com/leadmanager/crmapi)",
      "The CRM key is sent to your registered email — paste it below with your registered mobile number",
      "Note: the IndiaMART Leads API is a paid add-on — contact your IndiaMART account manager to enable it if the key page doesn't work",
    ],
  },
  justdial: {
    name: "JustDial", description: "Forward JustDial enquiry SMS/emails — they become AI-called leads",
    docsUrl: "https://www.justdial.com/", type: "lead_source", kind: "forwarding",
    setupSteps: [
      "Open the JustDial enquiry SMS/email when it arrives",
      "Forward it to your Converza forwarding number/email (see Lead Forwarding)",
      "The AI call starts automatically — no API needed",
    ],
  },
  magicbricks: {
    name: "MagicBricks", description: "Forward MagicBricks lead alerts — they become AI-called leads",
    docsUrl: "https://www.magicbricks.com/", type: "lead_source", kind: "forwarding",
    setupSteps: [
      "Open the MagicBricks lead alert SMS/email when it arrives",
      "Forward it to your Converza forwarding number/email (see Lead Forwarding)",
      "The AI call starts automatically — no API needed",
    ],
  },
  housing: {
    name: "Housing.com", description: "Forward Housing.com enquiry notifications — they become AI-called leads",
    docsUrl: "https://housing.com/", type: "lead_source", kind: "forwarding",
    setupSteps: [
      "Open the Housing.com enquiry SMS/email when it arrives",
      "Forward it to your Converza forwarding number/email (see Lead Forwarding)",
      "The AI call starts automatically — no API needed",
    ],
  },
  "99acres": {
    name: "99acres", description: "Forward 99acres enquiry SMS/emails — they become AI-called leads",
    docsUrl: "https://www.99acres.com/", type: "lead_source", kind: "forwarding",
    setupSteps: [
      "Open the 99acres enquiry SMS/email when it arrives",
      "Forward it to your Converza forwarding number/email (see Lead Forwarding)",
      "The AI call starts automatically — no API needed",
    ],
  },
  facebook: {
    name: "Facebook Lead Ads", description: "Real-time lead import from Facebook Lead Ads (official leadgen webhook)",
    docsUrl: "https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/", type: "lead_source", kind: "api",
    setupSteps: [
      "Click Connect on the Facebook card",
      "Authorize your Facebook Page (or paste a long-lived Page Access Token)",
      "The page is subscribed to our leadgen webhook — every lead form submission is AI-called automatically",
      "Note: needs a Meta app with lead access; for production volume, Meta app review may be required",
    ],
  },
};

export default async function clientIntegrationRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── List Available Providers ──────────────────────────────────
  fastify.get("/integrations/providers", async () => {
    const providers = Object.entries(AVAILABLE_PROVIDERS).map(([slug, info]) => ({
      slug,
      ...info,
    }));
    return { providers, total: providers.length };
  });

  // ─── Get Provider Detail ──────────────────────────────────────
  fastify.get("/integrations/providers/:slug", async (
    request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply
  ) => {
    const provider = AVAILABLE_PROVIDERS[request.params.slug];
    if (!provider) {
      return reply.status(404).send({ error: `Provider '${request.params.slug}' not found` });
    }
    return { provider: { slug: request.params.slug, ...provider } };
  });

  // ─── List User Integrations ────────────────────────────────────
  fastify.get("/integrations", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const { status, provider } = request.query as Record<string, string>;

    const where: Record<string, unknown> = { clientId };
    if (status) where.status = status;
    if (provider) where.provider = provider;

    const integrations = await fastify.prisma.integration.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Public base URL for the IndiaMART Push API webhook (the URL the broker
    // pastes into IndiaMART's Push API page).
    const baseUrl = config.WEBHOOK_URL || `${request.protocol}://${request.hostname}`;

    const items = integrations.map((i) => {
      const providerInfo = AVAILABLE_PROVIDERS[i.provider];
      return {
        id: i.id,
        provider: i.provider,
        name: i.name,
        description: i.description,
        status: i.status,
        type: providerInfo?.type || "custom",
        kind: providerInfo?.kind || "forwarding",
        syncFrequency: i.syncFrequency,
        hasCredentials: !!(i.apiKey || i.apiSecret),
        hasSettings: Object.keys(i.settings as Record<string, unknown>).length > 0,
        lastSyncAt: i.lastSyncAt,
        totalSynced: i.totalSynced,
        totalErrors: i.totalErrors,
        lastErrorMessage: i.lastErrorMessage,
        lastErrorAt: i.lastErrorAt,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
        // Webhook URLs for API-kind providers.
        // IndiaMART: per-client path (their URL formation guideline).
        // Facebook: shared path — Meta delivers per subscribed page.
        webhookUrl: i.provider === "indiamart"
          ? `${baseUrl}/api/v1/webhooks/indiamart/${clientId}`
          : i.provider === "facebook"
          ? `${baseUrl}/api/v1/webhooks/facebook`
          : null,
      };
    });

    return { items, total: items.length };
  });

  // ─── Create Integration ────────────────────────────────────────
  fastify.post("/integrations", async (request: FastifyRequest<{
    Body: { provider: string; name?: string; description?: string; apiKey?: string; apiSecret?: string; settings?: Record<string, unknown> };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { provider, name, description, apiKey, apiSecret, settings } = request.body;

    if (!provider) {
      return reply.status(400).send({ error: "Provider slug is required" });
    }

    const providerInfo = AVAILABLE_PROVIDERS[provider];
    if (!providerInfo) {
      return reply.status(400).send({ error: `Unknown provider: ${provider}` });
    }

    // Only API-kind providers take credentials. Forwarding sources are set up
    // via the Lead Forwarding page, not by saving API keys.
    if (providerInfo.kind === "forwarding") {
      return reply.status(400).send({
        error: `${providerInfo.name} uses SMS/email forwarding, not an API key. Go to Lead Forwarding to set it up.`,
      });
    }

    // Check if integration already exists for this provider
    const existing = await fastify.prisma.integration.findFirst({
      where: { clientId, provider },
    });

    if (existing) {
      return reply.status(409).send({ error: `Integration for '${provider}' already exists` });
    }

    const integration = await fastify.prisma.integration.create({
      data: {
        clientId,
        provider,
        name: name || providerInfo.name,
        description: description || providerInfo.description,
        apiKey: apiKey ? encrypt(apiKey) : null,
        apiSecret: apiSecret ? encrypt(apiSecret) : null,
        credentials: {
          ...((settings as Record<string, unknown>) || {}),
          encrypted: true,
        } as Prisma.InputJsonValue,
        settings: (settings ?? {}) as Prisma.InputJsonValue,
        status: "INACTIVE",
      },
    });

    return reply.status(201).send({
      message: `Integration '${integration.name}' created`,
      id: integration.id,
      provider: integration.provider,
      status: integration.status,
    });
  });

  // ─── Get Integration ──────────────────────────────────────────
  fastify.get("/integrations/:id", async (
    request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply
  ) => {
    const integration = await fastify.prisma.integration.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!integration) {
      return reply.status(404).send({ error: "Integration not found" });
    }

    // Decrypt sensitive fields before returning to the client
    return {
      integration: {
        ...integration,
        apiKey: integration.apiKey ? decrypt(integration.apiKey) : null,
        apiSecret: integration.apiSecret ? decrypt(integration.apiSecret) : null,
      },
    };
  });

  // ─── Update Integration ────────────────────────────────────────
  fastify.patch("/integrations/:id", async (
    request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>, reply: FastifyReply
  ) => {
    const integration = await fastify.prisma.integration.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!integration) {
      return reply.status(404).send({ error: "Integration not found" });
    }

    const updatable = ["name", "description", "apiKey", "apiSecret", "settings", "syncFrequency", "status"];
    const data = Object.fromEntries(
      updatable.filter((k) => k in request.body).map((k) => [k, request.body[k]])
    );

    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ error: "No valid fields to update" });
    }

    // Encrypt any credential fields in the update
    if (data.apiKey) data.apiKey = encrypt(data.apiKey as string);
    if (data.apiSecret) data.apiSecret = encrypt(data.apiSecret as string);

    await fastify.prisma.integration.update({
      where: { id: integration.id },
      data: data as Record<string, unknown>,
    });

    return { message: "Integration updated" };
  });

  // ─── Test Integration ─────────────────────────────────────────
  // IndiaMART: real connectivity test against the Pull API.
  // Forwarding sources: no API to test — point the broker at Lead Forwarding.
  fastify.post("/integrations/:id/test", async (
    request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply
  ) => {
    const integration = await fastify.prisma.integration.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!integration) {
      return reply.status(404).send({ error: "Integration not found" });
    }

    const providerInfo = AVAILABLE_PROVIDERS[integration.provider];

    if (providerInfo?.kind === "forwarding") {
      return reply.status(400).send({
        error: `${providerInfo.name} doesn't use an API connection — it works by forwarding enquiry SMS/emails to your Converza inbox. Open Lead Forwarding to set it up.`,
      });
    }

    // Facebook: verify the saved page token against the Graph API.
    if (integration.provider === "facebook") {
      if (!integration.apiKey) {
        return reply.status(400).send({ error: "Connect your Facebook page first" });
      }
      const { getPageFromToken, subscribePageToLeadgen } = await import("../../services/facebook-leads.service");
      try {
        const page = await getPageFromToken(decrypt(integration.apiKey));
        await subscribePageToLeadgen(page.id, decrypt(integration.apiKey));
        await fastify.prisma.integration.update({
          where: { id: integration.id },
          data: { status: "ACTIVE", lastErrorMessage: null },
        });
        return { status: "success", message: `Connected to Facebook page "${page.name}" — webhook active` };
      } catch (err: any) {
        await fastify.prisma.integration.update({
          where: { id: integration.id },
          data: {
            status: "ERROR",
            totalErrors: { increment: 1 },
            lastErrorMessage: (err.message || "Connection failed").slice(0, 300),
            lastErrorAt: new Date(),
          },
        });
        return reply.status(400).send({ error: `Facebook connection failed: ${err.message}` });
      }
    }

    if (integration.provider !== "indiamart") {
      return reply.status(400).send({ error: "This integration doesn't support connection testing" });
    }

    const settings = (integration.settings as Record<string, unknown>) || {};
    const mobile = typeof settings.mobile === "string" ? settings.mobile : "";
    if (!integration.apiKey || !mobile) {
      return reply.status(400).send({ error: "Save your IndiaMART CRM key and registered mobile number first" });
    }

    const { testIndiaMartConnection } = await import("../../services/indiamart.service");
    const result = await testIndiaMartConnection(decrypt(integration.apiKey), mobile);

    if (!result.ok) {
      await fastify.prisma.integration.update({
        where: { id: integration.id },
        data: {
          status: "ERROR",
          totalErrors: { increment: 1 },
          lastErrorMessage: (result.error || "Connection failed").slice(0, 300),
          lastErrorAt: new Date(),
        },
      });
      return reply.status(400).send({ error: `IndiaMART connection failed: ${result.error}` });
    }

    await fastify.prisma.integration.update({
      where: { id: integration.id },
      data: { status: "ACTIVE", lastErrorMessage: null },
    });

    return { status: "success", message: `Connected to IndiaMART — credentials verified`, leadsInWindow: result.leads };
  });

  // ─── Trigger Sync ─────────────────────────────────────────────
  // IndiaMART: pulls new leads from the Pull API right now.
  // Forwarding sources: nothing to poll — leads arrive by forwarding.
  fastify.post("/integrations/:id/sync", async (
    request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply
  ) => {
    const integration = await fastify.prisma.integration.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!integration) {
      return reply.status(404).send({ error: "Integration not found" });
    }

    const providerInfo = AVAILABLE_PROVIDERS[integration.provider];

    if (providerInfo?.kind === "forwarding") {
      return reply.status(400).send({
        error: `${providerInfo.name} doesn't need syncing — leads arrive instantly when you forward an enquiry SMS/email. Open Lead Forwarding.`,
      });
    }

    if (integration.provider === "facebook") {
      // Facebook delivers in real-time via the leadgen webhook (Meta retries
      // failed deliveries itself) — there is no pull API to poll.
      return reply.status(200).send({
        message: "Facebook delivers leads in real-time via the webhook — no manual sync needed. Use Test to verify the connection.",
      });
    }

    if (integration.provider !== "indiamart") {
      return reply.status(400).send({ error: "This integration doesn't support manual sync" });
    }

    const settings = (integration.settings as Record<string, unknown>) || {};
    const mobile = typeof settings.mobile === "string" ? settings.mobile : "";
    if (!integration.apiKey || !mobile) {
      return reply.status(400).send({ error: "Save your IndiaMART CRM key and registered mobile number first" });
    }

    try {
      const { syncIndiaMartClient } = await import("../../cron/indiamart-pull.cron");
      const result = await syncIndiaMartClient(fastify.prisma, integration);
      return {
        message: `IndiaMART sync complete — ${result.created} new lead${result.created === 1 ? "" : "s"} imported, ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"}`,
        syncedAt: new Date(),
        created: result.created,
        skipped: result.skipped,
      };
    } catch (err: any) {
      await fastify.prisma.integration.update({
        where: { id: integration.id },
        data: {
          status: "ERROR",
          totalErrors: { increment: 1 },
          lastErrorMessage: (err.message || "Sync failed").slice(0, 300),
          lastErrorAt: new Date(),
        },
      });
      return reply.status(400).send({ error: `IndiaMART sync failed: ${err.message}` });
    }
  });

  // ─── Delete Integration ───────────────────────────────────────
  fastify.delete("/integrations/:id", async (
    request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply
  ) => {
    const integration = await fastify.prisma.integration.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!integration) {
      return reply.status(404).send({ error: "Integration not found" });
    }

    await fastify.prisma.integration.delete({ where: { id: integration.id } });
    return { message: `Integration '${integration.name}' deleted` };
  });

  // ─── Integration Health Summary ───────────────────────────────
  fastify.get("/integrations/health", async (request: FastifyRequest) => {
    const clientId = request.clientId!;

    const integrations = await fastify.prisma.integration.findMany({
      where: { clientId },
    });

    const active = integrations.filter((i) => i.status === "ACTIVE").length;
    const error = integrations.filter((i) => i.status === "ERROR").length;
    const totalSynced = integrations.reduce((s, i) => s + i.totalSynced, 0);
    const totalErrors = integrations.reduce((s, i) => s + i.totalErrors, 0);

    return {
      totalIntegrations: integrations.length,
      active,
      error,
      inactive: integrations.length - active - error,
      totalSynced,
      totalErrors,
      overallStatus: error === 0 ? "healthy" : error < active ? "degraded" : "unhealthy",
    };
  });

  // ─── Generate API Token ────────────────────────────────────────
  fastify.post("/integrations/api-tokens", async (request: FastifyRequest) => {
    const token = crypto.randomBytes(32).toString("hex");

    return {
      message: "API token generated",
      token,
      note: "Save this token securely. It will not be shown again.",
    };
  });
}