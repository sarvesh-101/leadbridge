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

    const data = await response.json() as { agents?: OmnidimAgent[] };
    return data.agents || [];
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
  if (params.language) body.languages = [params.language, "English"];

  // Voice configuration
  body.voice = {
    provider: params.voiceProvider || "eleven_labs",
    voice_id: params.voiceId || "",
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
