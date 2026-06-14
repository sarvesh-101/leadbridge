import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

/**
 * Territory service — assignment, lock, and availability logic.
 */

export async function getAvailableTerritories(prisma: PrismaClient) {
  return prisma.territory.findMany({
    where: { locked: false, clientId: null },
    orderBy: [{ tier: "asc" }, { city: "asc" }],
  });
}

export async function assignTerritory(
  prisma: PrismaClient,
  clientId: string,
  city: string,
  zone?: string
) {
  // Find the territory
  const territory = await prisma.territory.findFirst({
    where: {
      city,
      zone: zone || null,
      locked: false,
      clientId: null,
    },
  });

  if (!territory) {
    throw new Error(`Territory ${city}${zone ? ` - ${zone}` : ""} is not available`);
  }

  // Assign and lock in transaction
  const [updatedTerritory, updatedClient] = await prisma.$transaction([
    prisma.territory.update({
      where: { id: territory.id },
      data: {
        clientId,
        locked: true,
      },
    }),
    prisma.client.update({
      where: { id: clientId },
      data: {
        city: territory.city,
        zone: territory.zone,
      },
    }),
  ]);

  logger.info({ clientId, territoryId: territory.id, city, zone }, "Territory assigned");

  return { territory: updatedTerritory, client: updatedClient };
}

export async function releaseTerritory(prisma: PrismaClient, clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { territory: true },
  });

  if (!client?.territory) {
    throw new Error("Client has no assigned territory");
  }

  await prisma.$transaction([
    prisma.territory.update({
      where: { id: client.territory.id },
      data: { clientId: null, locked: false },
    }),
    prisma.client.update({
      where: { id: clientId },
      data: { city: "", zone: null },
    }),
  ]);

  logger.info({ clientId, territoryId: client.territory.id }, "Territory released");
}

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

export async function getClientTerritory(prisma: PrismaClient, clientId: string) {
  return prisma.territory.findUnique({
    where: { clientId },
  });
}
