/**
 * Calendar Sync Service.
 *
 * Syncs booking visits to Google Calendar & Outlook.
 * Uses OAuth2 for calendar integration.
 */

import { PrismaClient } from "@prisma/client";
import { config } from "../config";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();

interface CalendarEvent {
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  attendees?: string[];
}

/**
 * Sync a booking to the broker's connected calendar.
 */
export async function syncBookingToCalendar(
  clientId: string,
  bookingId: string
): Promise<{ success: boolean; eventUrl?: string; error?: string }> {
  try {
    // Find the booking with lead info
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId, clientId },
      include: { lead: { select: { name: true, phone: true } } },
    });

    if (!booking) throw new Error("Booking not found");

    // Find the calendar integration
    const integration = await prisma.integration.findFirst({
      where: { clientId, provider: "google_calendar", status: "ACTIVE" },
    });

    if (!integration) {
      return { success: false, error: "No active calendar integration" };
    }

    const credentials = integration.credentials as {
      accessToken?: string;
      refreshToken?: string;
      calendarId?: string;
    };

    if (!credentials.accessToken) {
      return { success: false, error: "Calendar not authenticated — reconnect" };
    }

    const startDateTime = new Date(booking.visitDate);
    const [hours, minutes] = (booking.visitTime || "10:00").split(":").map(Number);
    startDateTime.setHours(hours, minutes, 0, 0);

    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour

    const event: CalendarEvent = {
      summary: `Property Visit: ${booking.propertyName || booking.propertyAddress}`,
      description: [
        `Lead: ${booking.lead?.name || "Unknown"}`,
        `Phone: ${booking.lead?.phone || "—"}`,
        `Address: ${booking.propertyAddress}`,
        booking.notes ? `Notes: ${booking.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
    };

    // Create event via Google Calendar API
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${
        encodeURIComponent(credentials.calendarId || "primary")
      }/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          start: { dateTime: event.startTime, timeZone: "Asia/Kolkata" },
          end: { dateTime: event.endTime, timeZone: "Asia/Kolkata" },
          attendees: event.attendees?.map((email) => ({ email })),
          reminders: {
            useDefault: false,
            overrides: [
              { method: "popup", minutes: 30 },
              { method: "email", minutes: 60 },
            ],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, "Calendar API error");

      // If token expired, try refreshing
      if (response.status === 401 && credentials.refreshToken) {
        const refreshed = await refreshGoogleToken(clientId, integration.id, credentials.refreshToken);
        if (refreshed) {
          // Retry with new token
          return syncBookingToCalendar(clientId, bookingId);
        }
      }

      throw new Error(`Calendar API error: ${response.status}`);
    }

    const eventData = await response.json() as { htmlLink?: string };

    // Update booking with calendar event ID
    await prisma.booking.update({
      where: { id: bookingId },
      data: { notes: booking.notes ? `${booking.notes}\nCalendar: ${eventData.htmlLink}` : `Calendar: ${eventData.htmlLink}` },
    });

    return { success: true, eventUrl: eventData.htmlLink };
  } catch (error: any) {
    logger.error({ err: error.message }, "Calendar sync failed");
    return { success: false, error: error.message };
  }
}

/**
 * Get Google OAuth URL for calendar integration.
 */
export function getGoogleAuthUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID || "",
    redirect_uri: `${config.FRONTEND_URL}/dashboard/integrations/calendar/callback`,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/calendar.events",
    state: clientId,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Handle Google OAuth callback and store tokens.
 */
export async function handleGoogleCallback(
  clientId: string,
  code: string
): Promise<boolean> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.GOOGLE_CLIENT_ID || "",
        client_secret: config.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: `${config.FRONTEND_URL}/dashboard/integrations/calendar/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error }, "Google OAuth token exchange failed");
      return false;
    }

    const tokens = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number };

    // Upsert calendar integration
    const existing = await prisma.integration.findFirst({
      where: { clientId, provider: "google_calendar" },
    });

    const credentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: Date.now() + (tokens.expires_in || 3600) * 1000,
    };

    if (existing) {
      await prisma.integration.update({
        where: { id: existing.id },
        data: {
          credentials: credentials as any,
          status: "ACTIVE",
        },
      });
    } else {
      await prisma.integration.create({
        data: {
          clientId,
          provider: "google_calendar",
          name: "Google Calendar",
          status: "ACTIVE",
          credentials: credentials as any,
        },
      });
    }

    return true;
  } catch (error: any) {
    logger.error({ err: error.message }, "Google OAuth callback failed");
    return false;
  }
}

/**
 * Refresh an expired Google access token.
 */
async function refreshGoogleToken(
  clientId: string,
  integrationId: string,
  refreshToken: string
): Promise<boolean> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: config.GOOGLE_CLIENT_ID || "",
        client_secret: config.GOOGLE_CLIENT_SECRET || "",
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) return false;

    const tokens = await response.json() as { access_token?: string; expires_in?: number };

    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        credentials: {
          accessToken: tokens.access_token,
          refreshToken,
          expiryDate: Date.now() + (tokens.expires_in || 3600) * 1000,
        } as any,
      },
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a client has an active calendar integration.
 */
export async function hasCalendarIntegration(clientId: string): Promise<boolean> {
  const integration = await prisma.integration.findFirst({
    where: { clientId, provider: "google_calendar", status: "ACTIVE" },
  });
  return !!integration;
}
