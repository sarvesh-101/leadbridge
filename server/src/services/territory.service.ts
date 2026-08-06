import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

/**
 * Territory service — assignment, lock, and availability logic.
 *
 * SOFT TERRITORY MODEL (2026-08-06):
 * Leads are 100% broker-sourced (own webhooks, own Google/Facebook ads, own
 * portal forwarding, own CSV import). There is NO shared lead pool — a lead's
 * clientId is set at ingestion, so leads never mix between brokers.
 *
 * This means a city/zone is NOT exclusive in any real sense. Locking a city to
 * one broker only blocked new sales ("Mumbai already taken") while protecting
 * nothing. Therefore claiming a territory now ONLY sets the broker's
 * "service area" tag (client.city / client.zone), used for the +10% scoring
 * bonus and analytics — and it NEVER blocks a second broker in the same area.
 *
 * The Territory catalog row is linked when free (for admin visibility /
 * heatmaps); when already taken, the client still gets their service area tag
 * without stealing the row.
 */

/** List territory rows that are currently unassigned (informational only). */
export async function getAvailableTerritories(prisma: PrismaClient) {
  return prisma.territory.findMany({
    where: { locked: false, clientId: null },
    orderBy: [{ tier: "asc" }, { city: "asc" }],
  });
}

/**
 * Set a broker's service area (soft territory claim).
 *
 * Always succeeds — never throws for "taken". Links the Territory row only if
 * it is free; otherwise the client still gets client.city/zone as their service
 * area tag (scoring bonus + analytics) without stealing the row.
 *
 * FIX (reviewer): before linking a NEW row, the client's existing linked row
 * (old hard-model data) is unlinked first — Territory.clientId is @unique, so
 * a second link to the same client would throw P2002. Changing service area is
 * now allowed freely (no "release first" rule).
 */
export async function assignTerritory(
  prisma: PrismaClient,
  clientId: string,
  city: string,
  zone?: string
) {
  const normalizedCity = city.trim();
  const normalizedZone = zone?.trim() || null;

  // 1. Free any previously-linked row so Territory.clientId (@unique) is never
  //    violated when we link a new one. Same row → keep it linked (no-op).
  const existingLinked = await prisma.territory.findFirst({
    where: { clientId },
    select: { id: true, city: true, zone: true, tier: true },
  });

  const sameRowAlreadyLinked =
    existingLinked &&
    existingLinked.city.toLowerCase() === normalizedCity.toLowerCase() &&
    (existingLinked.zone ?? "").toLowerCase() === (normalizedZone ?? "").toLowerCase();

  if (existingLinked && !sameRowAlreadyLinked) {
    await prisma.territory.update({
      where: { id: existingLinked.id },
      data: { clientId: null, locked: false },
    });
  }

  // 2. Find-or-create the target row and link it only if free.
  let linked: { id: string; city: string; zone: string | null; tier: number } | null =
    sameRowAlreadyLinked ? existingLinked : null;

  if (!linked) {
    const target = await prisma.territory.findFirst({
      where: {
        city: { equals: normalizedCity, mode: "insensitive" },
        zone: normalizedZone ? { equals: normalizedZone, mode: "insensitive" } : null,
      },
    });

    if (target) {
      // Row exists. Link it only if it's free — never steal from another broker.
      if (!target.clientId && !target.locked) {
        linked = await prisma.territory.update({
          where: { id: target.id },
          data: { clientId, locked: true },
          select: { id: true, city: true, zone: true, tier: true },
        });
      }
      // else: taken — client still gets service area tag below (soft model)
    } else {
      // No row yet — create one and link it.
      linked = await prisma.territory.create({
        data: { city: normalizedCity, zone: normalizedZone, tier: 2, clientId, locked: true },
        select: { id: true, city: true, zone: true, tier: true },
      });
    }
  }

  // 3. Always set the broker's service area tag.
  const updatedClient = await prisma.client.update({
    where: { id: clientId },
    data: { city: normalizedCity, zone: normalizedZone },
  });

  logger.info({ clientId, city: normalizedCity, zone: normalizedZone, linked: !!linked }, "Territory (service area) set — soft model");

  return { territory: linked, client: updatedClient };
}

/**
 * Clear a client's service area and free their linked Territory row.
 *
 * FIX (reviewer): with the soft model a client may have city/zone set but NO
 * linked row (their target row is owned by someone else). Release now clears
 * the service area in that case too instead of 400ing.
 */
export async function releaseTerritory(prisma: PrismaClient, clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { territory: true },
  });

  if (!client) {
    throw new Error("Client not found");
  }

  if (!client.territory && !client.city) {
    throw new Error("Client has no assigned territory");
  }

  await prisma.$transaction([
    // Free the linked row if one exists
    ...(client.territory
      ? [prisma.territory.update({
          where: { id: client.territory.id },
          data: { clientId: null, locked: false },
        })]
      : []),
    // Clear the service area tag
    prisma.client.update({
      where: { id: clientId },
      data: { city: "", zone: null },
    }),
  ]);

  logger.info({ clientId, territoryId: client.territory?.id }, "Territory released");
}

/** Informational availability check (soft model — never blocks claims). */
export async function isTerritoryAvailable(
  prisma: PrismaClient,
  city: string,
  zone?: string
): Promise<boolean> {
  const territory = await prisma.territory.findFirst({
    where: {
      city,
      zone: zone || null,
    },
  });

  return !territory || (!territory.locked && !territory.clientId);
}

/** Get the Territory row linked to a client (may be null even with service area set). */
export async function getClientTerritory(prisma: PrismaClient, clientId: string) {
  return prisma.territory.findUnique({
    where: { clientId },
  });
}
