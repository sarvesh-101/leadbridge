/**
 * Notification Preferences Routes — per team member notification settings.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

const EVENT_TYPE_OPTIONS = [
  { value: "lead.created", label: "New Lead Created" },
  { value: "lead.status_changed", label: "Lead Status Changed" },
  { value: "booking.confirmed", label: "Booking Confirmed" },
  { value: "booking.rescheduled", label: "Booking Rescheduled" },
  { value: "booking.cancelled", label: "Booking Cancelled" },
  { value: "booking.reminder", label: "Booking Reminder" },
  { value: "call.completed", label: "AI Call Completed" },
  { value: "payment.received", label: "Payment Received" },
  { value: "campaign.completed", label: "Campaign Completed" },
];

export default async function notificationPreferenceRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── Get Preferences ───────────────────────────────────────
  fastify.get("/notifications/preferences", async (request: FastifyRequest) => {
    const memberId = request.userId || request.clientId!;
    const { getPreferences, ensureDefaults } = await import("../../services/notification-preferences.service");

    // Ensure defaults exist on first access
    await ensureDefaults(memberId).catch(() => {});

    const prefs = await getPreferences(memberId);
    return { preferences: prefs, eventTypes: EVENT_TYPE_OPTIONS };
  });

  // ─── Update Preferences ────────────────────────────────────
  fastify.put("/notifications/preferences", {
    schema: {
      body: {
        type: "object",
        required: ["preferences"],
        properties: {
          preferences: {
            type: "array",
            items: {
              type: "object",
              required: ["eventType", "enabled"],
              properties: {
                eventType: { type: "string" },
                channels: { type: "array", items: { type: "string" } },
                enabled: { type: "boolean" },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: { preferences: Array<{ eventType: string; channels: string[]; enabled: boolean }> };
  }>, reply: FastifyReply) => {
    const memberId = request.userId || request.clientId!;
    const { updatePreferences } = await import("../../services/notification-preferences.service");

    await updatePreferences(memberId, request.body.preferences);
    return { success: true };
  });

  // ─── Reset to Defaults ─────────────────────────────────────
  fastify.post("/notifications/preferences/reset", async (request: FastifyRequest) => {
    const memberId = request.userId || request.clientId!;
    const { resetToDefaults } = await import("../../services/notification-preferences.service");

    await resetToDefaults(memberId);
    return { success: true };
  });
}
