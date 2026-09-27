import { config } from "../config";
import { logger } from "../utils/logger";

/**
 * Omnidimension Agents API service.
 * Manage AI voice agents: create, list, update, delete.
 *
 * Docs: https://docs.omnidim.io/docs/api-reference
 */

const OMNIDIM_BASE = config.OMNIDIM_BASE_URL;

const headers = {
  Authorization: `Bearer ${config.OMNIDIM_API_KEY}`,
  "Content-Type": "application/json",
};

export interface OmnidimAgent {
  id: number;
  name: string;
  status?: string;
  // Additional fields returned by GET /agents
  welcome_message?: string;
  voice?: Record<string, unknown>;
  model?: Record<string, unknown>;
  transcriber?: Record<string, unknown>;
  languages?: string[];
  createdAt?: string;
}

export interface CreateAgentParams {
  name: string;
  welcomeMessage?: string;
  language?: string;
  /** Full agent language list (Omnidim dashboard display names). Overrides `language` when set. */
  languages?: string[];
  /** E.164 number — live call transfer when the prospect asks for a human (Omnidim `transfer` config). */
  transferToNumber?: string;
  voiceProvider?: string;
  voiceId?: string;
  modelProvider?: string;
  modelName?: string;
  temperature?: number;
  systemPrompt?: string;
  webhookUrl?: string;
}

/**
 * List all agents for the authenticated account.
 */
export async function listAgents(): Promise<OmnidimAgent[]> {
  try {
    const response = await fetch(`${OMNIDIM_BASE}/agents`, { headers });

    if (!response.ok) {
      throw new Error(`Omnidimension API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as { agents?: OmnidimAgent[]; bots?: OmnidimAgent[] };
    // Omnidimension API returns { bots: [...] } not { agents: [...] }
    return data.bots || data.agents || [];
  } catch (error: any) {
    logger.error({ err: error.message }, "Failed to list Omnidimension agents");
    throw new Error(`Failed to list agents: ${error.message}`);
  }
}

/**
 * Create a new AI voice agent.
 * Returns the created agent with its ID.
 */
export async function createAgent(params: CreateAgentParams): Promise<OmnidimAgent> {
  const body: Record<string, unknown> = {
    name: params.name,
  };

  if (params.welcomeMessage) body.welcome_message = params.welcomeMessage;
  // Omnidim `languages`: display-name strings exactly as in their dashboard picker;
  // unrecognized names are silently skipped by their API.
  if (params.languages?.length) {
    body.languages = params.languages;
  } else if (params.language) {
    body.languages = [params.language, "English"];
  }

  // Conditional live call transfer — fires when transfer_condition matches.
  // Omnidim transfer schema: { enabled, transfer_options: [{ number (E.164, required),
  // type: "static"|"dynamic", backup_numbers?, transfer_condition (required), transfer_message (required) }] }
  if (params.transferToNumber) {
    body.transfer = {
      enabled: true,
      transfer_options: [
        {
          number: params.transferToNumber,
          type: "static",
          transfer_condition:
            "Transfer whenever the caller explicitly asks to speak with a human agent, the broker, or the owner, or says they do not want to talk to an AI. Also transfer when the caller is a highly interested hot lead who qualifies (clear budget, timeline, and property requirement) and asks for immediate human assistance.",
          transfer_message:
            "Sure, I am connecting you to our team member right away. Please stay on the line while I transfer this call.",
        },
      ],
    };
  }

  // Voice configuration — default to Rachel (ElevenLabs) if no voiceId provided
  body.voice = {
    provider: params.voiceProvider || "eleven_labs",
    voice_id: params.voiceId || config.DEFAULT_ELEVENLABS_VOICE_ID,
    speech_speed: 1.0,
  };

  // LLM configuration
  body.model = {
    provider: params.modelProvider || "openai",
    model: params.modelName || "gpt-4o-mini",
    temperature: params.temperature ?? 0.7,
  };

  // System prompt / context — Omnidimension requires this field
  body.context_breakdown = [
    {
      title: "Instructions",
      body: params.systemPrompt || "You are a friendly real estate AI assistant. Help prospects with their property inquiries, qualify their needs (budget, location, timeline), and schedule site visits.",
    },
  ];

  // Post-call webhook
  if (params.webhookUrl) {
    body.post_call_actions = {
      webhook: {
        url: params.webhookUrl,
      },
    };
  }

  try {
    const response = await fetch(`${OMNIDIM_BASE}/agents/create`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Omnidimension API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as OmnidimAgent;
    logger.info({ agentId: data.id, name: data.name }, "Omnidimension agent created");
    return data;
  } catch (error: any) {
    logger.error({ err: error.message, name: params.name }, "Failed to create Omnidimension agent");
    throw new Error(`Failed to create agent: ${error.message}`);
  }
}

/**
 * Get a single agent by ID.
 */
export async function getAgent(agentId: number): Promise<OmnidimAgent | null> {
  try {
    const response = await fetch(`${OMNIDIM_BASE}/agents/${agentId}`, { headers });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Omnidimension API error ${response.status}: ${await response.text()}`);

    return await response.json() as OmnidimAgent;
  } catch (error: any) {
    logger.error({ agentId, err: error.message }, "Failed to get Omnidimension agent");
    return null;
  }
}

/**
 * Delete an agent by ID.
 */
export async function deleteAgent(agentId: number): Promise<boolean> {
  try {
    const response = await fetch(`${OMNIDIM_BASE}/agents/${agentId}`, {
      method: "DELETE",
      headers,
    });

    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`Omnidimension API error ${response.status}: ${await response.text()}`);

    logger.info({ agentId }, "Omnidimension agent deleted");
    return true;
  } catch (error: any) {
    logger.error({ agentId, err: error.message }, "Failed to delete Omnidimension agent");
    return false;
  }
}
