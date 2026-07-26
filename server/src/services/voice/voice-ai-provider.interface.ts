import type {
  DispatchCallParams,
  DispatchCallResult,
  CallLogResult,
  VoiceAgentConfig,
  VoiceAgentInfo,
  VoiceProviderConfig,
  KnowledgeDoc,
} from "./types";

/**
 * VoiceAIProvider — Generic interface for AI voice agent services.
 * 
 * Implementations:
 * - OmnidimensionVoiceProvider — Uses Omnidimension AI agents (default)
 * - Future: Custom Twilio + Deepgram/ElevenLabs/LLM pipeline
 */
export interface VoiceAIProvider {
  /** Provider name (e.g. "omnidimension") */
  readonly name: string;
  readonly displayName: string;

  /** Check if provider credentials are configured */
  isConfigured(): boolean;

  /** Get provider config info */
  getConfig(): VoiceProviderConfig;

  /** Dispatch an outbound AI call to a lead */
  dispatchCall(params: DispatchCallParams): Promise<DispatchCallResult>;

  /** Get call log details (transcript, summary, extracted data) */
  getCallLog(callLogId: string | number): Promise<CallLogResult | null>;

  // ─── Agent Management ────────────────────────────────────

  /** Create a new AI voice agent */
  createAgent(config: VoiceAgentConfig): Promise<VoiceAgentInfo>;

  /** List all AI agents */
  listAgents(): Promise<VoiceAgentInfo[]>;

  /** Get a single agent by ID */
  getAgent(agentId: string | number): Promise<VoiceAgentInfo | null>;

  /** Delete an AI agent */
  deleteAgent(agentId: string | number): Promise<boolean>;

  // ─── Knowledge Base ──────────────────────────────────────

  /** List knowledge base documents */
  listKnowledgeDocs(): Promise<KnowledgeDoc[]>;

  /** Upload a document to the knowledge base */
  uploadKnowledgeDoc(buffer: Buffer, filename: string): Promise<KnowledgeDoc>;

  /** Attach a knowledge doc to an agent */
  attachKnowledgeDoc(docId: number, agentId: number): Promise<boolean>;

  /** Detach a knowledge doc from an agent */
  detachKnowledgeDoc(docId: number): Promise<boolean>;

  /** Delete a knowledge doc */
  deleteKnowledgeDoc(docId: number): Promise<boolean>;
}
