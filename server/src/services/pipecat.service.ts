import axios from "axios";
import { config } from "../config";
import { logger } from "../utils/logger";

/**
 * Pipecat service — communicates with the Python Pipecat agent microservice.
 */

interface StartSessionParams {
  leadId: string;
  clientId: string;
  callType: "QUALIFICATION" | "BOOKING_REMINDER" | "FOLLOWUP_D1" | "FOLLOWUP_D3";
  exotelCallSid: string;
  toNumber: string;
  fromNumber: string;
  clientConfig: {
    businessName: string;
    ownerName: string;
    language: string;
    callScript: Record<string, unknown> | null;
    agentId: string | null;
  };
  leadInfo: {
    name: string;
    phone: string;
  };
}

const pipecatApi = axios.create({
  baseURL: config.PIPECAT_SERVICE_URL,
  headers: {
    Authorization: `Bearer ${config.PIPECAT_SECRET}`,
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

/**
 * Notify Pipecat service to start a call session.
 * Pipecat will connect to Exotel's call stream and run the AI pipeline.
 */
export async function startCallSession(params: StartSessionParams): Promise<{ sessionId: string }> {
  try {
    const response = await pipecatApi.post("/session/start", params);
    logger.info({ leadId: params.leadId, sessionId: response.data.sessionId }, "Pipecat session started");
    return { sessionId: response.data.sessionId };
  } catch (error: any) {
    logger.error(
      { err: error.message, leadId: params.leadId },
      "Pipecat session start failed"
    );
    throw new Error(`Pipecat session failed: ${error.response?.data?.error || error.message}`);
  }
}

/**
 * End an active Pipecat session.
 */
export async function endCallSession(sessionId: string): Promise<void> {
  try {
    await pipecatApi.post(`/session/${sessionId}/end`);
    logger.info({ sessionId }, "Pipecat session ended");
  } catch (error: any) {
    logger.error({ sessionId, err: error.message }, "Failed to end Pipecat session");
  }
}

/**
 * Get session status from Pipecat.
 */
export async function getSessionStatus(sessionId: string): Promise<{ status: string; transcript?: string }> {
  try {
    const response = await pipecatApi.get(`/session/${sessionId}`);
    return response.data;
  } catch {
    return { status: "unknown" };
  }
}
