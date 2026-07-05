/**
 * Email Tracking Routes — open pixel and click redirect tracking.
 *
 * GET  /track/open/:campaignId/:leadId  — 1x1 tracking pixel (logs opens)
 * GET  /track/click/:campaignId/:leadId — Click tracking redirect
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** 1x1 transparent GIF (base64-decoded) */
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export default async function trackingRoutes(fastify: FastifyInstance) {
  /**
   * Open tracking pixel — 1x1 transparent GIF.
   * Logs the open event and returns the pixel.
   */
  fastify.get<{
    Params: { campaignId: string; leadId: string };
  }>("/track/open/:campaignId/:leadId", {
    config: {
      rateLimit: { max: 10, timeWindow: "1 minute" },
    },
  }, async (request: FastifyRequest<{
    Params: { campaignId: string; leadId: string };
  }>, reply: FastifyReply) => {
    const { campaignId, leadId } = request.params;

    // Fire-and-forget: log the open event (don't block the response)
    prisma.emailTrackingEvent.create({
      data: {
        campaignId,
        leadId,
        event: "open",
        userAgent: request.headers["user-agent"]?.substring(0, 255),
        ipAddress: request.ip,
      },
    }).catch(() => {
      // Silently fail — tracking should never break the email
    });

    // Increment campaign opened count
    prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { openedCount: { increment: 1 } },
    }).catch(() => {});

    // Return 1x1 transparent GIF
    return reply
      .header("Content-Type", "image/gif")
      .header("Cache-Control", "no-store, no-cache, must-revalidate")
      .header("Pragma", "no-cache")
      .header("Expires", "0")
      .send(TRACKING_PIXEL);
  });

  /**
   * Click tracking redirect — logs the click and redirects to the original URL.
   */
  fastify.get<{
    Params: { campaignId: string; leadId: string };
    Querystring: { url?: string };
  }>("/track/click/:campaignId/:leadId", {
    config: {
      rateLimit: { max: 10, timeWindow: "1 minute" },
    },
  }, async (request: FastifyRequest<{
    Params: { campaignId: string; leadId: string };
    Querystring: { url?: string };
  }>, reply: FastifyReply) => {
    const { campaignId, leadId } = request.params;
    const { url } = request.query;

    if (!url) {
      return reply.status(400).send({ error: "Missing url parameter" });
    }

    // Validate and sanitize the URL
    let decodedUrl: string;
    try {
      decodedUrl = decodeURIComponent(url);
      // Basic validation — must be http or https
      const parsed = new URL(decodedUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return reply.status(400).send({ error: "Invalid URL protocol" });
      }
    } catch {
      return reply.status(400).send({ error: "Invalid URL" });
    }

    // Fire-and-forget: log the click event
    prisma.emailTrackingEvent.create({
      data: {
        campaignId,
        leadId,
        event: "click",
        url: decodedUrl.substring(0, 2048),
        userAgent: request.headers["user-agent"]?.substring(0, 255),
        ipAddress: request.ip,
      },
    }).catch(() => {});

    // Increment campaign clicked count
    prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { clickedCount: { increment: 1 } },
    }).catch(() => {});

    // Redirect to the original URL
    return reply.redirect(302, decodedUrl);
  });
}
