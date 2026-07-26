/**
 * Omnidimension Voice AI Provider
 * 
 * Wraps the existing Omnidimension services (agent, phone, knowledge, call dispatch)
 * to implement the VoiceAIProvider interface.
 */

import { config } from "../../config";
import { logger } from "../../utils/logger";
import { VoiceAIProvider } from "./voice-ai-provider.interface";
import type {
  DispatchCallParams,
  DispatchCallResult,
  CallLogResult,
  VoiceAgentConfig,
  VoiceAgentInfo,
  VoiceProviderConfig,
  KnowledgeDoc,
} from "./types";

// Import existing Omnidimension services
import {
  listAgents as omniListAgents,
  createAgent as omniCreateAgent,
  getAgent as omniGetAgent,
  deleteAgent as omniDeleteAgent,
} from "../omnidimension-agents.service";

import {
  dispatchCall as omniDispatchCall,
  getCallLog as omniGetCallLog,
  getOmnidimensionCircuitState,
} from "../omnidimension.service";

import {
  listKnowledgeDocs as omniListDocs,
  uploadKnowledgeDoc as omniUploadDoc,
  attachKnowledgeDoc as omniAttachDoc,
  detachKnowledgeDoc as omniDetachDoc,
  deleteKnowledgeDoc as omniDeleteDoc,
} from "../omnidimension-knowledge.service";

export class OmnidimensionVoiceProvider implements VoiceAIProvider {
  readonly name = "omnidimension";
  readonly displayName = "AI Voice";

  isConfigured(): boolean {
    return !!(config.OMNIDIM_API_KEY);
  }

  getConfig(): VoiceProviderConfig {
    return {
      name: "omnidimension",
      configured: this.isConfigured(),
      providerType: "Omnidimension AI Agent Platform",
    };
  }

  // ─── Call Dispatch ────────────────────────────────────────────

  async dispatchCall(params: DispatchCallParams): Promise<DispatchCallResult> {
    try {
      const result = await omniDispatchCall({
        agentId: Number(params.agentId),
        toNumber: params.toNumber,
        fromNumberId: params.fromNumber ? Number(params.fromNumber) : undefined,
        callContext: params.callContext,
      });

      return {
        success: result.success,
        requestId: result.requestId,
        status: result.status,
      };
    } catch (error: any) {
      logger.error({ err: error.message }, "Voice AI: dispatch call failed");
      return { success: false, requestId: -1, status: "failed" };
    }
  }

  async getCallLog(callLogId: string | number): Promise<CallLogResult | null> {
    const log = await omniGetCallLog(Number(callLogId));
    if (!log) return null;

    return {
      callId: log.call_id,
      status: log.call_status,
      duration: log.call_duration,
      transcript: log.call_report?.full_conversation,
      summary: log.call_report?.summary,
      extractedData: log.call_report?.extracted_variables as Record<string, unknown> | undefined,
      sentiment: log.call_report?.sentiment,
    };
  }

  // ─── Agent Management ─────────────────────────────────────────

  async createAgent(cfg: VoiceAgentConfig): Promise<VoiceAgentInfo> {
    const agent = await omniCreateAgent({
      name: cfg.name,
      welcomeMessage: cfg.welcomeMessage,
      language: cfg.language || "hi-IN",
      voiceProvider: cfg.voiceProvider || "eleven_labs",
      voiceId: cfg.voiceId,
      modelName: cfg.modelName || "gpt-4o-mini",
      systemPrompt: cfg.systemPrompt,
      webhookUrl: cfg.webhookUrl,
    });

    return {
      id: agent.id,
      name: agent.name,
      status: agent.status || "active",
      languages: agent.languages,
    };
  }

  async listAgents(): Promise<VoiceAgentInfo[]> {
    const agents = await omniListAgents();
    return agents.map((a: any) => ({
      id: a.id,
      name: a.name,
      status: a.status || "active",
      languages: a.languages,
    }));
  }

  async getAgent(agentId: string | number): Promise<VoiceAgentInfo | null> {
    const agent = await omniGetAgent(Number(agentId));
    if (!agent) return null;
    return {
      id: agent.id,
      name: agent.name,
      status: agent.status || "active",
      languages: agent.languages,
    };
  }

  async deleteAgent(agentId: string | number): Promise<boolean> {
    return omniDeleteAgent(Number(agentId));
  }

  // ─── Knowledge Base ───────────────────────────────────────────

  async listKnowledgeDocs(): Promise<KnowledgeDoc[]> {
    const docs = await omniListDocs();
    return docs.map((d: any) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      createdAt: d.created_at,
    }));
  }

  async uploadKnowledgeDoc(buffer: Buffer, filename: string): Promise<KnowledgeDoc> {
    return omniUploadDoc(buffer, filename) as Promise<KnowledgeDoc>;
  }

  async attachKnowledgeDoc(docId: number, agentId: number): Promise<boolean> {
    return omniAttachDoc(docId, agentId);
  }

  async detachKnowledgeDoc(docId: number): Promise<boolean> {
    return omniDetachDoc(docId);
  }

  async deleteKnowledgeDoc(docId: number): Promise<boolean> {
    return omniDeleteDoc(docId);
  }
}
