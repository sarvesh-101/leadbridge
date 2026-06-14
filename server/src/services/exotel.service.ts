import axios from "axios";
import { config } from "../config";
import { logger } from "../utils/logger";

/**
 * Exotel service — initiates outbound calls to Indian phone numbers.
 * Uses Exotel REST API to place AI-powered outbound calls.
 */

const exotelApi = axios.create({
  baseURL: `https://${config.EXOTEL_SUBDOMAIN}/${config.EXOTEL_SID}`,
  auth: {
    username: config.EXOTEL_API_KEY || "",
    password: config.EXOTEL_API_TOKEN || "",
  },
  timeout: 15000,
});

export interface InitiateCallParams {
  from: string;       // Exotel virtual number
  to: string;         // Customer phone (E.164)
  callType: "QUALIFICATION" | "BOOKING_REMINDER" | "FOLLOWUP_D1" | "FOLLOWUP_D3";
  clientId: string;
  leadId: string;
  attempt: number;
}

export interface ExotelCallResponse {
  callSid: string;
  status: string;
}

export async function initiateOutboundCall(params: InitiateCallParams): Promise<ExotelCallResponse> {
  try {
    const callbackBase = `${config.FRONTEND_URL}/api/v1/webhooks/exotel/call-events`;
    const response = await exotelApi.post("/Calls/connect", {
      From: params.from,
      To: params.to,
      CallerId: params.from,
      CallType: "trans",
      Url: `${config.PIPECAT_SERVICE_URL}/connect?leadId=${params.leadId}&clientId=${params.clientId}&callType=${params.callType}`,
      StatusCallback: callbackBase,
      StatusCallBackEvents: "initiated,ringing,answered,completed",
    });

    logger.info(
      { exotelCallSid: response.data.Call?.Sid, to: params.to, callType: params.callType },
      "Exotel call initiated"
    );

    return {
      callSid: response.data.Call?.Sid || "",
      status: response.data.Call?.Status || "queued",
    };
  } catch (error: any) {
    logger.error(
      { err: error.message, to: params.to, callType: params.callType },
      "Exotel call initiation failed"
    );
    throw new Error(`Exotel call failed: ${error.response?.data?.message || error.message}`);
  }
}

export async function getCallDetails(exotelCallSid: string) {
  try {
    const response = await exotelApi.get(`/Calls/${exotelCallSid}`);
    return response.data.Call;
  } catch (error: any) {
    logger.error({ exotelCallSid, err: error.message }, "Failed to fetch Exotel call details");
    return null;
  }
}
