/**
 * Voice AI Provider — Abstraction Layer for AI Voice Agent Services
 * 
 * Supports multiple providers for AI-powered outbound calls.
 * Currently: Omnidimension (default)
 * Future: Twilio + Deepgram/ElevenLabs/LLM (custom)
 */

export interface DispatchCallParams {
  agentId: string | number;
  toNumber: string;
  fromNumber?: string;
  callContext?: Record<string, unknown>;
}

export interface DispatchCallResult {
  success: boolean;
  requestId: string | number;
  status: string;
}

export interface CallLogResult {
  callId: string;
  status: string;
  duration?: number;
  transcript?: string;
  summary?: string;
  recordingUrl?: string;
  extractedData?: Record<string, unknown>;
  sentiment?: string;
}

export interface VoiceAgentConfig {
  name: string;
  welcomeMessage?: string;
  language?: string;
  voiceProvider?: string;
  voiceId?: string;
  modelName?: string;
  systemPrompt?: string;
  webhookUrl?: string;
}

export interface VoiceAgentInfo {
  id: string | number;
  name: string;
  status: string;
  languages?: string[];
}

export interface VoiceProviderConfig {
  name: string;
  configured: boolean;
  providerType: string;
}

export interface KnowledgeDoc {
  id: number;
  name: string;
  status?: string;
  createdAt?: string;
}
