import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "../utils/logger";
import { appendLeadToSheet } from "../services/sheets.service";

const prisma = new PrismaClient();

/**
 * Google Sheets Sync Cron — runs every 15 minutes.
 *
 * For each client with Google Sheets lead sources configured:
 * 1. Reads the client's sheet configuration from leadSources JSON
 * 2. Finds new leads created since last sync
 * 3. Appends new leads to the configured Google Sheet
 * 4. Updates lastSyncRow (stored in client leadSources config)
 */
export async function runSheetsSync(): Promise<{ totalSynced: number; totalErrors: number }> {
  // Find clients with lead sources that have Google Sheets config
  const clients = await prisma.client.findMany({
    where: {
      planStatus: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] },
    },
  });

  let totalSynced = 0;
  let totalErrors = 0;

  for (const client of clients) {
    // leadSources is a JSON field — find sheet-configured sources
    const leadSources = (client.leadSources as Array<Record<string, unknown>>) || [];

    for (const source of leadSources) {
      const sheetConfig = source as Record<string, unknown>;

      // Check if this source has Google Sheets configuration
      if (
        sheetConfig.type !== "google_sheets" ||
        !sheetConfig.spreadsheetId ||
        !sheetConfig.clientEmail ||
        !sheetConfig.privateKey
      ) {
        continue;
      }

      try {
        const config = {
          spreadsheetId: sheetConfig.spreadsheetId as string,
          sheetName: (sheetConfig.sheetName as string) || "Sheet1",
          clientEmail: sheetConfig.clientEmail as string,
          privateKey: (sheetConfig.privateKey as string).replace(/\\n/g, "\n"),
          columnMapping: {
            name: "Name",
            phone: "Phone",
            email: "Email",
            source: "Source",
            status: "Status",
            budget: "Budget",
            location: "Location",
            visitDate: "Visit Date",
            notes: "Notes",
          },
          lastSyncRow: (sheetConfig.lastSyncRow as number) || 1,
        };

        // Find leads created since last sync (or all leads if first sync)
        const lastSyncAt = source.lastSyncAt
          ? new Date(source.lastSyncAt as string)
          : new Date(0);

        const leads = await prisma.lead.findMany({
          where: {
            clientId: client.id,
            createdAt: { gte: lastSyncAt },
          },
          orderBy: { createdAt: "asc" },
          take: 50, // Batch size to avoid rate limits
        });

        for (const lead of leads) {
          const success = await appendLeadToSheet(config, {
            name: lead.name,
            phone: lead.phone,
            email: lead.email || "",
            source: lead.source,
            status: lead.status,
            budget: lead.budget || "",
            location: lead.location || "",
            visitDate: lead.bookedAt?.toISOString().split("T")[0] || "",
            notes: "",
          });

          if (success) {
            totalSynced++;
          } else {
            totalErrors++;
          }
        }

        // Update lastSyncRow in the source config
        if (leads.length > 0) {
          source.lastSyncAt = new Date().toISOString();
          source.lastSyncRow = (config.lastSyncRow || 1) + leads.length;
        }

        logger.info(
          { clientId: client.id, spreadsheetId: config.spreadsheetId, synced: leads.length },
          "Google Sheets sync completed for client"
        );
      } catch (error: any) {
        totalErrors++;
        logger.error(
          { clientId: client.id, err: error.message },
          "Google Sheets sync failed for client"
        );
      }
    }

    // Update the leadSources field with new sync timestamps
    if (client.leadSources) {
      await prisma.client.update({
        where: { id: client.id },
        data: { leadSources: leadSources as Prisma.InputJsonValue },
      });
    }
  }

  logger.info({ totalSynced, totalErrors }, "Google Sheets sync cycle completed");
  return { totalSynced, totalErrors };
}

// Type helper for Prisma JSON
type PrismaInputJsonValue =
  | string
  | number
  | boolean
  | null
  | PrismaInputJsonValue[]
  | { [key: string]: PrismaInputJsonValue };
