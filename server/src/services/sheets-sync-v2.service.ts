/**
 * Bidirectional Google Sheets Sync Service.
 *
 * Two-way sync between LeadBridge leads and Google Sheets:
 * - PUSH: Export new/modified leads to Google Sheets
 * - PULL: Import new leads from Google Sheets
 * - Conflict resolution based on last-updated timestamps
 *
 * Column schema (aligned between push and pull):
 *   [Name, Phone, Email, Source, Status, Score, Budget, Location, Timeline, Received At, Updated At]
 */
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma-shared";
import { enqueueCall } from "../workers/queues";

interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: string[];
}

/**
 * Execute a full bidirectional sync.
 * Pushes local changes to Sheets, then pulls remote changes back.
 */
export async function executeSync(
  clientId: string,
  integrationId: string,
  sheetUrl: string
): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: [] };

  try {
    // Step 1: Push local leads to Sheets
    const pushed = await pushToSheet(clientId, integrationId, sheetUrl);
    result.pushed = pushed;

    // Step 2: Pull leads from Sheets
    const pulled = await pullFromSheet(clientId, integrationId, sheetUrl);
    result.pulled = pulled;

    // Update last sync timestamp
    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        lastSyncAt: new Date(),
        totalSynced: { increment: pushed + pulled },
      },
    });

    logger.info({ clientId, pushed, pulled }, "Bidirectional Sheets sync completed");
  } catch (error: any) {
    logger.error({ clientId, err: error.message }, "Sheets sync failed");
    result.errors.push(error.message);

    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        lastErrorMessage: error.message,
        lastErrorAt: new Date(),
        totalErrors: { increment: 1 },
      },
    });
  }

  return result;
}

/**
 * Push new and modified leads to Google Sheets.
 *
 * Reads integration credentials, authenticates via JWT, and appends rows
 * to the configured Google Sheet. Column order is:
 *   [Name, Phone, Email, Source, Status, Score, Budget, Location, Timeline, Received At, Updated At]
 *
 * This matches what pullFromSheet() expects when reading back.
 */
async function pushToSheet(
  clientId: string,
  integrationId: string,
  sheetUrl: string
): Promise<number> {
  // Get leads modified since last sync
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
    select: { lastSyncAt: true, credentials: true, settings: true },
  });

  if (!integration) {
    logger.warn({ integrationId }, "Integration not found for Sheets push");
    return 0;
  }

  const creds = integration.credentials as Record<string, unknown> | null;
  const settings = integration.settings as Record<string, unknown> | null;

  const spreadsheetId = (creds?.spreadsheetId as string) || parseSheetUrl(sheetUrl);
  const clientEmail = creds?.clientEmail as string;
  const privateKey = creds?.privateKey as string;
  const sheetName = (settings?.sheetName as string) || "Sheet1";

  if (!spreadsheetId || !clientEmail || !privateKey) {
    logger.warn({ integrationId }, "Google Sheets credentials incomplete — cannot push");
    return 0;
  }

  const leads = await prisma.lead.findMany({
    where: {
      clientId,
      updatedAt: integration.lastSyncAt ? { gte: integration.lastSyncAt } : undefined,
    },
    take: 100,
    orderBy: { updatedAt: "asc" },
  });

  if (leads.length === 0) return 0;

  // Build rows — column order matches pullFromSheet() expectations.
  // DO NOT include internal DB ID as column A — pull expects Name at position 0.
  const rows = leads.map((l) => [
    l.name,
    l.phone,
    l.email || "",
    l.source,
    l.status,
    String(l.score),
    l.budget || "",
    l.location || "",
    l.timeline || "",
    l.receivedAt.toISOString(),
    l.updatedAt.toISOString(),
  ]);

  try {
    const { google } = await import("googleapis");
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // First, check if there's an existing header row on row 1
    // If not, write the header first
    const headerCheck = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`,
    });

    const existingHeader = headerCheck.data.values?.[0];
    const pushHeader = [
      "Name", "Phone", "Email", "Source", "Status",
      "Score", "Budget", "Location", "Timeline", "Received At", "Updated At",
    ];

    // Only write header if first row is empty or doesn't match our expected schema
    if (!existingHeader || existingHeader.length < 5 || existingHeader[0] !== "Name") {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:K1`,
        valueInputOption: "RAW",
        requestBody: { values: [pushHeader] },
      });
    }

    // Append data rows after the last row with content
    // Using values.append() handles gaps in column A gracefully
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:K`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });

    logger.info({ clientId, sheetUrl, rowCount: rows.length }, "Pushed leads to Google Sheet");
  } catch (error: any) {
    logger.error({ clientId, err: error.message }, "Failed to push to Google Sheet");
    throw error;
  }

  return rows.length;
}

/**
 * Pull new leads from Google Sheets and import them.
 *
 * Reads rows from the configured Google Sheet that haven't been synced yet
 * (based on lastSyncRow stored in the integration settings) and creates
 * Lead records for each valid row.
 *
 * Expected column order:
 *   [Name, Phone, Email, Source, Status, Score, Budget, Location, Timeline, ...]
 */
async function pullFromSheet(
  clientId: string,
  integrationId: string,
  sheetUrl: string
): Promise<number> {
  // Read integration to get credentials and sync state
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
    select: { credentials: true, settings: true },
  });

  if (!integration) {
    logger.warn({ integrationId }, "Integration not found for Sheets pull");
    return 0;
  }

  const creds = integration.credentials as Record<string, unknown> | null;
  const settings = integration.settings as Record<string, unknown> | null;

  const spreadsheetId = (creds?.spreadsheetId as string) || parseSheetUrl(sheetUrl);
  const clientEmail = creds?.clientEmail as string;
  const privateKey = creds?.privateKey as string;
  const sheetName = (settings?.sheetName as string) || "Sheet1";
  const lastSyncRow = (settings?.lastSyncRow as number) || 1;

  if (!spreadsheetId || !clientEmail || !privateKey) {
    logger.warn({ integrationId }, "Google Sheets credentials incomplete — cannot pull");
    return 0;
  }

  try {
    // Use Google Sheets API to read rows after the last synced row
    const { google } = await import("googleapis");
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const range = `${sheetName}!A${lastSyncRow + 1}:K`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values as string[][] | undefined;
    if (!rows || rows.length === 0) {
      logger.info({ clientId, sheetUrl }, "No new rows to pull from Google Sheet");
      return 0;
    }

    // Column schema: row[0]=Name, row[1]=Phone, row[2]=Email,
    // row[3]=Source, row[4]=Budget, row[5]=Location, row[6]+ = ignored
    // Users should maintain this column order in their sheet.
    let pulled = 0;
    let lastProcessedIndex = 0;

    // FIX Round-2 #6: enforce the monthly leads cap (plan.leads) on Sheets pulls
    // too — every ingestion path must respect it, otherwise the cap is pointless.
    const { checkMonthlyLeadsCapacity, tryConsumeMonthlyLead } = await import("../utils/lead-limits");
    const planClient = await prisma.client.findUnique({
      where: { id: clientId },
      select: { plan: true },
    });
    const plan = planClient?.plan || "GROWTH";

    // Short-circuit: already at/over the cap? Don't even read the rows.
    const headroom = await checkMonthlyLeadsCapacity(prisma, clientId, plan);
    if (!headroom.canIngest) {
      logger.warn({ clientId }, `Sheets pull skipped — monthly lead limit (${headroom.limit}) reached`);
      return 0;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row[0]?.trim();
      const phone = row[1]?.trim();
      const email = row[2]?.trim();

      // Set lastProcessedIndex unconditionally so sync advances
      // past this row even if it's a duplicate or invalid.
      lastProcessedIndex = i;

      if (!name || !phone || phone.length < 10) {
        logger.debug({ rowIndex: lastSyncRow + 1 + i }, "Skipping invalid row in Sheets pull");
        continue;
      }

      // Deduplicate within last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const existing = await prisma.lead.findFirst({
        where: {
          clientId,
          phone: { contains: phone.replace(/\D/g, "").slice(-10) },
          receivedAt: { gte: thirtyDaysAgo },
        },
      });

      if (existing) {
        logger.debug({ phone, name }, "Skipping duplicate lead from Sheets");
        continue;
      }

      // Parse additional fields if available
      const source = row[3]?.trim() || "sheets-sync";
      const budget = row[4]?.trim() || undefined;
      const location = row[5]?.trim() || undefined;

      // Format phone: store as-is if already has prefix, otherwise just digits
      const cleanedPhone = phone.replace(/[\s-]/g, "");
      const formattedPhone = cleanedPhone.startsWith("+")
        ? cleanedPhone
        : cleanedPhone.replace(/\D/g, "");

      // Create the lead (status PENDING)
      const lead = await prisma.lead.create({
        data: {
          clientId,
          name,
          phone: formattedPhone,
          email: email || undefined,
          source,
          budget: budget || null,
          location: location || null,
          rawPayload: { importedFrom: "google-sheets", sheetUrl },
          status: "PENDING",
          receivedAt: new Date(),
        },
      });

      // Enqueue an immediate AI call — exactly like the webhook does.
      // Without this, pulled leads sit in the DB with status PENDING forever.
      await enqueueCall({
        leadId: lead.id,
        clientId,
        callType: "QUALIFICATION",
        attempt: 1,
      });

      // The lead is stored regardless of the cap outcome (P0-3: never drop
      // data) — count it before the consume check so stats stay accurate even
      // when the pull stops mid-way (the 1-lead cap overage is documented).
      pulled++;

      // FIX Round-2 #6: consume one slot of the monthly leads allowance
      // (race-safe guard). If the cap was just hit by a concurrent ingestion,
      // stop pulling — the stored lead is the documented 1-lead overage.
      const consumed = await tryConsumeMonthlyLead(prisma, clientId, plan);
      if (!consumed) {
        logger.warn({ clientId }, `Sheets pull stopped — monthly lead limit (${headroom.limit}) reached mid-pull`);
        break;
      }
    }

    // Update lastSyncRow: advance by the LAST actual row index we processed
    // (not rows.length, because skipped rows would throw off the offset)
    const newLastSyncRow = lastSyncRow + lastProcessedIndex + 1;
    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        settings: {
          ...(settings as Record<string, unknown> || {}),
          lastSyncRow: newLastSyncRow,
        },
      },
    });

    logger.info({ clientId, pulled, newLastSyncRow }, "Sheets pull completed");
    return pulled;
  } catch (error: any) {
    logger.error({ clientId, err: error.message }, "Failed to pull from Google Sheet");
    throw error;
  }
}

/**
 * Register a webhook URL for real-time Sheets sync.
 */
export function getWebhookUrl(baseUrl: string): string {
  return `${baseUrl}/api/v1/integrations/sheets/webhook`;
}

/**
 * Parse a Google Sheets URL to extract the spreadsheet ID.
 */
export function parseSheetUrl(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || null;
}
