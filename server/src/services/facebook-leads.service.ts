/**
 * Facebook Lead Ads connector — official Meta `leadgen` webhook + Graph API.
 *
 * Flow (same pattern every CRM uses):
 *   1. Broker authorizes their Facebook Page (OAuth via our app, or pastes a
 *      long-lived Page Access Token).
 *   2. We subscribe the page to our app's `leadgen` webhook:
 *      POST /{page_id}/subscribed_apps?subscribed_fields=leadgen
 *   3. On each lead form submission Meta POSTs to our webhook URL with a
 *      `leadgen_id`; we fetch the actual lead data via
 *      GET /{version}/{leadgen_id}?fields=id,created_time,field_data,page_id,form_id
 *   4. The lead enters the shared ingestion pipeline → AI call within 60s.
 *
 * Requirements on the Meta side:
 *   - A Meta app (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET)
 *   - App-level webhook subscription configured with our callback URL + the
 *     FACEBOOK_VERIFY_TOKEN (Meta dashboard → App → Webhooks → Page)
 *   - Broker token with `leads_retrieval` or `pages_manage_leads` + `pages_show_list`
 *   - App review may be required for production lead access
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type Redis from "ioredis";
import { config } from "../config";
import { normalizePhone } from "../utils/phone";
import { logger } from "../utils/logger";

export interface LeadgenEvent {
  leadgenId: string;
  pageId: string;
  formId?: string;
}

export interface FacebookLead {
  leadgenId: string;
  pageId: string;
  formId?: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  createdTime?: string;
  raw: Record<string, unknown>;
}

const GRAPH_URL = "https://graph.facebook.com";

function graphUrl(version: string, path: string): string {
  return `${GRAPH_URL}/${version}/${path}`;
}

/** HTTP GET helper with timeout + JSON parsing. */
async function graphGet<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const err = (data.error as Record<string, unknown>) || {};
      throw new Error(`Meta Graph API ${res.status}: ${String(err.message || JSON.stringify(data)).slice(0, 300)}`);
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

/** HTTP POST helper with timeout (for subscriptions / OAuth token exchange). */
async function graphPost<T>(url: string, body: Record<string, string>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
      signal: controller.signal,
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const err = (data.error as Record<string, unknown>) || {};
      throw new Error(`Meta Graph API ${res.status}: ${String(err.message || JSON.stringify(data)).slice(0, 300)}`);
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse a leadgen webhook delivery into events.
 * Payload: { object: "page", entry: [{ id, time, changes: [{ field: "leadgen",
 *   value: { leadgen_id, page_id, form_id, created_time } }] }] }
 */
export function parseLeadgenWebhook(body: Record<string, unknown>): LeadgenEvent[] {
  const events: LeadgenEvent[] = [];
  const entries = Array.isArray(body.entry) ? (body.entry as Record<string, unknown>[]) : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? (entry.changes as Record<string, unknown>[]) : [];
    for (const change of changes) {
      if (change.field !== "leadgen") continue;
      const value = (change.value as Record<string, unknown>) || {};
      const leadgenId = String(value.leadgen_id || "");
      const pageId = String(value.page_id || entry.id || "");
      if (leadgenId && pageId) {
        events.push({
          leadgenId,
          pageId,
          formId: value.form_id ? String(value.form_id) : undefined,
        });
      }
    }
  }
  return events;
}

/**
 * Normalize Meta's field_data array into our lead shape.
 * field_data: [{ name: "full_name", values: ["John Doe"] }, ...]
 */
export function normalizeFacebookFieldData(
  fieldData: Array<{ name?: string; values?: string[] }> | null | undefined
): { name?: string; phone?: string; email?: string; city?: string; state?: string } {
  const out: { name?: string; phone?: string; email?: string; city?: string; state?: string } = {};
  if (!Array.isArray(fieldData)) return out;

  const get = (key: string) => {
    const field = fieldData.find((f) => (f.name || "").toLowerCase() === key.toLowerCase());
    return field?.values?.[0] || "";
  };

  const fullName = get("full_name") || get("name");
  const firstName = get("first_name");
  const lastName = get("last_name");

  out.name = fullName || [firstName, lastName].filter(Boolean).join(" ").trim() || undefined;
  const phoneRaw = get("phone_number") || get("mobile_number") || get("whatsapp_number");
  if (phoneRaw) {
    try {
      out.phone = normalizePhone(phoneRaw);
    } catch {
      // invalid / non-Indian phone — leave undefined, lead will be skipped
    }
  }
  out.email = get("email") || undefined;
  out.city = get("city") || undefined;
  out.state = get("state") || undefined;
  return out;
}

/** Fetch the full lead record for a leadgen_id. */
export async function fetchFacebookLead(leadgenId: string, pageToken: string): Promise<FacebookLead | null> {
  const url = graphUrl(
    config.FACEBOOK_GRAPH_VERSION,
    `${leadgenId}?fields=id,created_time,field_data,page_id,form_id&access_token=${encodeURIComponent(pageToken)}`
  );
  const data = await graphGet<Record<string, unknown>>(url);

  const fieldData = (data.field_data as Array<{ name?: string; values?: string[] }>) || [];
  const normalized = normalizeFacebookFieldData(fieldData);

  if (!normalized.phone) {
    logger.warn({ leadgenId: data.id }, "Facebook lead has no usable phone — skipping");
    return null;
  }

  return {
    leadgenId: String(data.id || leadgenId),
    pageId: String(data.page_id || ""),
    formId: data.form_id ? String(data.form_id) : undefined,
    name: normalized.name || "Facebook Lead",
    phone: normalized.phone,
    email: normalized.email,
    city: normalized.city,
    state: normalized.state,
    createdTime: typeof data.created_time === "string" ? data.created_time : undefined,
    raw: { ...data, field_data: fieldData },
  };
}

/** Resolve the page behind a Page Access Token (`/me` returns the page itself). */
export async function getPageFromToken(pageToken: string): Promise<{ id: string; name: string }> {
  const url = graphUrl(
    config.FACEBOOK_GRAPH_VERSION,
    `me?fields=id,name&access_token=${encodeURIComponent(pageToken)}`
  );
  const data = await graphGet<{ id: string; name: string }>(url);
  return { id: String(data.id), name: data.name };
}

/** Subscribe the page to our app's leadgen webhook. */
export async function subscribePageToLeadgen(pageId: string, pageToken: string): Promise<void> {
  const url = graphUrl(
    config.FACEBOOK_GRAPH_VERSION,
    `${pageId}/subscribed_apps`
  );
  await graphPost(url, {
    access_token: pageToken,
    subscribed_fields: "leadgen",
  });
}

/** Create the lead and start the AI calling pipeline (shared guardrails). */
export async function createLeadFromFacebook(
  ctx: { prisma: PrismaClient; redis?: Redis | null },
  params: { clientId: string; lead: FacebookLead }
): Promise<{ status: "created" | "duplicate" | "skipped"; leadId?: string }> {
  const { ingestExternalLead } = await import("./lead-ingestion.service");
  const { clientId, lead } = params;

  return ingestExternalLead(
    ctx,
    {
      clientId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      source: "facebook",
      portalSource: "Facebook Lead Ads",
      dedupQueryId: lead.leadgenId,
      logLabel: "Facebook",
      rawPayload: {
        leadgenId: lead.leadgenId,
        pageId: lead.pageId,
        formId: lead.formId,
        createdTime: lead.createdTime,
        city: lead.city,
        state: lead.state,
        provider: "facebook",
        raw: lead.raw as unknown as Prisma.InputJsonValue,
      },
    }
  );
}