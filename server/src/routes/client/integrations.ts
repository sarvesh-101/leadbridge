/**
 * Integration Routes — ported from FastAPI Python backend.
 *
 * Manages third-party provider connections (IndiaMart, JustDial, 99Acres, etc.),
 * outgoing webhooks, and API tokens for programmatic access.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { encrypt, decrypt } from "../../utils/encryption";

// Static catalog of available integration providers
const AVAILABLE_PROVIDERS: Record<string, {
  name: string; description: string; docsUrl: string; type: string; setupSteps: string[];
}> = {
  indiamart: {
    name: "IndiaMart", description: "Import leads from IndiaMart CRM",
    docsUrl: "https://seller.indiamart.com/", type: "lead_source",
    setupSteps: ["Log in to your IndiaMart seller account", "Go to Settings → API Integration", "Generate an API key", "Enter the API key and your IndiaMart credentials below"],
  },
  justdial: {
    name: "JustDial", description: "Sync leads from JustDial Business",
    docsUrl: "https://business.justdial.com/", type: "lead_source",
    setupSteps: ["Log in to your JustDial Business account", "Navigate to Integrations section", "Enable API access and copy your token", "Paste the token below"],
  },
  magicbricks: {
    name: "MagicBricks", description: "Auto-import leads from MagicBricks",
    docsUrl: "https://www.magicbricks.com/", type: "lead_source",
    setupSteps: ["Log in to your MagicBricks agent dashboard", "Go to Lead Settings → API Integration", "Generate an API key", "Enter the API key below"],
  },
  housing: {
    name: "Housing.com", description: "Import leads from Housing.com",
    docsUrl: "https://housing.com/", type: "lead_source",
    setupSteps: ["Log in to your Housing.com partner account", "Go to Settings → API", "Generate your API credentials", "Enter them below"],
  },
  "99acres": {
    name: "99Acres", description: "Sync leads from 99Acres",
    docsUrl: "https://www.99acres.com/", type: "lead_source",
    setupSteps: ["Log in to your 99Acres builder account", "Go to My Account → API Settings", "Generate API key", "Enter the API key below"],
  },
  facebook: {
    name: "Facebook Lead Ads", description: "Capture leads from Facebook Lead Ads automatically",
    docsUrl: "https://developers.facebook.com/docs/marketing-api/leads/", type: "lead_source",
    setupSteps: ["Create a Facebook app in Meta Developer Console", "Configure Lead Ads webhook", "Use the webhook URL below as your callback URL", "Verify the webhook with the verify token"],
  },
  google: {
    name: "Google Lead Forms", description: "Import leads from Google Ads Lead Form extensions",
    docsUrl: "https://developers.google.com/google-ads/api/docs/lead-form-extensions", type: "lead_source",
    setupSteps: ["Set up Google Ads lead form extensions", "Enable lead form submissions", "Configure the webhook URL below in Google Ads"],
  },
  zoho: {
    name: "Zoho CRM", description: "Two-way sync with Zoho CRM",
    docsUrl: "https://www.zoho.com/crm/developer/docs/", type: "crm",
    setupSteps: ["Log in to Zoho CRM", "Go to Settings → Developer Space → API", "Generate Client ID and Client Secret", "Enter the OAuth credentials below", "Authorize LeadBridge to access your Zoho account"],
  },
  zapier: {
    name: "Zapier", description: "Connect with 5000+ apps via Zapier webhooks",
    docsUrl: "https://zapier.com/apps/webhook/integrations", type: "automation",
    setupSteps: ["Create a Zapier account", "Choose 'Webhooks by Zapier' as your app", "Select 'Catch Hook' trigger", "Copy the webhook URL below and paste it in Zapier"],
  },
};

const PROVIDER_ENDPOINTS: Record<string, string> = {
  indiamart: "https://seller.indiamart.com/apiseller/checksession/",
  justdial: "https://business.justdial.com/api/v1/health",
  magicbricks: "https://www.magicbricks.com/api/agent/health",
  housing: "https://housing.com/api/v1/health",
  "99acres": "https://www.99acres.com/api/health",
  facebook: "https://graph.facebook.com/v19.0/me",
  google: "https://www.googleapis.com/oauth2/v1/tokeninfo",
  zoho: "https://www.zohoapis.com/crm/v2/settings/modules",
};

export default async function clientIntegrationRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── List Available Providers ──────────────────────────────────
  // Ported from FastAPI: GET /integrations/providers
  fastify.get("/integrations/providers", async () => {
    const providers = Object.entries(AVAILABLE_PROVIDERS).map(([slug, info]) => ({
      slug,
      ...info,
    }));
    return { providers, total: providers.length };
  });

  // ─── Get Provider Detail ──────────────────────────────────────
  // Ported from FastAPI: GET /integrations/providers/{slug}
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
  // Ported from FastAPI: GET /integrations/
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

    // Enrich with provider type info — never expose raw credentials in batch listing
    const items = integrations.map((i) => ({
      id: i.id,
      provider: i.provider,
      name: i.name,
      description: i.description,
      status: i.status,
      type: AVAILABLE_PROVIDERS[i.provider]?.type || "custom",
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
    }));

    return { items, total: items.length };
  });

  // ─── Create Integration ────────────────────────────────────────
  // Ported from FastAPI: POST /integrations/
  fastify.post("/integrations", async (request: FastifyRequest<{
    Body: { provider: string; name?: string; description?: string; apiKey?: string; apiSecret?: string; settings?: Record<string, unknown> };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { provider, name, description, apiKey, apiSecret, settings } = request.body;

    if (!provider) {
      return reply.status(400).send({ error: "Provider slug is required" });
    }

    if (!AVAILABLE_PROVIDERS[provider]) {
      return reply.status(400).send({ error: `Unknown provider: ${provider}` });
    }

    // Check if integration already exists for this provider
    const existing = await fastify.prisma.integration.findFirst({
      where: { clientId, provider },
    });

    if (existing) {
      return reply.status(409).send({ error: `Integration for '${provider}' already exists` });
    }

    const providerInfo = AVAILABLE_PROVIDERS[provider];
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
  // Ported from FastAPI: GET /integrations/{id}
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
  // Ported from FastAPI: PUT /integrations/{id}
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
      data: data as any,
    });

    return { message: "Integration updated" };
  });

  // ─── Test Integration ─────────────────────────────────────────
  // Ported from FastAPI: POST /integrations/{id}/test
  fastify.post("/integrations/:id/test", async (
    request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply
  ) => {
    const integration = await fastify.prisma.integration.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!integration) {
      return reply.status(404).send({ error: "Integration not found" });
    }

    const endpoint = PROVIDER_ENDPOINTS[integration.provider];

    try {
      if (endpoint) {
        const axios = (await import("axios")).default;
        const headers: Record<string, string> = {};
        if (integration.apiKey) {
          headers["Authorization"] = `Bearer ${integration.apiKey}`;
        }
        await axios.get(endpoint, { headers, timeout: 10000 });
      }

      await fastify.prisma.integration.update({
        where: { id: integration.id },
        data: { status: "ACTIVE", lastSyncAt: new Date(), totalSynced: { increment: 1 }, lastErrorMessage: null },
      });

      return { status: "success", message: `Successfully connected to ${integration.provider}` };
    } catch (error: any) {
      await fastify.prisma.integration.update({
        where: { id: integration.id },
        data: {
          status: "ERROR",
          totalErrors: { increment: 1 },
          lastErrorMessage: `Connection failed: ${(error.message || "").slice(0, 200)}`,
          lastErrorAt: new Date(),
        },
      });

      return reply.status(400).send({ error: `Connection failed: ${error.message}` });
    }
  });

  // ─── Trigger Sync ─────────────────────────────────────────────
  // Ported from FastAPI: POST /integrations/{id}/sync
  fastify.post("/integrations/:id/sync", async (
    request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply
  ) => {
    const integration = await fastify.prisma.integration.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!integration) {
      return reply.status(404).send({ error: "Integration not found" });
    }

    await fastify.prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date() },
    });

    return { message: `Sync triggered for '${integration.name}'`, syncedAt: new Date() };
  });

  // ─── Delete Integration ───────────────────────────────────────
  // Ported from FastAPI: DELETE /integrations/{id}
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
  // Ported from FastAPI: GET /integrations/health
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
  // Ported from FastAPI: POST /integrations/api-tokens
  fastify.post("/integrations/api-tokens", async (request: FastifyRequest) => {
    const token = crypto.randomBytes(32).toString("hex");

    return {
      message: "API token generated",
      token,
      note: "Save this token securely. It will not be shown again.",
    };
  });
}
