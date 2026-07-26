/**
 * DemoVoiceAIProvider — Simulates AI voice agent operations for investor demos.
 *
 * This provider replaces the real Omnidimension provider when DEMO_MODE=true.
 * Every operation returns realistic fake data so the full system (leads, calls,
 * bookings, notifications) works end-to-end without any external API keys.
 *
 * Key behaviors:
 *   - createAgent()   → returns a random agent ID with "simulated" status
 *   - dispatchCall()  → simulates a 1-2s "ringing" delay, returns fake requestId
 *   - getCallLog()    → returns realistic call transcripts with Hinglish content
 *   - All knowledge-base ops return success with no-ops
 */

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

// ─── Fake data pools for realistic transcripts ───────────────────

const HINGLISH_GREETINGS = [
  "Namaste! Main LeadBridge AI assistant bol raha hoon. Aapne abhi property enquiry ki thi, sahi hai?",
  "Namaste ji! LeadBridge se baat kar rahe hain. Aapne online property dekhi thi na?",
  "Hello! Main LeadBridge ki taraf se call kar raha hoon. Aapki enquiry ke baare mein baat karni thi.",
];

const HINGLISH_RESPONSES: Record<string, string[]> = {
  INTERESTED: [
    "Haan ji, main 2BHK flat dhundh raha hoon Andheri West mein.",
    "Maine ek property dekhi thi aapki website par, uske baare mein jaankari chahiye.",
    "Haan, main 3BHK mein interested hoon. Budget 1.5 crore tak hai.",
    "Ji haan, main property dekhne aana chahta hoon. Kab aa sakta hoon?",
  ],
  NOT_INTERESTED: [
    "Nahi, abhi zaroorat nahi hai. Baad mein contact karna.",
    "Maine already kahi aur booking kar li hai.",
    "Abhi budget clear nahi hai, main soch ke batata hoon.",
  ],
  NO_ANSWER: [
    // Empty — no one picked up
  ],
  CALL_FAILED: [
    // Number not reachable
  ],
};

const FARE_WELL = "Dhanyavaad! Aapko visit ki details WhatsApp par bhej dete hain. Koi aur sawaal ho toh poochh sakte hain.";

const AGENT_NAMES = [
  "Priya - LeadBridge AI",
  "Rahul - LeadBridge AI",
  "Neha - LeadBridge AI",
  "Vikram - LeadBridge AI",
];

let agentCounter = 100000;

/**
 * Generate a realistic fake call log with Hinglish transcript.
 */
function generateCallLog(requestId: number, outcome: "QUALIFIED" | "NOT_INTERESTED" | "NO_ANSWER" | "CALL_FAILED"): CallLogResult {
  const startTime = new Date(Date.now() - Math.random() * 3600000).toISOString();
  const duration = outcome === "QUALIFIED"
    ? Math.floor(Math.random() * 150) + 60   // 1-3.5 min
    : outcome === "NOT_INTERESTED"
      ? Math.floor(Math.random() * 40) + 20    // 20-60 sec
      : 0;

  let transcript = "";
  let summary = "";
  let sentiment = "neutral";
  const extractedData: Record<string, unknown> = {};

  if (outcome === "QUALIFIED") {
    const greeting = HINGLISH_GREETINGS[Math.floor(Math.random() * HINGLISH_GREETINGS.length)];
    const response = HINGLISH_RESPONSES.INTERESTED[Math.floor(Math.random() * HINGLISH_RESPONSES.INTERESTED.length)];

    transcript = [
      `[${startTime}] AI: ${greeting}`,
      `[${new Date(new Date(startTime).getTime() + 2000).toISOString()}] Lead: ${response}`,
      `[${new Date(new Date(startTime).getTime() + 15000).toISOString()}] AI: Bahut accha! Aapka budget kya hai?`,
      `[${new Date(new Date(startTime).getTime() + 25000).toISOString()}] Lead: Budget 1-2 crore mein kuch accha option hai toh dekh sakta hoon.`,
      `[${new Date(new Date(startTime).getTime() + 40000).toISOString()}] AI: Perfect! Aap kal 11AM ko site visit karna chahenge?`,
      `[${new Date(new Date(startTime).getTime() + 50000).toISOString()}] Lead: Haan, kal 11AM thik hai.`,
      `[${new Date(new Date(startTime).getTime() + 60000).toISOString()}] AI: ${FARE_WELL}`,
    ].join("\n");

    summary = "Lead qualified for 2BHK in Andheri West, budget 1-2Cr. Agreed to visit tomorrow 11AM.";
    sentiment = "positive";
    extractedData.budget = "1Cr-2Cr";
    extractedData.location = "Andheri West";
    extractedData.timeline = "immediate";
    extractedData.propertyType = "flat";
    extractedData.bedrooms = "2BHK";
    extractedData.sentiment = "positive";
  } else if (outcome === "NOT_INTERESTED") {
    const greeting = HINGLISH_GREETINGS[Math.floor(Math.random() * HINGLISH_GREETINGS.length)];
    const response = HINGLISH_RESPONSES.NOT_INTERESTED[Math.floor(Math.random() * HINGLISH_RESPONSES.NOT_INTERESTED.length)];

    transcript = [
      `[${startTime}] AI: ${greeting}`,
      `[${new Date(new Date(startTime).getTime() + 3000).toISOString()}] Lead: ${response}`,
      `[${new Date(new Date(startTime).getTime() + 12000).toISOString()}] AI: Koi baat nahi! Agar future mein zaroorat ho toh humein contact kar sakte hain.`,
    ].join("\n");

    summary = "Lead not interested at this time. Marked for cold follow-up.";
    sentiment = "neutral";
    extractedData.interest = "low";
    extractedData.followup = "recommended";
  } else {
    transcript = `[${startTime}] Call ${outcome === "NO_ANSWER" ? "not answered" : "failed — number not reachable"}`;
    summary = `Lead ${outcome === "NO_ANSWER" ? "did not answer" : "could not be reached"}. Will retry.`;
    sentiment = "neutral";
  }

  return {
    callId: `demo-call-${requestId}`,
    status: outcome === "QUALIFIED" ? "completed" : outcome === "NO_ANSWER" ? "no-answer" : "failed",
    duration,
    transcript,
    summary,
    recordingUrl: null as unknown as string | undefined,
    extractedData,
    sentiment,
  };
}

/**
 * DemoVoiceAIProvider — fully simulated, no external dependencies.
 */
export class DemoVoiceAIProvider implements VoiceAIProvider {
  readonly name = "demo";
  readonly displayName = "Demo Simulator";

  private agents: VoiceAgentInfo[] = [];
  private knowledgeDocs: KnowledgeDoc[] = [];
  private callLogs: Map<number, CallLogResult> = new Map();
  private callCounter = 0;

  isConfigured(): boolean {
    return true; // Always configured in demo mode
  }

  getConfig(): VoiceProviderConfig {
    return {
      name: "Demo Simulator",
      configured: true,
      providerType: "demo",
    };
  }

  // ─── Call Operations ───────────────────────────────────────

  async dispatchCall(params: DispatchCallParams): Promise<DispatchCallResult> {
    this.callCounter++;
    const requestId = Math.floor(Math.random() * 900000) + 100000;

    logger.info(
      { requestId, to: params.toNumber, agentId: params.agentId },
      "📞 [DEMO] Simulated call dispatched — lead will be called"
    );

    // Simulate a realistic ~1-2s ringing delay
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

    // Store a fake call log that getCallLog can return
    const outcomes: Array<"QUALIFIED" | "NOT_INTERESTED" | "NO_ANSWER" | "CALL_FAILED"> = [
      "QUALIFIED", "QUALIFIED", "QUALIFIED", "NOT_INTERESTED", "NO_ANSWER",
    ];
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    this.callLogs.set(requestId, generateCallLog(requestId, outcome));

    return {
      success: true,
      requestId,
      status: "queued",
    };
  }

  async getCallLog(callLogId: string | number): Promise<CallLogResult | null> {
    const id = typeof callLogId === "string" ? parseInt(callLogId) : callLogId;
    return this.callLogs.get(id) || generateCallLog(id, "QUALIFIED");
  }

  // ─── Agent Management ──────────────────────────────────────

  async createAgent(config: VoiceAgentConfig): Promise<VoiceAgentInfo> {
    const agentId = ++agentCounter;
    const agent: VoiceAgentInfo = {
      id: agentId,
      name: config.name || AGENT_NAMES[agentCounter % AGENT_NAMES.length],
      status: "simulated",
      languages: [config.language || "hi-IN"],
    };
    this.agents.push(agent);

    logger.info({ agentId: agent.id, name: agent.name }, "🤖 [DEMO] AI agent created");

    return agent;
  }

  async listAgents(): Promise<VoiceAgentInfo[]> {
    if (this.agents.length === 0) {
      // Return a default agent so the UI always shows one configured
      return [{
        id: 100001,
        name: "Priya - Demo Agent",
        status: "simulated",
        languages: ["hi-IN", "en"],
      }];
    }
    return this.agents;
  }

  async getAgent(agentId: string | number): Promise<VoiceAgentInfo | null> {
    const id = typeof agentId === "string" ? parseInt(agentId) : agentId;
    return this.agents.find((a) => a.id === id) || {
      id,
      name: "Demo Agent",
      status: "simulated",
      languages: ["hi-IN", "en"],
    };
  }

  async deleteAgent(agentId: string | number): Promise<boolean> {
    const id = typeof agentId === "string" ? parseInt(agentId) : agentId;
    const index = this.agents.findIndex((a) => a.id === id);
    if (index !== -1) {
      this.agents.splice(index, 1);
    }
    return true;
  }

  // ─── Knowledge Base ────────────────────────────────────────

  async listKnowledgeDocs(): Promise<KnowledgeDoc[]> {
    if (this.knowledgeDocs.length === 0) {
      return [
        { id: 1, name: "Property Catalog 2026.pdf", status: "attached", createdAt: new Date().toISOString() },
        { id: 2, name: "Pricing Guide.pdf", status: "attached", createdAt: new Date().toISOString() },
      ];
    }
    return this.knowledgeDocs;
  }

  async uploadKnowledgeDoc(buffer: Buffer, filename: string): Promise<KnowledgeDoc> {
    const doc: KnowledgeDoc = {
      id: Math.floor(Math.random() * 90000) + 10000,
      name: filename,
      status: "attached",
      createdAt: new Date().toISOString(),
    };
    this.knowledgeDocs.push(doc);
    return doc;
  }

  async attachKnowledgeDoc(docId: number, agentId: number): Promise<boolean> {
    return true;
  }

  async detachKnowledgeDoc(docId: number): Promise<boolean> {
    return true;
  }

  async deleteKnowledgeDoc(docId: number): Promise<boolean> {
    const index = this.knowledgeDocs.findIndex((d) => d.id === docId);
    if (index !== -1) this.knowledgeDocs.splice(index, 1);
    return true;
  }
}
