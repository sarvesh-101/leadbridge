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
    request: FastifyRequest<{ Body: { agentId: string | number | null } }>, reply: FastifyReply
  ) => {
    // FIX (500 on Assign): omniAgentId is a String column — the dashboard sends
    // the numeric agent id, so it must be coerced or Prisma throws a
    // validation error and the route 500s.
    if (!request.clientId) {
      return reply.status(400).send({ error: "Client account required — agent assignment is per client." });
    }
    const raw = request.body?.agentId;
    const agentId = raw == null || raw === "" ? null : String(raw);
    // Both columns describe the same Omnidim agent and both are @unique. The
    // dashboard lists every agent on the shared Omnidim account, so a second
    // broker assigning an agent that is already taken used to make Prisma
    // throw P2002 → 500 "Internal Server Error". Answer with a clear 409.
    if (agentId) {
      const holder = await fastify.prisma.client.findFirst({
        where: { omniAgentId: agentId, NOT: { id: request.clientId } },
        select: { businessName: true, ownerName: true },
      });
      if (holder) {
        return reply.status(409).send({
          error: `That agent is already assigned to ${holder.businessName || holder.ownerName || "another broker"}. Create your own agent instead.`,
        });
      }
    }
    // Keep the Int mirror in sync — stale values there made the number-choose
    // flow attach numbers to the agent the broker had previously.
    const agentIdInt = agentId && /^\d+$/.test(agentId) ? Number(agentId) : null;
    try {
      const client = await fastify.prisma.client.update({
        where: { id: request.clientId },
        data: { omniAgentId: agentId, omnidimensionAgentId: agentIdInt },
      });
      return { agentId: client.omniAgentId };
    } catch (err: any) {
      if (err?.code === "P2002") {
        return reply.status(409).send({
          error: "That agent is already assigned to another broker — create your own agent instead.",
        });
      }
      throw err;
    }
  });

  // ─── Agents ──────────────────────────────────────────────────

  /** Create a new AI agent using the configured provider */
  fastify.post("/voice/agents", async (
    request: FastifyRequest<{ Body: {
      name: string;
      welcomeMessage?: string;
      language?: string;
      /** Omnidim display names — full multilingual list (see /voice/languages) */
      languages?: string[];
      /** E.164 — enables live call transfer to the broker/human when the prospect asks */
      transferToNumber?: string;
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

    // ── Multilingual + transfer resolution ─────────────────────────
    const { toOmnidimLanguageNames, DEFAULT_AGENT_LANGUAGES } = await import("../../services/voice/supported-languages");

    const transferToNumber = request.body.transferToNumber?.trim() || undefined;
    if (transferToNumber && !/^\+[1-9]\d{7,14}$/.test(transferToNumber)) {
      return reply.status(400).send({
        error: "Invalid transferToNumber — must be E.164 format (e.g. +919876543210)",
      });
    }

    const languages =
      request.body.languages?.length
        ? toOmnidimLanguageNames(request.body.languages)
        : toOmnidimLanguageNames([request.body.language]) || DEFAULT_AGENT_LANGUAGES;

    const voiceAI = getVoiceAIProvider();
    let agent;
    let isLocal = false;

    try {
      agent = await voiceAI.createAgent({
        name: request.body.name,
        welcomeMessage: request.body.welcomeMessage,
        language: request.body.language || "hi-IN",
        languages,
        transferToNumber,
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
        ...(transferToNumber ? { transferToNumber } : {}),
        ...(languages.length ? { languages: { set: languages } } : {}),
      },
    });

    return reply.status(201).send({ agent, isAssigned: true, isLocal });
  });

  /** Languages the AI agents can speak (Omnidim: 100+ Indian + international) */
  fastify.get("/voice/languages", async () => {
    const { AGENT_LANGUAGE_OPTIONS } = await import("../../services/voice/supported-languages");
    return { languages: AGENT_LANGUAGE_OPTIONS };
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

  /** List phone numbers using the configured phone provider.
   *  Adds per-number assignment state from the DB so the dashboard can run the
   *  "choose from already-purchased numbers" flow:
   *    - assigned          — some client holds this number (one client per number)
   *    - assignedToMe      — the CALLING client holds it
   *    - assignedClientName — admin-only detail of who holds it
   */
  fastify.get("/voice/phone-numbers", async (request: FastifyRequest) => {
    const phoneProvider = getPhoneProvider();
    const result = await phoneProvider.listNumbers();
    let numbers: any[] = (result.numbers || []).map((n) => ({
      id: Number(n.id),
      phone_number: n.phoneNumber,
      number_provider: n.provider,
      name: (n as any).name,
    }));

    // Merge Omnidim bot-attachment info (thin-client UI expects active_bot_*).
    if (phoneProvider.name === "omnidimension" && numbers.length) {
      const { listPhoneNumbers } = await import("../../services/omnidimension-phone.service");
      const raw = await listPhoneNumbers().catch(() => []);
      numbers = numbers.map((n) => {
        const r = raw.find((x: any) => x.id === n.id);
        return r ? { ...n, name: r.name ?? n.name, active_bot_id: r.active_bot_id ?? null, active_bot_name: r.active_bot_name } : n;
      });
    }

    // Merge client ownership: omniPhoneNumberId is the single source of truth
    // for "which broker has which platform number".
    const holders = await fastify.prisma.client.findMany({
      where: { omniPhoneNumberId: { not: null } },
      select: { id: true, businessName: true, ownerName: true, omniPhoneNumberId: true },
    });
    const holderByNumber = new Map<number, (typeof holders)[number]>();
    for (const h of holders) holderByNumber.set(h.omniPhoneNumberId as number, h);

    numbers = numbers.map((n) => {
      const holder = holderByNumber.get(n.id);
      return {
        ...n,
        assigned: !!holder,
        assignedToMe: request.role === "client" && holder?.id === request.clientId,
        ...(request.role === "admin" && holder
          ? { assignedClientName: holder.businessName || holder.ownerName || "Client" }
          : {}),
      };
    });

    return { numbers, total: numbers.length };
  });

  /**
   * Client "chooses" one of the PLATFORM's already-purchased numbers.
   * Instant assignment (no admin approval): one client per number, enforced
   * transactionally + last-writer-wins sweep as belt-and-braces. If the client
   * has an active Omnidim agent, the number is attached to it right away so it
   * goes live for calling without admin action.
   */
  fastify.post("/voice/phone-numbers/choose", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.clientId) {
      return reply.status(403).send({ error: "Sign in as a broker client to choose a number — admins assign via the admin panel." });
    }
    const body = request.body as { phoneNumberId: number | string };
    const numberId = parseInt(String(body.phoneNumberId), 10);
    if (!Number.isFinite(numberId)) {
      return reply.status(400).send({ error: "phoneNumberId is required" });
    }

    const phoneProvider = getPhoneProvider();
    const all = await phoneProvider.listNumbers();
    const target = (all.numbers || []).find((n) => String(n.id) === String(numberId));
    if (!target) {
      return reply.status(404).send({ error: "Phone number not found in the platform inventory" });
    }
    const phoneNumber = target.phoneNumber;

    let clash = false;
    await fastify.prisma.$transaction(async (tx) => {
      const taken = await tx.client.count({
        where: { omniPhoneNumberId: numberId, NOT: { id: request.clientId! } },
      });
      if (taken > 0) { clash = true; return; }
      await tx.client.update({
        where: { id: request.clientId! },
        data: { omniPhoneNumberId: numberId, omniPhoneNumber: phoneNumber },
      });
      // Belt-and-braces: never leave two clients on the same number — the
      // chooser wins (last-writer-wins), others get released to the pool.
      await tx.client.updateMany({
        where: { id: { not: request.clientId! }, omniPhoneNumberId: numberId },
        data: { omniPhoneNumberId: null, omniPhoneNumber: null },
      });
    });
    if (clash) {
      return reply.status(409).send({ error: "This number is already assigned to another broker — pick another one." });
    }

    // Attach to the client's active agent (best-effort — assignment still stands).
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      select: { omnidimensionAgentId: true, omniAgentId: true },
    });
    // omniAgentId (String) is what the dashboard writes; the Int mirror can be
    // stale on older rows, so prefer the String id when it is numeric.
    const attachAgentId = client?.omniAgentId && /^\d+$/.test(client.omniAgentId)
      ? Number(client.omniAgentId)
      : client?.omnidimensionAgentId ?? null;
    let agentAttached = false;
    let attachError: string | undefined;
    if (attachAgentId) {
      try {
        const { attachPhoneNumber } = await import("../../services/omnidimension-phone.service");
        await attachPhoneNumber(numberId, attachAgentId);
        agentAttached = true;
      } catch (err: any) {
        attachError = err.message;
      }
    }

    request.log.info({ clientId: request.clientId, numberId }, "Phone number chosen by client");
    return reply.status(201).send({
      success: true,
      phoneNumberId: numberId,
      phoneNumber,
      agentAttached,
      ...(attachError ? { attachError } : {}),
      message: agentAttached
        ? `${phoneNumber} is now yours and attached to your agent.`
        : `${phoneNumber} is now yours.` + (attachError ? ` Could not auto-attach to agent: ${attachError}` : ''),
    });
  });

  /** Attach a platform number to an agent (admin — mutates shared Omnidim inventory) */
  fastify.post("/voice/phone-numbers/attach", {
    preHandler: [fastify.authenticateAdmin],
  }, async (request: FastifyRequest) => {
    const body = request.body as { phoneNumberId: number | string; agentId: number | string };
    const { attachPhoneNumber } = await import("../../services/omnidimension-phone.service");
    await attachPhoneNumber(parseInt(String(body.phoneNumberId), 10), parseInt(String(body.agentId), 10));
    return { success: true, message: "Phone number attached to agent" };
  });

  /** Detach a platform number from its agent (admin — mutates shared Omnidim inventory) */
  fastify.post("/voice/phone-numbers/detach", {
    preHandler: [fastify.authenticateAdmin],
  }, async (request: FastifyRequest) => {
    const body = request.body as { phoneNumberId: number | string };
    const { detachPhoneNumber } = await import("../../services/omnidimension-phone.service");
    await detachPhoneNumber(parseInt(String(body.phoneNumberId), 10));
    return { success: true, message: "Phone number detached" };
  });

  /**
   * Search the Omnidim number shop (search → buy flow).
   * GET /voice/phone-numbers/search?region=india[&carrier=carrier-1][&pattern=…]
   * Without `carrier`, the response may instead list the region's carriers
   * (needsCarrier=true) — the UI shows them as chips first.
   */
  fastify.get("/voice/phone-numbers/search", async (
    request: FastifyRequest<{ Querystring: {
      region?: string; carrier?: string; pattern?: string; page?: string; limit?: string;
    } }>
  ) => {
    const { searchAvailableNumbers } = await import("../../services/omnidimension-phone.service");
    return searchAvailableNumbers({
      region: request.query.region,
      carrier: request.query.carrier,
      pattern: request.query.pattern,
      page: request.query.page ? parseInt(request.query.page, 10) : undefined,
      limit: request.query.limit ? parseInt(request.query.limit, 10) : undefined,
    });
  });

  /**
   * Purchase a specific number from the shop (provider-agnostic).
   * Omnidim requires {carrier, phoneNumber} from a prior /search call;
   * optionally auto-attaches the number to one of the client's agents.
   */
  /**
   * SECURITY: every number action below that spends or mutates the PLATFORM's
   * Omnidim account (purchase = real money from the shared wallet; release/import
   * = mutate shared inventory) is ADMIN-ONLY. Broker clients authenticate too,
   * but must never be able to spend or release platform resources — they get a
   * number by plan entitlement/request, never self-serve.
   */
  fastify.post("/voice/phone-numbers/purchase", {
    preHandler: [fastify.authenticateAdmin],
  }, async (request: FastifyRequest) => {
    // Websocket plugin overloads force an untyped request here — cast the body.
    const body = request.body as {
      region?: string; carrier?: string; phoneNumber?: string; areaCode?: string; attachToAgentId?: number | string | null;
    };
    const phoneProvider = getPhoneProvider();
    const result = await phoneProvider.purchaseNumber({
      region: body.region,
      areaCode: body.areaCode,
      carrier: body.carrier,
      phoneNumber: body.phoneNumber,
    });

    // Optional: attach the freshly bought number to an agent right away.
    if (result.success && result.phoneNumber && body.attachToAgentId) {
      const agentId = parseInt(String(body.attachToAgentId), 10);
      if (Number.isFinite(agentId)) {
        try {
          const { attachPhoneNumber } = await import("../../services/omnidimension-phone.service");
          await attachPhoneNumber(parseInt(result.phoneNumber.id, 10), agentId);
          return { ...result, attachedAgentId: agentId, message: `${result.message} Attached to your agent.` };
        } catch (err: any) {
          // Purchase succeeded — never fail the request over attach; the user
          // can attach manually from the Numbers list.
          return { ...result, attachError: err.message };
        }
      }
    }

    return result;
  });

  /** Release a phone number */
  fastify.post("/voice/phone-numbers/release", {
    preHandler: [fastify.authenticateAdmin],
  }, async (request: FastifyRequest) => {
    const body = request.body as { phoneNumberId: string };
    const phoneProvider = getPhoneProvider();
    await phoneProvider.releaseNumber(body.phoneNumberId);
    return { message: "Phone number released" };
  });

  /** Import an existing Exotel number into Omnidimension */
  fastify.post("/voice/phone-numbers/import/exotel", {
    preHandler: [fastify.authenticateAdmin],
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Websocket plugin overloads force an untyped request here — cast the body.
    const body = request.body as {
      phoneNumber: string;
      sid: string;
      apiKey: string;
      apiToken: string;
      subdomain?: string;
    };
    const { importExotelNumber } = await import("../../services/omnidimension-phone.service");
    try {
      const number = await importExotelNumber({
        phoneNumber: body.phoneNumber,
        sid: body.sid,
        apiKey: body.apiKey,
        apiToken: body.apiToken,
        subdomain: body.subdomain,
      });
      return { success: true, number, message: `Exotel number ${number.phone_number} imported` };
    } catch (err: any) {
      return reply.status(502).send({ error: "Import failed", message: err.message });
    }
  });

  /** Import an existing Twilio number into Omnidimension */
  fastify.post("/voice/phone-numbers/import/twilio", {
    preHandler: [fastify.authenticateAdmin],
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      phoneNumber: string;
      sid: string;
      authToken: string;
    };
    const { importTwilioNumber } = await import("../../services/omnidimension-phone.service");
    try {
      const number = await importTwilioNumber({
        phoneNumber: body.phoneNumber,
        sid: body.sid,
        authToken: body.authToken,
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
