/**
 * Facebook Lead Ads — broker-facing integration routes.
 *
 * Two ways to connect:
 *   1. Manual: broker pastes a long-lived Page Access Token (simplest — works
 *      even before the Meta app review is complete).
 *   2. OAuth: broker clicks "Connect with Facebook", authorizes in Meta's
 *      dialog, and we exchange the code → user token → page list → subscribe.
 *
 * Either path verifies the token against the Graph API, subscribes the page to
 * our `leadgen` webhook, and stores the encrypted page token on the Integration.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { config } from "../../config";
import { encrypt } from "../../utils/encryption";
import { logger } from "../../utils/logger";
import {
  getPageFromToken,
  subscribePageToLeadgen,
} from "../../services/facebook-leads.service";

export default async function facebookIntegrationRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  const OAUTH_REDIRECT_URI = () =>
    `${config.FRONTEND_URL || "http://localhost:3001"}/dashboard/integrations?fb_oauth=1`;

  // ─── Manual connect: Page Access Token ───────────────────────
  fastify.post("/integrations/facebook/connect", async (
    request: FastifyRequest<{ Body: { pageAccessToken: string } }>, reply: FastifyReply
  ) => {
    const clientId = request.clientId!;
    const token = request.body?.pageAccessToken?.trim();

    if (!token) {
      return reply.status(400).send({ error: "Page Access Token is required" });
    }

    try {
      const page = await getPageFromToken(token);
      await subscribePageToLeadgen(page.id, token);

      const existing = await fastify.prisma.integration.findFirst({
        where: { clientId, provider: "facebook" },
      });

      const data = {
        clientId,
        provider: "facebook",
        name: `Facebook — ${page.name}`,
        description: "Facebook Lead Ads (real-time leadgen webhook)",
        apiKey: encrypt(token),
        settings: { pageId: page.id, pageName: page.name, connectedVia: "manual" },
        status: "ACTIVE" as const,
        lastErrorMessage: null,
      };

      const integration = existing
        ? await fastify.prisma.integration.update({ where: { id: existing.id }, data })
        : await fastify.prisma.integration.create({ data });

      return reply.status(200).send({
        message: `Connected to Facebook page "${page.name}" — new leads will be AI-called automatically`,
        id: integration.id,
        page: { id: page.id, name: page.name },
      });
    } catch (err: any) {
      logger.warn({ clientId, err: err.message }, "Facebook connect failed");
      return reply.status(400).send({ error: `Facebook connection failed: ${err.message}` });
    }
  });

  // ─── OAuth: build the Meta login dialog URL ─────────────────
  fastify.get("/integrations/facebook/oauth-url", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!config.FACEBOOK_APP_ID) {
      return reply.status(400).send({
        error: "Facebook OAuth isn't configured on this platform yet — paste a Page Access Token instead",
      });
    }
    const state = `${request.clientId!}.${Date.now()}`;
    const url =
      `https://www.facebook.com/${config.FACEBOOK_GRAPH_VERSION}/dialog/oauth` +
      `?client_id=${config.FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI())}` +
      `&scope=pages_show_list,pages_manage_leads,leads_retrieval` +
      `&state=${state}`;
    return { url };
  });

  // ─── OAuth: exchange code → token → page → subscribe ────────
  fastify.post("/integrations/facebook/exchange", async (
    request: FastifyRequest<{ Body: { code: string } }>, reply: FastifyReply
  ) => {
    const clientId = request.clientId!;
    const code = request.body?.code?.trim();

    if (!code) return reply.status(400).send({ error: "Authorization code is required" });
    if (!config.FACEBOOK_APP_ID || !config.FACEBOOK_APP_SECRET) {
      return reply.status(400).send({ error: "Facebook OAuth isn't configured on this platform" });
    }

    try {
      // 1) code → short-lived user token
      const tokenRes = await fetch(
        `https://graph.facebook.com/${config.FACEBOOK_GRAPH_VERSION}/oauth/access_token` +
          `?client_id=${config.FACEBOOK_APP_ID}` +
          `&client_secret=${config.FACEBOOK_APP_SECRET}` +
          `&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI())}` +
          `&code=${encodeURIComponent(code)}`
      );
      const tokenData = (await tokenRes.json()) as { access_token?: string; error?: { message: string } };
      if (!tokenData.access_token) {
        throw new Error(tokenData.error?.message || "Token exchange failed");
      }

      // 2) short-lived → long-lived (60 days)
      const longRes = await fetch(
        `https://graph.facebook.com/${config.FACEBOOK_GRAPH_VERSION}/oauth/access_token` +
          `?grant_type=fb_exchange_token` +
          `&client_id=${config.FACEBOOK_APP_ID}` +
          `&client_secret=${config.FACEBOOK_APP_SECRET}` +
          `&fb_exchange_token=${encodeURIComponent(tokenData.access_token)}`
      );
      const longData = (await longRes.json()) as { access_token?: string; error?: { message: string } };
      const longToken = longData.access_token || tokenData.access_token;

      // 3) list pages the broker manages
      const pagesRes = await fetch(
        `https://graph.facebook.com/${config.FACEBOOK_GRAPH_VERSION}/me/accounts` +
          `?fields=id,name,access_token&access_token=${encodeURIComponent(longToken)}`
      );
      const pagesData = (await pagesRes.json()) as {
        data?: Array<{ id: string; name: string; access_token?: string }>;
        error?: { message: string };
      };

      const page = (pagesData.data || []).find((p) => p.access_token);
      if (!page || !page.access_token) {
        throw new Error(pagesData.error?.message || "No Facebook Page found on this account — create one first");
      }

      // 4) subscribe the page to our leadgen webhook
      await subscribePageToLeadgen(page.id, page.access_token);

      const existing = await fastify.prisma.integration.findFirst({
        where: { clientId, provider: "facebook" },
      });

      const data = {
        clientId,
        provider: "facebook",
        name: `Facebook — ${page.name}`,
        description: "Facebook Lead Ads (real-time leadgen webhook)",
        apiKey: encrypt(page.access_token),
        settings: { pageId: page.id, pageName: page.name, connectedVia: "oauth" },
        status: "ACTIVE" as const,
        lastErrorMessage: null,
      };

      const integration = existing
        ? await fastify.prisma.integration.update({ where: { id: existing.id }, data })
        : await fastify.prisma.integration.create({ data });

      return reply.status(200).send({
        message: `Connected to Facebook page "${page.name}" — new leads will be AI-called automatically`,
        id: integration.id,
        page: { id: page.id, name: page.name },
      });
    } catch (err: any) {
      logger.warn({ clientId, err: err.message }, "Facebook OAuth exchange failed");
      return reply.status(400).send({ error: `Facebook connection failed: ${err.message}` });
    }
  });

  // ─── Test: verify the saved token still works ────────────────
  fastify.post("/integrations/facebook/test", async (request: FastifyRequest, reply: FastifyReply) => {
    const integration = await fastify.prisma.integration.findFirst({
      where: { clientId: request.clientId!, provider: "facebook" },
    });

    if (!integration || !integration.apiKey) {
      return reply.status(400).send({ error: "Connect your Facebook page first" });
    }

    const { decrypt } = await import("../../utils/encryption");
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
  });
}