import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getVoiceAIProvider, VoiceAIProvider } from "../../services/voice";
import { getPhoneProvider, PhoneProvider } from "../../services/phone";

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
        webhookUrl: `${request.protocol}://${request.hostname}/api/v1/webhooks/call-events`,
      });
    } catch (err: any) {
      request.log.warn({ err: err.message }, "Voice AI provider unavailable — using simulated agent");
      agent = {
        id: Math.floor(Math.random() * 900000) + 100000,
        name: request.body.name,
        status: "simulated",
        languages: [request.body.language || "hi-IN"],
      };
      isLocal = true;
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

    try {
      const voiceAI = getVoiceAIProvider();
      const result = await voiceAI.dispatchCall({
        agentId: client.omniAgentId,
        toNumber: client.phone,
        fromNumber: client.omniPhoneNumberId ? String(client.omniPhoneNumberId) : undefined,
        callContext: {
          lead_id: "test-call",
          client_id: client.id,
          lead_name: client.ownerName,
          lead_source: "test",
          business_name: client.businessName,
          owner_name: client.ownerName,
          attempt: "1",
          call_type: "QUALIFICATION",
        },
      });

      return {
        message: "Test call initiated — your phone should ring shortly",
        requestId: result.requestId,
        status: result.status,
      };
    } catch (err: any) {
      request.log.warn({ err: err.message }, "Voice AI unavailable — test call simulated");
      return {
        message: "Test call simulated (voice AI not available in dev mode)",
        requestId: Math.floor(Math.random() * 100000),
        status: "simulated",
      };
    }
  });

  // ─── Webhook Configuration URL ─────────────────────────────────

  /** Get the webhook URL clients should configure */
  fastify.get("/voice/webhook-url", async (request: FastifyRequest) => {
    const url = `${request.protocol}://${request.hostname}/api/v1/webhooks/call-events`;
    return { webhookUrl: url };
  });
}
