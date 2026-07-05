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

/**
 * Purchase a new phone number from a supported provider.
 * If Omnidimension's purchase API is not available, returns guidance
 * on how to buy a number externally and import it.
 */
export async function purchasePhoneNumber(params: {
  region?: string;
  areaCode?: string;
  provider?: string;
}): Promise<{ success: boolean; phoneNumber?: PhoneNumber; message: string }> {
  try {
    const provider = params.provider || "omnidim";
    const response = await fetch(`${OMNIDIM_BASE}/phone_number/purchase`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        provider,
        region: params.region || "india",
        area_code: params.areaCode,
      }),
    });

    if (!response.ok) {
      const guidance =
        response.status === 404 || response.status === 501
          ? "Direct purchase not available via API. Please buy a number at app.omnidim.io, then import it using the 'Import Existing Number' option below."
          : `API error (${response.status}). Please buy a number at app.omnidim.io.`;
      return { success: false, message: guidance };
    }

    const data = (await response.json()) as PhoneNumber;
    logger.info({ phoneNumber: data.phone_number, provider }, "Phone number purchased");
    return { success: true, phoneNumber: data, message: "Number purchased!" };
  } catch (error: any) {
    logger.error({ err: error.message, params }, "Failed to purchase phone number");
    return {
      success: false,
      message:
        "Number purchase requires the Omnidimension dashboard. Go to app.omnidim.io → Phone Numbers → Buy Number, then come back and refresh this page.",
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
