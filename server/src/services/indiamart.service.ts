/**
 * IndiaMART Leads API service — real connector for IndiaMART seller accounts.
 *
 * IndiaMART exposes two official API modes (documented at
 * https://help.indiamart.com/knowledge-base/im-lms-leads-api/):
 *
 *   1. PUSH API (real-time, primary path)
 *      IndiaMART POSTs each new lead to a webhook URL the seller configures in
 *      Lead Manager → Import/Export Leads → Push API. Payload is JSON with the
 *      lead data nested under `body.RESPONSE`. Must return HTTP 200 to
 *      acknowledge; IndiaMART retries on failure and deactivates the push after
 *      48h of continuous failure. Dedup via `UNIQUE_QUERY_ID`.
 *
 *   2. PULL API (fallback / backfill, polled every 5 minutes)
 *      GET https://mapi.indiamart.com/wmscom/API/GetLeadData/ with the seller's
 *      CRM key + registered mobile. Returns leads in a time window (max 365 days).
 *
 * Access: the LMS Leads API is a PAID add-on. Sellers generate a CRM key at
 * seller.indiamart.com → Lead Manager → (⋮ menu) → CRM Integration → Generate Key
 * (or direct: https://seller.indiamart.com/leadmanager/crmapi). The key is
 * delivered to the registered email and is tied to the registered mobile number.
 */
import crypto from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type Redis from "ioredis";
import { normalizePhone } from "../utils/phone";
import { enqueueCall } from "../workers/queues";
import { logger } from "../utils/logger";

/** Normalized IndiaMART lead (shared by Push + Pull paths). */
export interface IndiaMartLead {
  uniqueQueryId: string;
  queryType: string;
  queryTime?: string;
  name: string;
  phone: string;
  email?: string;
  subject?: string;
  company?: string;
  city?: string;
  state?: string;
  productName?: string;
  message?: string;
  raw: Record<string, unknown>;
}

/** Human-readable label for IndiaMART query types (from their API docs). */
const QUERY_TYPE_LABELS: Record<string, string> = {
  W: "Direct Enquiry",
  B: "Buy-Lead",
  P: "PNS Call",
  BIZ: "Catalog View",
  WA: "WhatsApp Enquiry",
};

function cleanStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Normalize a raw IndiaMART lead record (either from Push `RESPONSE` or Pull
 * API output) into our standard shape. Returns null when the record is
 * unusable (missing query id or phone).
 */
export function normalizeIndiaMartLead(raw: Record<string, unknown>): IndiaMartLead | null {
  const uniqueQueryId = cleanStr(raw.UNIQUE_QUERY_ID);
  const mobile = cleanStr(raw.SENDER_MOBILE);
  const phoneRaw = mobile || cleanStr(raw.SENDER_PHONE) || cleanStr(raw.SENDER_MOBILE_ALT);

  if (!uniqueQueryId) {
    logger.warn({ raw }, "IndiaMART lead missing UNIQUE_QUERY_ID — skipping");
    return null;
  }

  let phone = "";
  if (phoneRaw) {
    try {
      phone = normalizePhone(phoneRaw);
    } catch {
      logger.warn({ phoneRaw, uniqueQueryId }, "IndiaMART lead has invalid phone — skipping");
      return null;
    }
  } else {
    logger.warn({ uniqueQueryId }, "IndiaMART lead has no phone — skipping (cannot AI-call)");
    return null;
  }

  const name = cleanStr(raw.SENDER_NAME) || "IndiaMART Buyer";
  const queryType = cleanStr(raw.QUERY_TYPE);

  return {
    uniqueQueryId,
    queryType,
    queryTime: cleanStr(raw.QUERY_TIME) || undefined,
    name,
    phone,
    email: cleanStr(raw.SENDER_EMAIL) || undefined,
    subject: cleanStr(raw.SUBJECT) || undefined,
    company: cleanStr(raw.SENDER_COMPANY) || undefined,
    city: cleanStr(raw.SENDER_CITY) || undefined,
    state: cleanStr(raw.SENDER_STATE) || undefined,
    productName: cleanStr(raw.QUERY_PRODUCT_NAME) || undefined,
    message: cleanStr(raw.QUERY_MESSAGE) || undefined,
    raw,
  };
}

/**
 * Extract the lead record from a Push API webhook body.
 * IndiaMART sends `{ method, json, headers, url, body: { CODE, STATUS, RESPONSE: {...} } }`,
 * but be tolerant of the RESPONSE object arriving at the top level too.
 */
export function extractIndiaMartResponse(body: Record<string, unknown>): Record<string, unknown> | null {
  const nested = body.body as Record<string, unknown> | undefined;
  const response =
    (nested?.RESPONSE as Record<string, unknown> | undefined) ||
    (body.RESPONSE as Record<string, unknown> | undefined);

  if (response && typeof response === "object") {
    return response;
  }
  // Bare record (RESPONSE fields at top level)
  if (body.UNIQUE_QUERY_ID || body.SENDER_MOBILE) {
    return body;
  }
  return null;
}

/** Dependencies shared by the webhook route and the Pull cron. */
export interface IndiaMartCtx {
  prisma: PrismaClient;
  redis?: Redis | null;
  log?: (msg: string, obj?: Record<string, unknown>) => void;
}

/**
 * Create a lead from an IndiaMART record and kick off the AI calling pipeline.
 * Delegates to the shared external-lead pipeline so IndiaMART, Facebook and
 * future connectors enforce identical guardrails (caps, dedup, call quota).
 */
export async function createLeadFromIndiaMart(
  ctx: IndiaMartCtx,
  params: { clientId: string; lead: IndiaMartLead }
): Promise<{ status: "created" | "duplicate" | "skipped"; leadId?: string }> {
  const { ingestExternalLead } = await import("./lead-ingestion.service");
  const { prisma, redis, log } = ctx;
  const { clientId, lead } = params;

  void log;

  return ingestExternalLead(
    { prisma, redis },
    {
      clientId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      source: "indiamart",
      portalSource: QUERY_TYPE_LABELS[lead.queryType] || lead.queryType || "IndiaMART",
      dedupQueryId: lead.uniqueQueryId,
      logLabel: "IndiaMART",
      rawPayload: {
        uniqueQueryId: lead.uniqueQueryId,
        queryType: lead.queryType,
        queryTime: lead.queryTime,
        subject: lead.subject,
        company: lead.company,
        city: lead.city,
        state: lead.state,
        productName: lead.productName,
        message: lead.message,
        provider: "indiamart",
        raw: lead.raw as unknown as Prisma.InputJsonValue,
      },
    }
  );
}

// ─── Pull API client ──────────────────────────────────────────────

const INDIA_MART_PULL_URL = "https://mapi.indiamart.com/wmscom/API/GetLeadData/";

/**
 * Format a Date as IndiaMART Pull API expects: "dd-mm-yyyy hh:mm:ss" (IST).
 */
export function formatIndiaMartTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Pull IndiaMART leads for a time window using the seller's CRM key + mobile.
 *
 * Signature construction follows the IndiaMART v2 spec used by every public
 * integration (md5 of the CRM key concatenated with the registered mobile).
 * If IndiaMART changes this, the /test endpoint surfaces it immediately as a
 * signature error — adjust `buildSignature` to match their docs.
 */
export async function fetchIndiaMartLeads(
  crmKey: string,
  mobile: string,
  startTime: Date,
  endTime: Date
): Promise<IndiaMartLead[]> {
  const signature = crypto.createHash("md5").update(crmKey + mobile).digest("hex");

  const params = new URLSearchParams({
    key: crmKey,
    user_id: mobile,
    signature,
    glusr_crm_key: crmKey,
    start_time: formatIndiaMartTime(startTime),
    end_time: formatIndiaMartTime(endTime),
  });

  const url = `${INDIA_MART_PULL_URL}?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`IndiaMART Pull API HTTP ${res.status}`);
    }
    const data = (await res.json()) as Record<string, unknown>;

    if (data.STATUS !== "SUCCESS") {
      throw new Error(`IndiaMART Pull API error: ${JSON.stringify(data).slice(0, 300)}`);
    }

    const response = data.RESPONSE;
    const records = Array.isArray(response) ? response : response ? [response] : [];

    const leads: IndiaMartLead[] = [];
    for (const record of records as Record<string, unknown>[]) {
      const lead = normalizeIndiaMartLead(record);
      if (lead) leads.push(lead);
    }
    return leads;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Test a seller's IndiaMART credentials by pulling a tiny window (last 5 min).
 * Returns the raw outcome so the UI can show whether the key/signature works.
 */
export async function testIndiaMartConnection(
  crmKey: string,
  mobile: string
): Promise<{ ok: boolean; leads: number; error?: string }> {
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 5 * 60 * 1000);
    const leads = await fetchIndiaMartLeads(crmKey, mobile, start, end);
    return { ok: true, leads: leads.length };
  } catch (err: any) {
    return { ok: false, leads: 0, error: err.message || "Connection failed" };
  }
}