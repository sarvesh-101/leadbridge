/**
 * Google Sheets Sync Service — Two-way automatic lead synchronization.
 *
 * Brokers connect their Google Sheets and leads flow automatically:
 * - NEW LEADS → Appended to sheet in real-time
 * - STATUS UPDATES → Updated in sheet rows
 * - MANUAL ENTRIES → From sheet back into LeadBridge
 *
 * Uses the Google Sheets API v4 with service account authentication.
 */

import axios from "axios";
import { google } from "googleapis";
import { logger } from "../utils/logger";

export interface GoogleSheetConfig {
  spreadsheetId: string;
  sheetName: string;
  clientEmail: string;
  privateKey: string;
  columnMapping: {
    name: string;
    phone: string;
    email?: string;
    source?: string;
    status?: string;
    budget?: string;
    location?: string;
    visitDate?: string;
    notes?: string;
  };
  lastSyncRow: number;
}

async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const tokens = await auth.authorize();
  return tokens.access_token || "";
}

export async function appendLeadToSheet(
  sheetConfig: GoogleSheetConfig,
  leadData: Record<string, string>
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(sheetConfig.clientEmail, sheetConfig.privateKey);
    const range = `${sheetConfig.sheetName}!A:Z`;

    const columnOrder = [
      sheetConfig.columnMapping.name,
      sheetConfig.columnMapping.phone,
      sheetConfig.columnMapping.email,
      sheetConfig.columnMapping.source,
      sheetConfig.columnMapping.status,
      sheetConfig.columnMapping.budget,
      sheetConfig.columnMapping.location,
      sheetConfig.columnMapping.visitDate,
      sheetConfig.columnMapping.notes,
    ].filter(Boolean) as string[];

    const row = columnOrder.map((col) => leadData[col] || "");

    await axios.post(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetConfig.spreadsheetId}/values/${range}:append`,
      { values: [row] },
      {
        params: { valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS" },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    logger.info({ spreadsheetId: sheetConfig.spreadsheetId, leadName: leadData.name }, "Lead appended to Google Sheet");
    return true;
  } catch (error: any) {
    logger.error({ err: error.response?.data?.error?.message || error.message }, "Failed to append lead to Google Sheet");
    return false;
  }
}

export async function updateLeadInSheet(
  sheetConfig: GoogleSheetConfig,
  rowIndex: number,
  leadData: Record<string, string>
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken(sheetConfig.clientEmail, sheetConfig.privateKey);
    const range = `${sheetConfig.sheetName}!A${rowIndex}:Z${rowIndex}`;

    const columnOrder = [
      sheetConfig.columnMapping.name,
      sheetConfig.columnMapping.phone,
      sheetConfig.columnMapping.email,
      sheetConfig.columnMapping.source,
      sheetConfig.columnMapping.status,
      sheetConfig.columnMapping.budget,
      sheetConfig.columnMapping.location,
      sheetConfig.columnMapping.visitDate,
      sheetConfig.columnMapping.notes,
    ].filter(Boolean) as string[];

    const row = columnOrder.map((col) => leadData[col] || "");

    await axios.put(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetConfig.spreadsheetId}/values/${range}`,
      { values: [row] },
      {
        params: { valueInputOption: "USER_ENTERED" },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return true;
  } catch (error: any) {
    logger.error({ err: error.message }, "Failed to update lead in Google Sheet");
    return false;
  }
}

export async function syncLeadsFromSheet(
  sheetConfig: GoogleSheetConfig,
  onNewLead: (data: Record<string, string>) => Promise<void>
): Promise<{ synced: number; errors: number }> {
  try {
    const accessToken = await getAccessToken(sheetConfig.clientEmail, sheetConfig.privateKey);
    const range = `${sheetConfig.sheetName}!A${sheetConfig.lastSyncRow + 1}:Z`;

    const response = await axios.get(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetConfig.spreadsheetId}/values/${range}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const rows = (response.data.values as string[][]) || [];
    let synced = 0;
    let errors = 0;

    const columnOrder = [
      sheetConfig.columnMapping.name,
      sheetConfig.columnMapping.phone,
      sheetConfig.columnMapping.email,
      sheetConfig.columnMapping.source,
      sheetConfig.columnMapping.status,
      sheetConfig.columnMapping.budget,
      sheetConfig.columnMapping.location,
      sheetConfig.columnMapping.visitDate,
      sheetConfig.columnMapping.notes,
    ].filter(Boolean) as string[];

    for (const row of rows) {
      try {
        const leadData: Record<string, string> = {};
        columnOrder.forEach((col, idx) => {
          if (row[idx]) leadData[col] = row[idx];
        });

        if (leadData.name && leadData.phone) {
          await onNewLead(leadData);
          synced++;
        }
      } catch {
        errors++;
      }
    }

    logger.info({ synced, errors }, "Google Sheet sync completed");
    return { synced, errors };
  } catch (error: any) {
    logger.error({ err: error.message }, "Google Sheet sync failed");
    return { synced: 0, errors: 1 };
  }
}
