/**
 * Calendar Sync Routes.
 * GET  /calendar/auth      — Get Google OAuth URL
 * POST /calendar/callback  — Handle OAuth callback
 * GET  /calendar/status    — Check if calendar is connected
 * POST /calendar/sync      — Sync a booking to calendar
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { config } from "../../config";
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  hasCalendarIntegration,
  syncBookingToCalendar,
} from "../../services/calendar-sync.service";

export default async function calendarSyncRoutes(fastify: FastifyInstance) {
  /**
   * Google OAuth callback (GET — public, no auth, Google redirects here with ?code=...).
   * Must be registered BEFORE the auth hook since Google doesn't send JWT tokens.
   */
  fastify.get<{
    Querystring: { code?: string; state?: string; error?: string };
  }>("/calendar/callback", async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state: clientId, error } = request.query as { code?: string; state?: string; error?: string };

    if (error || !code) {
      return reply.redirect(`${config.FRONTEND_URL}/dashboard/integrations?calendar=error`);
    }

    const ok = await handleGoogleCallback(clientId || "", code);
    return reply.redirect(
      `${config.FRONTEND_URL}/dashboard/integrations?calendar=${ok ? "connected" : "failed"}`
    );
  });

  // Auth-protected routes below
  fastify.addHook("preHandler", fastify.authenticate);

  /**
   * Get Google OAuth URL for calendar integration.
   */
  fastify.get("/calendar/auth", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const url = getGoogleAuthUrl(clientId);
    return { success: true, authUrl: url };
  });

  /**
   * Handle Google OAuth callback (POST — frontend extracts code from URL and sends it).
   */
  fastify.post<{
    Body: { code: string };
  }>("/calendar/callback", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const body = request.body as { code: string };

    const ok = await handleGoogleCallback(clientId, body.code);
    return { connected: ok, message: ok ? "Calendar connected!" : "Failed to connect calendar" };
  });

  /**
   * Check if calendar integration is active.
   */
  fastify.get("/calendar/status", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const connected = await hasCalendarIntegration(clientId);
    return { success: true, connected };
  });

  /**
   * Sync a booking to the connected calendar.
   */
  fastify.post<{
    Body: { bookingId: string };
  }>("/calendar/sync", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const body = request.body as { bookingId: string };

    const result = await syncBookingToCalendar(clientId, body.bookingId);
    return { success: result.success, eventUrl: result.eventUrl, error: result.error };
  });
}
