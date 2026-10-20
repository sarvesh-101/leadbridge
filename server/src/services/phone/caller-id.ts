/**
 * Caller-ID resolution for outbound AI calls.
 *
 * Omnidim rejects a dispatch that has no caller-ID number, so a broker who
 * assigned an agent but never picked a number could not place any calls. This
 * helper resolves the number once, assigning a free platform number when the
 * client has none (or when theirs no longer exists in the inventory) — the same
 * one-client-per-number rule the /voice/phone-numbers/choose route enforces.
 */

import type { PrismaClient } from "@prisma/client";
import { listPhoneNumbers } from "../omnidimension-phone.service";
import { logger } from "../../utils/logger";

export interface CallerNumber {
  /** Omnidim phone number id (what dispatch expects as from_number_id) */
  id: number;
  /** E.164 number, mirrored onto the client row */
  phoneNumber: string;
  /** true when this call auto-assigned a number to the client */
  assignedNow: boolean;
}

export async function resolveCallerNumber(
  prisma: PrismaClient,
  clientId: string,
): Promise<CallerNumber | null> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, omniPhoneNumberId: true, omniPhoneNumber: true, omniAgentId: true },
  });
  if (!client) return null;

  const available = await listPhoneNumbers().catch((err: any) => {
    logger.warn({ err: err?.message }, "Caller ID: could not list platform numbers");
    return [] as Awaited<ReturnType<typeof listPhoneNumbers>>;
  });

  // Already holding a number that still exists in the platform inventory.
  if (client.omniPhoneNumberId) {
    const own = available.find((n) => Number(n.id) === client.omniPhoneNumberId);
    if (own) {
      return { id: own.id, phoneNumber: own.phone_number, assignedNow: false };
    }
  }

  // Pick a number no other client holds, preferring one already attached to
  // this client's agent so the call goes out on a live line.
  const held = await prisma.client.findMany({
    where: { omniPhoneNumberId: { not: null }, NOT: { id: clientId } },
    select: { omniPhoneNumberId: true },
  });
  const heldIds = new Set(held.map((h) => h.omniPhoneNumberId));
  const free = available.filter((n) => !heldIds.has(n.id));
  const chosen =
    free.find((n) => String((n as { active_bot_id?: unknown }).active_bot_id ?? "") === String(client.omniAgentId)) ??
    free[0];

  if (!chosen) return null;

  await prisma.client.update({
    where: { id: clientId },
    data: { omniPhoneNumberId: chosen.id, omniPhoneNumber: chosen.phone_number },
  });
  logger.info({ clientId, numberId: chosen.id }, "Caller ID: auto-assigned platform number to client");

  return { id: chosen.id, phoneNumber: chosen.phone_number, assignedNow: true };
}
