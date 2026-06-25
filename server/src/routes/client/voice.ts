import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  listAgents, createAgent, getAgent, deleteAgent,
} from "../../services/omnidimension-agents.service";
import {
  listPhoneNumbers, attachPhoneNumber, detachPhoneNumber,
} from "../../services/omnidimension-phone.service";
import {
  listKnowledgeDocs, uploadKnowledgeDoc, attachKnowledgeDoc,
  detachKnowledgeDoc, deleteKnowledgeDoc,
} from "../../services/omnidimension-knowledge.service";
import { dispatchCall } from "../../services/omnidimension.service";


/**
 * Voice AI management routes.
 * These wrap the Omnidimension API — your customers see LeadBridge UI,
 * but the backend orchestrates everything through Omnidimension.
 *
 * POST /api/v1/voice/agents         — Create a new AI agent
 * GET  /api/v1/voice/agents         — List all agents
 * GET  /api/v1/voice/agents/:id     — Get agent details
 * DELETE /api/v1/voice/agents/:id   — Delete an agent
 *
 * GET  /api/v1/voice/phone-numbers  — List phone numbers
 * POST /api/v1/voice/phone-numbers/attach    — Attach number to agent
 * POST /api/v1/voice/phone-numbers/detach    — Detach number from agent
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

  /** Get the client's stored Omnidimension agent ID */
  fastify.get("/voice/agent-id", async (request: FastifyRequest) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      select: { omnidimensionAgentId: true },
    });
    return { agentId: client?.omnidimensionAgentId || null };
  });

  /** Save the client's Omnidimension agent ID (linked to the agent they created) */
  fastify.patch("/voice/agent-id", async (
    request: FastifyRequest<{ Body: { agentId: number | null } }>, reply: FastifyReply
  ) => {
    const { agentId } = request.body;
    const client = await fastify.prisma.client.update({
      where: { id: request.clientId },
      data: { omnidimensionAgentId: agentId },
    });
    return { agentId: client.omnidimensionAgentId };
  });

  // ─── Agents ────────────────────────────────────────────────────

  /** Create a new AI agent via Omnidimension, with local fallback */
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
    let agent;
    let isLocal = false;

    try {
      agent = await createAgent({
        name: request.body.name,
        welcomeMessage: request.body.welcomeMessage,
        language: request.body.language || "hi-IN",
        voiceProvider: request.body.voiceProvider || "eleven_labs",
        voiceId: request.body.voiceId,
        modelName: request.body.modelName || "gpt-4o-mini",
        systemPrompt: request.body.systemPrompt,
        webhookUrl: `${request.protocol}://${request.hostname}/api/v1/webhooks/omnidimension/call-events`,
      });
    } catch (err: any) {
      // Omnidimension unavailable — create a local/simulated agent
      request.log.warn({ err: err.message }, "Omnidimension API unavailable — using simulated agent");
      agent = {
        id: Math.floor(Math.random() * 900000) + 100000,
        name: request.body.name,
        status: "simulated",
        languages: [request.body.language || "hi-IN"],
      };
      isLocal = true;
    }

    // Store the agent ID on the client's record (use omniAgentId for new-style, omnidimensionAgentId for legacy)
    await fastify.prisma.client.update({
      where: { id: request.clientId },
      data: {
        omnidimensionAgentId: agent.id,
        omniAgentId: String(agent.id),
      },
    });

    return reply.status(201).send({ agent, isAssigned: true, isLocal });
  });

  /** List all agents for the account */
  fastify.get("/voice/agents", async () => {
    const agents = await listAgents();
    return { agents };
  });

  /** Get a single agent by ID */
  fastify.get("/voice/agents/:id", async (
    request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply
  ) => {
    const agentId = parseInt(request.params.id);
    if (isNaN(agentId)) return reply.status(400).send({ error: "Invalid agent ID" });

    const agent = await getAgent(agentId);
    if (!agent) return reply.status(404).send({ error: "Agent not found" });
    return { agent };
  });

  /** Delete an agent */
  fastify.delete("/voice/agents/:id", async (
    request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply
  ) => {
    const agentId = parseInt(request.params.id);
    if (isNaN(agentId)) return reply.status(400).send({ error: "Invalid agent ID" });

    const deleted = await deleteAgent(agentId);
    if (!deleted) return reply.status(404).send({ error: "Agent not found or already deleted" });

    // Unassign from client if it was theirs
    await fastify.prisma.client.update({
      where: { id: request.clientId, omnidimensionAgentId: agentId },
      data: { omnidimensionAgentId: null },
    });

    return { message: "Agent deleted" };
  });

  // ─── Phone Numbers ─────────────────────────────────────────────

  /** List phone numbers available on the account */
  fastify.get("/voice/phone-numbers", async () => {
    const numbers = await listPhoneNumbers();
    return { numbers };
  });

  /** Attach a phone number to an agent */
  fastify.post("/voice/phone-numbers/attach", async (
    request: FastifyRequest<{ Body: { phoneNumberId: number; agentId: number } }>, reply: FastifyReply
  ) => {
    await attachPhoneNumber(request.body.phoneNumberId, request.body.agentId);
    return { message: "Phone number attached to agent" };
  });

  /** Detach a phone number from its agent */
  fastify.post("/voice/phone-numbers/detach", async (
    request: FastifyRequest<{ Body: { phoneNumberId: number } }>
  ) => {
    await detachPhoneNumber(request.body.phoneNumberId);
    return { message: "Phone number detached" };
  });

  // ─── Knowledge Base ────────────────────────────────────────────

  /** List knowledge base documents */
  fastify.get("/voice/knowledge", async () => {
    const documents = await listKnowledgeDocs();
    return { documents };
  });

  /** Upload a PDF document to the knowledge base */
  fastify.post("/voice/knowledge/upload", async (
    request: FastifyRequest, reply: FastifyReply
  ) => {
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const fileBuffer = await file.toBuffer();
    const doc = await uploadKnowledgeDoc(fileBuffer, file.filename);

    return reply.status(201).send({ document: doc });
  });

  /** Attach a knowledge base document to an agent */
  fastify.post("/voice/knowledge/attach", async (
    request: FastifyRequest<{ Body: { documentId: number; agentId: number } }>
  ) => {
    await attachKnowledgeDoc(request.body.documentId, request.body.agentId);
    return { message: "Document attached to agent" };
  });

  /** Detach a knowledge base document from its agent */
  fastify.post("/voice/knowledge/detach", async (
    request: FastifyRequest<{ Body: { documentId: number } }>
  ) => {
    await detachKnowledgeDoc(request.body.documentId);
    return { message: "Document detached" };
  });

  /** Delete a knowledge base document */
  fastify.delete("/voice/knowledge/:id", async (
    request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply
  ) => {
    const docId = parseInt(request.params.id);
    if (isNaN(docId)) return reply.status(400).send({ error: "Invalid document ID" });

    const deleted = await deleteKnowledgeDoc(docId);
    if (!deleted) return reply.status(404).send({ error: "Document not found" });

    return { message: "Document deleted" };
  });

  // ─── Test Call ───────────────────────────────────────────────────

  /** Initiate a test call to the broker's own phone to verify the setup */
  fastify.post("/voice/test-call", async (request: FastifyRequest, reply: FastifyReply) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      select: {
        id: true,
        omniAgentId: true,
        omnidimensionAgentId: true,
        omniPhoneNumberId: true,
        ownerName: true,
        businessName: true,
        phone: true,
      },
    });

    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }

    // Check both old and new agent ID fields
    const agentIdStr = client.omniAgentId || (client.omnidimensionAgentId ? String(client.omnidimensionAgentId) : null);
    if (!agentIdStr) {
      return reply.status(400).send({ error: "No AI agent configured. Create an agent first." });
    }

    const agentId = parseInt(agentIdStr);
    if (isNaN(agentId)) {
      return reply.status(400).send({ error: "Invalid agent ID configured" });
    }

    try {
      const result = await dispatchCall({
        agentId,
        toNumber: client.phone,
        fromNumberId: client.omniPhoneNumberId || undefined,
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
      // In development/fallback mode, return a simulated response
      request.log.warn({ err: err.message }, "Omnidimension unavailable — test call simulated");
      return {
        message: "Test call simulated (Omnidimension not available in dev mode)",
        requestId: Math.floor(Math.random() * 100000),
        status: "simulated",
      };
    }
  });

  // ─── Webhook Configuration URL ─────────────────────────────────

  /** Get the webhook URL clients should configure in Omnidimension dashboard */
  fastify.get("/voice/webhook-url", async (request: FastifyRequest) => {
    const url = `${request.protocol}://${request.hostname}/api/v1/webhooks/omnidimension/call-events`;
    return { webhookUrl: url };
  });
}
