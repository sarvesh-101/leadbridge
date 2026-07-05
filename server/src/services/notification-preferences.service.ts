/**
 * Notification Preferences Service — Per-Team-Member Notification Settings.
 *
 * Allows each team member to configure how they receive notifications:
 * - WhatsApp (default)
 * - Email
 * - SMS
 * - In-app (WebSocket)
 *
 * Each member can choose channels per event type (lead.created, booking.confirmed, etc.)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_EVENT_TYPES = [
  "lead.created",
  "lead.status_changed",
  "booking.confirmed",
  "booking.rescheduled",
  "booking.cancelled",
  "booking.reminder",
  "call.completed",
  "payment.received",
  "campaign.completed",
];

const DEFAULT_CHANNELS = ["whatsapp", "in_app"];

interface NotificationPreference {
  memberId: string;
  eventType: string;
  channels: string[];
  enabled: boolean;
}

/**
 * Get notification preferences for a team member.
 */
export async function getPreferences(memberId: string): Promise<NotificationPreference[]> {
  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
  });

  if (!member) return [];

  // Get stored preferences
  const stored = await prisma.notificationPreference.findMany({
    where: { memberId },
  });

  // Merge with defaults — any event type not stored gets defaults
  const storedMap = new Map(stored.map((p) => [p.eventType, p]));
  const prefs = DEFAULT_EVENT_TYPES.map((eventType) => {
    const existing = storedMap.get(eventType);
    return {
      memberId,
      eventType,
      channels: existing?.channels as string[] || [...DEFAULT_CHANNELS],
      enabled: existing?.enabled ?? true,
    };
  });

  return prefs;
}

/**
 * Update notification preferences for a team member.
 */
export async function updatePreferences(
  memberId: string,
  preferences: Array<{ eventType: string; channels: string[]; enabled: boolean }>
): Promise<void> {
  // Upsert each preference
  for (const pref of preferences) {
    if (!DEFAULT_EVENT_TYPES.includes(pref.eventType)) continue;

    await prisma.notificationPreference.upsert({
      where: {
        memberId_eventType: { memberId, eventType: pref.eventType },
      },
      create: {
        memberId,
        eventType: pref.eventType,
        channels: pref.channels,
        enabled: pref.enabled,
      },
      update: {
        channels: pref.channels,
        enabled: pref.enabled,
      },
    });
  }
}

/**
 * Get effective notification channels for a team member for a specific event type.
 */
export async function getEffectiveChannels(
  memberId: string,
  eventType: string
): Promise<string[]> {
  const pref = await prisma.notificationPreference.findUnique({
    where: {
      memberId_eventType: { memberId, eventType },
    },
  });

  if (!pref || !pref.enabled) {
    // Check if default
    if (DEFAULT_EVENT_TYPES.includes(eventType)) {
      return [...DEFAULT_CHANNELS];
    }
    return [];
  }

  return pref.channels as string[];
}

/**
 * Create the NotificationPreference table via Prisma.
 * This is called during first access to initialize.
 */
export async function ensureDefaults(memberId: string): Promise<void> {
  const existing = await prisma.notificationPreference.count({
    where: { memberId },
  });

  if (existing === 0) {
    // Create defaults for every event type
    await prisma.notificationPreference.createMany({
      data: DEFAULT_EVENT_TYPES.map((eventType) => ({
        memberId,
        eventType,
        channels: DEFAULT_CHANNELS,
        enabled: true,
      })),
    });
  }
}

/**
 * Reset all preferences for a member to defaults.
 */
export async function resetToDefaults(memberId: string): Promise<void> {
  await prisma.notificationPreference.deleteMany({
    where: { memberId },
  });

  await ensureDefaults(memberId);
}
