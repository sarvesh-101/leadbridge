import { randomUUID } from "crypto";
import { config } from "../config";
import { logger } from "../utils/logger";

/**
 * Omnidimension Phone Numbers API service.
 * Manage telephony: list, import, attach/detach phone numbers.
 *
 * Docs: https://docs.omnidim.io/docs/api-reference
 */

const OMNIDIM_BASE = config.OMNIDIM_BASE_URL;

const headers = {
  Authorization: `Bearer ${config.OMNIDIM_API_KEY}`,
  "Content-Type": "application/json",
};

export interface PhoneNumber {
  id: number;
  name?: string;
  phone_number: string;
  number_provider: string; // "exotel" | "twilio" | "sip" | "omnidim"
  active_bot_id?: number | null;
  active_bot_name?: string;
  created_at?: string;
}

export interface ListPhoneNumbersParams {
  pageNo?: number;
  pageSize?: number;
}

/**
 * List all phone numbers associated with the account.
 */
export async function listPhoneNumbers(params: ListPhoneNumbersParams = {}): Promise<PhoneNumber[]> {
  const searchParams = new URLSearchParams();
  if (params.pageNo) searchParams.set("pageno", String(params.pageNo));
  if (params.pageSize) searchParams.set("pagesize", String(params.pageSize));

  const url = `${OMNIDIM_BASE}/phone_number/list${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Omnidimension API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as { phone_numbers?: PhoneNumber[] };
    return data.phone_numbers || [];
  } catch (error: any) {
    logger.error({ err: error.message }, "Failed to list Omnidimension phone numbers");
    throw new Error(`Failed to list phone numbers: ${error.message}`);
  }
}

/**
 * Attach a phone number to an agent.
 */
export async function attachPhoneNumber(phoneNumberId: number, agentId: number): Promise<boolean> {
  try {
    const response = await fetch(`${OMNIDIM_BASE}/phone_number/attach`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone_number_id: phoneNumberId,
        agent_id: agentId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Omnidimension API error ${response.status}: ${await response.text()}`);
    }

    logger.info({ phoneNumberId, agentId }, "Phone number attached to agent");
    return true;
  } catch (error: any) {
    logger.error({ phoneNumberId, agentId, err: error.message }, "Failed to attach phone number");
    throw new Error(`Failed to attach phone number: ${error.message}`);
  }
}

/**
 * Detach a phone number from its agent.
 */
export async function detachPhoneNumber(phoneNumberId: number): Promise<boolean> {
  try {
    const response = await fetch(`${OMNIDIM_BASE}/phone_number/detach`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone_number_id: phoneNumberId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Omnidimension API error ${response.status}: ${await response.text()}`);
    }

    logger.info({ phoneNumberId }, "Phone number detached");
    return true;
  } catch (error: any) {
    logger.error({ phoneNumberId, err: error.message }, "Failed to detach phone number");
    throw new Error(`Failed to detach phone number: ${error.message}`);
  }
}

// ─── Number Shop (search → buy) ─────────────────────────────────────────────
// Omnidim's current API is a two-step flow:
//   1. GET  /phone_number/search?region=IN&carrier=…   → available numbers + price
//   2. POST /phone_number/purchase {region, carrier, phone_number} + Idempotency-Key
// Docs: https://docs.omnidim.io/docs/buy-a-number-api

export interface AvailableNumber {
  phone_number: string;
  monthly_rental_usd: number;
  validity_days: number;
  region: string;
  kyc_required: boolean;
}

export interface CarrierOption {
  carrier: string;
  label: string;
  total?: number;
}

export interface SearchNumbersResult {
  success: boolean;
  numbers: AvailableNumber[];
  /** Populated when the API requires a carrier choice (409 carrier_required). */
  carriers: CarrierOption[];
  needsCarrier: boolean;
  carrier?: string;
  carrierLabel?: string;
  total: number;
  page: number;
  totalPages: number;
  message: string;
}

/** Map friendly region names to Omnidim's ISO codes (they stock IN and US). */
export function normalizeOmnidimRegion(region?: string): "IN" | "US" {
  const r = (region || "india").toLowerCase();
  if (r === "us" || r === "usa" || r === "united states") return "US";
  return "IN"; // india / in / anything else → India (our market)
}

/**
 * Search the Omnidim number shop for purchasable numbers in a region.
 * Call without `carrier` first — if the region needs one, the response
 * lists the carriers instead (needsCarrier=true).
 */
export async function searchAvailableNumbers(params: {
  region?: string;
  carrier?: string;
  pattern?: string;
  page?: number;
  limit?: number;
}): Promise<SearchNumbersResult> {
  const region = normalizeOmnidimRegion(params.region);
  const searchParams = new URLSearchParams({ region });
  if (params.carrier) searchParams.set("carrier", params.carrier);
  if (params.pattern) searchParams.set("pattern", params.pattern);
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(Math.min(params.limit, 50)));

  const empty: SearchNumbersResult = {
    success: false,
    numbers: [],
    carriers: [],
    needsCarrier: false,
    total: 0,
    page: 1,
    totalPages: 1,
    message: "Search failed.",
  };

  try {
    const response = await fetch(`${OMNIDIM_BASE}/phone_number/search?${searchParams}`, { headers });

    if (!response.ok) {
      let body: any = null;
      try {
        body = await response.json();
      } catch {
        /* non-JSON error body */
      }

      // 409 carrier_required — the region has multiple carriers; list them.
      if (response.status === 409 && (body?.code === "carrier_required" || !params.carrier)) {
        const rawCarriers: any[] = Array.isArray(body?.carriers) ? body.carriers : [];
        const carriers: CarrierOption[] = rawCarriers.map((c: any) =>
          typeof c === "string"
            ? { carrier: c, label: c }
            : {
                carrier: c.carrier || c.id || c.name || String(c),
                label: c.label || c.carrier_label || c.carrier || c.name || String(c),
                total: typeof c.total === "number" ? c.total : undefined,
              },
        );
        if (carriers.length > 0) {
          return { ...empty, success: true, needsCarrier: true, carriers, message: "Pick a carrier to see its numbers." };
        }
      }

      return { ...empty, message: body?.message || `Number search failed (HTTP ${response.status}).` };
    }

    const data = (await response.json()) as {
      numbers?: AvailableNumber[];
      total?: number;
      page?: number;
      total_pages?: number;
      carrier?: string;
      carrier_label?: string;
    };

    return {
      success: true,
      numbers: data.numbers || [],
      carriers: [],
      needsCarrier: false,
      carrier: data.carrier || params.carrier,
      carrierLabel: data.carrier_label,
      total: data.total ?? (data.numbers?.length || 0),
      page: data.page ?? 1,
      totalPages: data.total_pages ?? 1,
      message: "Numbers loaded.",
    };
  } catch (error: any) {
    logger.error({ err: error.message, params }, "Failed to search Omnidim number shop");
    return { ...empty, message: `Number search failed: ${error.message}` };
  }
}

/**
 * Purchase a specific number from the Omnidim number shop (search → buy flow).
 * Maps every documented refusal to a plain-language message so the dashboard
 * can tell the user exactly what to fix (KYC, wallet, carrier, etc.).
 */
export async function purchasePhoneNumber(params: {
  region?: string;
  carrier: string;
  phoneNumber: string;
}): Promise<{ success: boolean; phoneNumber?: PhoneNumber; message: string; errorCode?: string }> {
  const region = normalizeOmnidimRegion(params.region);
  try {
    const response = await fetch(`${OMNIDIM_BASE}/phone_number/purchase`, {
      method: "POST",
      headers: {
        ...headers,
        // Fresh key per purchase — retrying the SAME key replays the original
        // order instead of double-buying (docs: Idempotency-Key).
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify({
        region,
        carrier: params.carrier,
        phone_number: params.phoneNumber,
      }),
    });

    if (!response.ok) {
      let body: any = null;
      try {
        body = await response.json();
      } catch {
        /* non-JSON error body */
      }
      const code: string = body?.code || body?.error || `http_${response.status}`;

      const messages: Record<string, string> = {
        carrier_required:
          "Omnidim needs a carrier choice — reload the number list and pick one.",
        unknown_carrier:
          "That carrier no longer exists for this region — reload the carrier list and pick another.",
        kyc_incomplete:
          "One-time verification is pending. Complete the Aadhaar eKYC in the Omnidim dashboard (app.omnidim.io → Numbers Shop), then buy here again — it takes a few minutes.",
        insufficient_balance:
          "Your Omnidim wallet is low. Top it up at app.omnidim.io → Billing (the monthly rental, ~$5.06 for +91, is charged from the wallet), then buy here again.",
        number_unavailable:
          "Someone claimed that number first — pick another one from the list.",
        in_progress:
          "A purchase for this number is already running — wait a few seconds and try again.",
        feature_disabled:
          "Phone-number purchasing is switched off on this Omnidim account — contact Omnidim support to enable it.",
      };

      logger.warn({ code, status: response.status, region }, "Omnidim number purchase refused");
      return { success: false, errorCode: code, message: messages[code] || body?.message || `Purchase failed (HTTP ${response.status}).` };
    }

    const data = (await response.json()) as PhoneNumber;
    logger.info({ phoneNumber: data.phone_number, region, carrier: params.carrier }, "Phone number purchased from Omnidim");
    return {
      success: true,
      phoneNumber: data,
      message: `Number ${data.phone_number} purchased! It now appears in your Numbers list below.`,
    };
  } catch (error: any) {
    logger.error({ err: error.message, params }, "Failed to purchase phone number");
    return {
      success: false,
      errorCode: "network",
      message: `Could not reach Omnidim to purchase the number: ${error.message}. If your wallet was charged anyway, check app.omnidim.io → Phone Numbers before retrying.`,
    };
  }
}

/**
 * Import an Exotel phone number into Omnidimension.
 */
export async function importExotelNumber(params: {
  phoneNumber: string;
  sid: string;
  apiKey: string;
  apiToken: string;
  subdomain?: string;
}): Promise<PhoneNumber> {
  try {
    const response = await fetch(`${OMNIDIM_BASE}/phone_number/import-exotel`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone_number: params.phoneNumber,
        sid: params.sid,
        api_key: params.apiKey,
        api_token: params.apiToken,
        subdomain: params.subdomain || "api.exotel.com",
      }),
    });

    if (!response.ok) {
      throw new Error(`Omnidimension API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as PhoneNumber;
    logger.info({ phoneNumber: params.phoneNumber }, "Exotel number imported to Omnidimension");
    return data;
  } catch (error: any) {
    logger.error({ err: error.message }, "Failed to import Exotel number");
    throw new Error(`Failed to import Exotel number: ${error.message}`);
  }
}

/**
 * Import a Twilio phone number into Omnidimension.
 */
export async function importTwilioNumber(params: {
  phoneNumber: string;
  sid: string;
  authToken: string;
}): Promise<PhoneNumber> {
  try {
    const response = await fetch(`${OMNIDIM_BASE}/phone_number/import-twilio`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone_number: params.phoneNumber,
        sid: params.sid,
        auth_token: params.authToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Omnidimension API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as PhoneNumber;
    logger.info({ phoneNumber: params.phoneNumber }, "Twilio number imported to Omnidimension");
    return data;
  } catch (error: any) {
    logger.error({ err: error.message }, "Failed to import Twilio number");
    throw new Error(`Failed to import Twilio number: ${error.message}`);
  }
}
