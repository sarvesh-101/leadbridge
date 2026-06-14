/**
 * WebSocket Service — Real-time lead status updates via Redis pub/sub.
 *
 * Architecture:
 * 1. Any worker/service publishes an event to Redis channel: "lead:events"
 * 2. WebSocket server subscribes to Redis and forwards to connected clients
 * 3. Clients connect with JWT auth, subscribe to their own clientId channel
 *
 * Events published:
 * - lead.status_changed: { leadId, newStatus, updatedAt }
 * - lead.call_started: { leadId, callId }
 * - lead.call_ended: { leadId, callId, outcome }
 * - lead.booking_created: { leadId, bookingId, visitDate, visitTime }
 * - lead.new: { leadId, name, source, receivedAt }
 */

import Redis from "ioredis";
import { config } from "../config";
import { logger } from "../utils/logger";

let pubClient: Redis | null = null;

// Lazily initialize Redis client
function getPubClient(): Redis | null {
  if (pubClient) return pubClient;

  try {
    const client = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    client.connect()
      .then(() => { pubClient = client; })
      .catch((err) => {
        logger.warn({ err }, "WS Service: Redis unavailable — events will not be published");
        pubClient = null;
      });
  } catch {
    logger.warn("WS Service: Redis not available");
    pubClient = null;
  }

  return pubClient;
}

const CHANNEL = "lead:events";

export interface LeadEvent {
  event:
    | "lead.status_changed"
    | "lead.call_started"
    | "lead.call_ended"
    | "lead.booking_created"
    | "lead.new";
  data: Record<string, unknown>;
  clientId: string;
  timestamp: string;
}

/**
 * Publish a lead event to Redis pub/sub.
 * The WebSocket server will forward this to the appropriate client.
 */
export async function publishLeadEvent(
  event: LeadEvent["event"],
  data: Record<string, unknown>,
  clientId: string
): Promise<void> {
  try {
    const client = getPubClient();
    if (!client) {
      // Silently skip if Redis is unavailable (development mode)
      return;
    }
    const message: LeadEvent = {
      event,
      data,
      clientId,
      timestamp: new Date().toISOString(),
    };
    await client.publish(CHANNEL, JSON.stringify(message));
  } catch (error: any) {
    logger.error({ err: error.message, event }, "Failed to publish lead event");
  }
}

/**
 * Publish lead status change — called by workers and routes.
 */
export async function emitStatusChange(
  leadId: string,
  newStatus: string,
  clientId: string,
  extra: Record<string, unknown> = {}
) {
  await publishLeadEvent(
    "lead.status_changed",
    { leadId, newStatus, updatedAt: new Date().toISOString(), ...extra },
    clientId
  );
}

/**
 * Publish call started.
 */
export async function emitCallStarted(
  leadId: string,
  callId: string,
  clientId: string
) {
  await publishLeadEvent(
    "lead.call_started",
    { leadId, callId, startedAt: new Date().toISOString() },
    clientId
  );
}

/**
 * Publish call ended with outcome.
 */
export async function emitCallEnded(
  leadId: string,
  callId: string,
  outcome: string,
  clientId: string
) {
  await publishLeadEvent(
    "lead.call_ended",
    { leadId, callId, outcome, endedAt: new Date().toISOString() },
    clientId
  );
}

/**
 * Publish booking created.
 */
export async function emitBookingCreated(
  leadId: string,
  bookingId: string,
  visitDate: string,
  visitTime: string,
  clientId: string
) {
  await publishLeadEvent(
    "lead.booking_created",
    { leadId, bookingId, visitDate, visitTime },
    clientId
  );
}

/**
 * Publish new lead received.
 */
export async function emitNewLead(
  leadId: string,
  name: string,
  source: string,
  clientId: string
) {
  await publishLeadEvent(
    "lead.new",
    { leadId, name, source, receivedAt: new Date().toISOString() },
    clientId
  );
}
