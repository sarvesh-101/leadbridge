import { config } from "../config";
import { logger } from "../utils/logger";

/**
 * Omnidimension service — dispatches AI-powered outbound calls
 * and retrieves call logs via the Omnidimension REST API.
 *
 * Docs: https://docs.omnidim.io/docs/api-reference/calls/dispatchCall
 */

const OMNIDIM_BASE = config.OMNIDIM_BASE_URL;

interface DispatchCallParams {
  agentId: number;
  toNumber: string;
  fromNumberId?: number;
  callContext?: Record<string, unknown>;
}

interface DispatchCallResponse {
  success: boolean;
  status: string;
  requestId: number;
  custom_variables_count: number;
}

interface CallLogResponse {
  call_id: string;
  call_sid: string;
  bot_id: number;
  bot_name: string;
  call_direction: string;
  start_time: string;
  end_time: string;
  call_duration: number;
  call_status: string;
  call_report?: {
    summary: string;
    sentiment: string;
    full_conversation: string;
    interactions: Array<{
      user_query: string;
      bot_response: string;
      timestamp: string;
    }>;
    extracted_variables: Record<string, unknown>;
  };
}

/**
 * Dispatch an outbound call via Omnidimension.
 * Returns the requestId (call_log_id) for tracking.
 */
export async function dispatchCall(params: DispatchCallParams): Promise<{
  success: boolean;
  requestId: number;
  status: string;
}> {
  const url = `${OMNIDIM_BASE}/calls/dispatch`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.OMNIDIM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: params.agentId,
        to_number: params.toNumber,
        from_number_id: params.fromNumberId,
        call_context: params.callContext,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Omnidimension API error ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as DispatchCallResponse;

    logger.info(
      { requestId: data.requestId, status: data.status, to: params.toNumber },
      "Omnidimension call dispatched"
    );

    return {
      success: data.success,
      requestId: data.requestId,
      status: data.status,
    };
  } catch (error: any) {
    logger.error(
      { err: error.message, to: params.toNumber, agentId: params.agentId },
      "Omnidimension dispatch failed"
    );
    throw new Error(`Omnidimension call failed: ${error.message}`);
  }
}

/**
 * Get call log details (transcript, summary, extracted data) from Omnidimension.
 */
export async function getCallLog(callLogId: number): Promise<CallLogResponse | null> {
  const url = `${OMNIDIM_BASE}/calls/logs/${callLogId}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.OMNIDIM_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        logger.warn({ callLogId }, "Omnidimension call log not found");
        return null;
      }
      const errorBody = await response.text();
      throw new Error(`Omnidimension API error ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as CallLogResponse;
    return data;
  } catch (error: any) {
    logger.error({ callLogId, err: error.message }, "Failed to fetch Omnidimension call log");
    return null;
  }
}

export type { DispatchCallParams, CallLogResponse };
