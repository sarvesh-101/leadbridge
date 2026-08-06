import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { LeadStatus } from "@prisma/client";
import { getVoiceAIProvider, VoiceAIProvider } from "../../services/voice";
import { getPhoneProvider, PhoneProvider } from "../../services/phone";
import { config } from "../../config";

/**
 * Build the public Omnidimension call-events webhook URL.
 * Uses config.WEBHOOK_URL (e.g. the ngrok URL) when set — that is the ONLY
 * reliable way to get a stable public URL. Falls back to the incoming request's
 * protocol/hostname (works on localhost, unreliable behind a proxy).
 *
 * The path MUST match the registered route:
 *   server/src/routes/webhooks/omnidimension.ts → POST /webhooks/omnidimension/call-events
 * registered with prefix /api/v1 in index.ts.
 */
function buildCallEventsWebhookUrl(request: FastifyRequest): string {
  const base = (config.WEBHOOK_URL || `${request.protocol}://${request.hostname}`).replace(/\/+$/, "");
  return `${base}/api/v1/webhooks/omnidimension/call-events`;
}

/**
 * Voice AI management routes (provider-agnostic).
 * Uses the configured VoiceAIProvider and PhoneProvider.
 *
 * POST /api/v1/voice/agents         — Create a new AI agent
 * GET  /api/v1/voice/agents         — List all agents
 * GET  /api/v1/voice/agents/:id     — Get agent details
 * DELETE /api/v1/voice/agents/:id   — Delete an agent
 *
 * GET  /api/v1/voice/phone-numbers  — List phone numbers
 * POST /api/v1/voice/phone-numbers/purchase — Purchase a new number
 * POST /api/v1/voice/phone-numbers/release  — Release a number
 *
 * POST /api/v1/voice/knowledge/upload        — Upload PDF
 * GET  /api/v1/voice/knowledge     — List KB documents
 * POST /api/v1/voice/knowledge/attach        — Attach doc to agent
 * POST /api/v1/voice/knowledge/detach        — Detach doc from agent
 * DELETE /api/v1/voice/knowledge/:id        — Delete doc
 *
 * PATCH /api/v1/voice/agent-id      — Save/update the client's agent ID
 * GET  /api/v1/voice/agent-id       — Get the client's agent ID
 */
export default async function clientVoiceRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── Agent ID ──────────────────────────────────────────────────

  /** Get the client's stored agent ID */
  fastify.get("/voice/agent-id", async (request: FastifyRequest) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      select: { omniAgentId: true },
    });
    return { agentId: client?.omniAgentId || null };
  });

  /** Save the client's agent ID */
  fastify.patch("/voice/agent-id", async (
    request: FastifyRequest<{ Body: { agentId: string | null } }>, reply: FastifyReply
  ) => {
    const { agentId } = request.body;
    const client = await fastify.prisma.client.update({
      where: { id: request.clientId },
      data: { omniAgentId: agentId },
    });
    return { agentId: client.omniAgentId };
  });

  // ─── Agents ────────────────────────────────────────────────────

  /** Create a new AI agent using the configured provider */
  fastify.post("/voice/agents", async (
    request: FastifyRequest<{ Body: {
      name: string;
      welcomeMessage?: string;
      language?: string;
      voiceProvider?: string;
      voiceId?: string;
      modelName?: string;
      systemPrompt?: string;
    } }>, reply: FastifyReply
  ) => {
    // Plan gate — AI voice agent creation requires GROWTH+
    const { canAccessFeature, featureGateError } = await import("../../utils/plan-gates");
    const { allowed, plan, requiredPlan } = await canAccessFeature(fastify.prisma, request.clientId!, "voice");
    if (!allowed) {
      return reply.status(403).send(featureGateError("AI voice agent creation", plan, requiredPlan));
    }

    const voiceAI = getVoiceAIProvider();
    let agent;
    let isLocal = false;

    try {
      agent = await voiceAI.createAgent({
        name: request.body.name,
        welcomeMessage: request.body.welcomeMessage,
        language: request.body.language || "hi-IN",
        voiceProvider: request.body.voiceProvider || "eleven_labs",
        voiceId: request.body.voiceId,
        modelName: request.body.modelName || "gpt-4o-mini",
        systemPrompt: request.body.systemPrompt,
        webhookUrl: buildCallEventsWebhookUrl(request),
      });
    } catch (err: any) {
      if (config.DEMO_MODE) {
        // Only simulate when DEMO_MODE is explicitly enabled
        request.log.warn({ err: err.message }, "Voice AI provider unavailable — using simulated agent (DEMO_MODE)");
        agent = {
          id: Math.floor(Math.random() * 900000) + 100000,
          name: request.body.name,
          status: "simulated",
          languages: [request.body.language || "hi-IN"],
        };
        isLocal = true;
      } else {
        // Fail loudly — never create a fake agent in production
        return reply.status(502).send({
          error: "Voice AI provider unavailable",
          message: err.message,
        });
      }
    }

    // Store the agent ID on the client's record
    await fastify.prisma.client.update({
      where: { id: request.clientId },
      data: {
        omniAgentId: String(agent.id),
        omnidimensionAgentId: Number(agent.id),
      },
    });

    return reply.status(201).send({ agent, isAssigned: true, isLocal });
  });

  /** List all agents */
  fastify.get("/voice/agents", async () => {
    const voiceAI = getVoiceAIProvider();
    const agents = await voiceAI.listAgents();
    return { agents };
  });

  /** Get a single agent by ID */
  fastify.get("/voice/agents/:id", async (
    request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply
  ) => {
    const id = request.params.id;
    const voiceAI = getVoiceAIProvider();
    const agent = await voiceAI.getAgent(id);
    if (!agent) return reply.status(404).send({ error: "Agent not found" });
    return { agent };
  });

  /** Delete an agent */
  fastify.delete("/voice/agents/:id", async (
    request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply
  ) => {
    const id = request.params.id;
    const voiceAI = getVoiceAIProvider();

    const deleted = await voiceAI.deleteAgent(id);
    if (!deleted) return reply.status(404).send({ error: "Agent not found or already deleted" });

    await fastify.prisma.client.update({
      where: { id: request.clientId, omniAgentId: id },
      data: { omniAgentId: null, omnidimensionAgentId: null },
    });

    return { message: "Agent deleted" };
  });

  // ─── Phone Numbers ─────────────────────────────────────────────

  /** List phone numbers using the configured phone provider */
  fastify.get("/voice/phone-numbers", async () => {
    const phoneProvider = getPhoneProvider();
    const result = await phoneProvider.listNumbers();
    return result;
  });

  /** Purchase a new phone number using the configured provider */
  fastify.post("/voice/phone-numbers/purchase", async (
    request: FastifyRequest<{ Body: { region?: string; areaCode?: string } }>, reply: FastifyReply
  ) => {
    const phoneProvider = getPhoneProvider();
    const result = await phoneProvider.purchaseNumber({
      region: request.body.region,
      areaCode: request.body.areaCode,
    });
    return result;
  });

  /** Release a phone number */
  fastify.post("/voice/phone-numbers/release", async (
    request: FastifyRequest<{ Body: { phoneNumberId: string } }>
  ) => {
    const phoneProvider = getPhoneProvider();
    await phoneProvider.releaseNumber(request.body.phoneNumberId);
    return { message: "Phone number released" };
  });

  /** Import an existing Exotel number into Omnidimension */
  fastify.post("/voice/phone-numbers/import/exotel", {
    schema: {
      body: {
        type: "object",
        required: ["phoneNumber", "sid", "apiKey", "apiToken"],
        properties: {
          phoneNumber: { type: "string" },
          sid: { type: "string" },
          apiKey: { type: "string" },
          apiToken: { type: "string" },
          subdomain: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: {
    phoneNumber: string;
    sid: string;
    apiKey: string;
    apiToken: string;
    subdomain?: string;
  } }>, reply: FastifyReply) => {
    const { importExotelNumber } = await import("../../services/omnidimension-phone.service");
    try {
      const number = await importExotelNumber({
        phoneNumber: request.body.phoneNumber,
        sid: request.body.sid,
        apiKey: request.body.apiKey,
        apiToken: request.body.apiToken,
        subdomain: request.body.subdomain,
      });
      return { success: true, number, message: `Exotel number ${number.phone_number} imported` };
    } catch (err: any) {
      return reply.status(502).send({ error: "Import failed", message: err.message });
    }
  });

  /** Import an existing Twilio number into Omnidimension */
  fastify.post("/voice/phone-numbers/import/twilio", {
    schema: {
      body: {
        type: "object",
        required: ["phoneNumber", "sid", "authToken"],
        properties: {
          phoneNumber: { type: "string" },
          sid: { type: "string" },
          authToken: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: {
    phoneNumber: string;
    sid: string;
    authToken: string;
  } }>, reply: FastifyReply) => {
    const { importTwilioNumber } = await import("../../services/omnidimension-phone.service");
    try {
      const number = await importTwilioNumber({
        phoneNumber: request.body.phoneNumber,
        sid: request.body.sid,
        authToken: request.body.authToken,
      });
      return { success: true, number, message: `Twilio number ${number.phone_number} imported` };
    } catch (err: any) {
      return reply.status(502).send({ error: "Import failed", message: err.message });
    }
  });

  // ─── Knowledge Base ────────────────────────────────────────────

  /** List knowledge base documents */
  fastify.get("/voice/knowledge", async () => {
    const voiceAI = getVoiceAIProvider();
    const documents = await voiceAI.listKnowledgeDocs();
    return { documents };
  });

  /** Upload a document to the knowledge base */
  fastify.post("/voice/knowledge/upload", async (
    request: FastifyRequest, reply: FastifyReply
  ) => {
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const voiceAI = getVoiceAIProvider();
    const fileBuffer = await file.toBuffer();
    const doc = await voiceAI.uploadKnowledgeDoc(fileBuffer, file.filename);

    return reply.status(201).send({ document: doc });
  });

  /** Attach a knowledge document to an agent */
  fastify.post("/voice/knowledge/attach", async (
    request: FastifyRequest<{ Body: { documentId: number; agentId: number } }>
  ) => {
    const voiceAI = getVoiceAIProvider();
    await voiceAI.attachKnowledgeDoc(request.body.documentId, request.body.agentId);
    return { message: "Document attached to agent" };
  });

  /** Detach a knowledge document from an agent */
  fastify.post("/voice/knowledge/detach", async (
    request: FastifyRequest<{ Body: { documentId: number } }>
  ) => {
    const voiceAI = getVoiceAIProvider();
    await voiceAI.detachKnowledgeDoc(request.body.documentId);
    return { message: "Document detached" };
  });

  /** Delete a knowledge document */
  fastify.delete("/voice/knowledge/:id", async (
    request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply
  ) => {
    const docId = parseInt(request.params.id);
    if (isNaN(docId)) return reply.status(400).send({ error: "Invalid document ID" });

    const voiceAI = getVoiceAIProvider();
    const deleted = await voiceAI.deleteKnowledgeDoc(docId);
    if (!deleted) return reply.status(404).send({ error: "Document not found" });

    return { message: "Document deleted" };
  });

  // ─── Test Call ───────────────────────────────────────────────────

  /** Initiate a test call to verify the setup */
  fastify.post("/voice/test-call", async (request: FastifyRequest, reply: FastifyReply) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      select: {
        id: true,
        omniAgentId: true,
        omniPhoneNumberId: true,
        ownerName: true,
        businessName: true,
        phone: true,
      },
    });

    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }

    if (!client.omniAgentId) {
      return reply.status(400).send({ error: "No AI agent configured. Create an agent first." });
    }

    let callRecord: { id: string } | null = null;
    try {
      // FIX: Create a Lead + Call record BEFORE dispatching so the completed-call
      // webhook can find this call by omnidimensionCallId and record its cost
      // (recordCallCost in the webhook handler). Without these records the webhook
      // retries forever and cost tracking never fires — same pattern as call.worker.ts.
      // NOTE: this is a deliberate test artifact — it does NOT consume the monthly
      // leads cap (plan.leads) so testing the voice setup never eats real allowance.
      const testLead = await fastify.prisma.lead.create({
        data: {
          clientId: client.id,
          name: `Test Call — ${client.ownerName}`,
          phone: client.phone,
          source: "test",
          rawPayload: {},
          status: "CALLING" as LeadStatus,
        },
      });

      const created = await fastify.prisma.call.create({
        data: {
          clientId: client.id,
          leadId: testLead.id,
          type: "QUALIFICATION",
          direction: "outbound",
          status: "INITIATED",
        },
      });
      callRecord = { id: created.id };

      const voiceAI = getVoiceAIProvider();
      const result = await voiceAI.dispatchCall({
        agentId: client.omniAgentId,
        toNumber: client.phone,
        fromNumber: client.omniPhoneNumberId ? String(client.omniPhoneNumberId) : undefined,
        callContext: {
          lead_id: testLead.id,
          client_id: client.id,
          lead_name: client.ownerName,
          lead_source: "test",
          business_name: client.businessName,
          owner_name: client.ownerName,
          attempt: "1",
          call_type: "QUALIFICATION",
        },
      });

      // Store the Omni request ID so the completed webhook matches this call
      await fastify.prisma.call.update({
        where: { id: callRecord.id },
        data: { omnidimensionCallId: String(result.requestId) },
      });

      return {
        message: "Test call initiated — your phone should ring shortly",
        callId: callRecord.id,
        requestId: result.requestId,
        status: result.status,
      };
    } catch (err: any) {
      // Mark the call FAILED so no dangling INITIATED record confuses the webhook
      if (typeof callRecord?.id === "string") {
        await fastify.prisma.call.update({
          where: { id: callRecord.id },
          data: { status: "FAILED", transcript: `Test call failed: ${err.message}` },
        }).catch(() => {});
      }
      if (config.DEMO_MODE) {
        request.log.warn({ err: err.message }, "Voice AI unavailable — test call simulated (DEMO_MODE)");
        return {
          message: "Test call simulated (DEMO_MODE)",
          requestId: Math.floor(Math.random() * 100000),
          status: "simulated",
        };
      }
      // Fail loudly in production — a fake "test passed" is worse than a clear error
      return reply.status(502).send({
        error: "Voice AI provider unavailable",
        message: err.message,
      });
    }
  });

  // ─── Webhook Configuration URL ─────────────────────────────────

  /** Get the webhook URL clients should configure */
  fastify.get("/voice/webhook-url", async (request: FastifyRequest) => {
    return { webhookUrl: buildCallEventsWebhookUrl(request) };
  });
}
