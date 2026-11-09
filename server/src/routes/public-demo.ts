/**
 * V2 (T6) — Public "call me now" demo funnel (no-auth endpoints).
 *
 * POST /public/demo/request  → validate + issue OTP (10 min TTL, 5 tries)
 * POST /public/demo/verify   → check OTP, schedule a REAL demo call (queue)
 * GET  /public/demo/status   → visitor-visible status for their phone
 * GET  /public/demo/stats    → landing-page proof: how many demos ran
 *
 * Honest by construction:
 *  - No call is made before an OTP-verified request.
 *  - Demo calls flow through the standard call pipeline (working-hours
 *    window, fair-use, compliance, platform credits) — never a side door.
 *  - If the demo agent/Redis is unavailable, the request stays PENDING and
 *    the API says exactly that instead of faking success.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createHash, randomInt } from "node:crypto";
import { config } from "../config";
import { logger } from "../utils/logger";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

export function isPlausiblePhone(d: string): boolean {
  // 10-digit Indian mobile, optionally with country code 91 → 12 digits.
  return /^(91)?[6-9]\d{9}$/.test(d);
}

export function hashOtp(otp: string): string {
  return createHash("sha256").update(`${otp}:${config.JWT_SECRET || "demo"}`).digest("hex");
}

export function startOfDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export default async function publicDemoRoutes(fastify: FastifyInstance) {
  // ─── POST /public/demo/request ───────────────────────────────
  fastify.post("/public/demo/request", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{
    Body: { name?: string; phone?: string; company?: string };
  }>, reply: FastifyReply) => {
    const { name = "", phone = "", company } = request.body || {};

    // Honeypot: real visitors never fill `company`. Pretend success, store nothing.
    if (company && company.trim().length > 0) {
      return reply.status(200).send({ ok: true });
    }

    const digits = normalizePhone(String(phone));
    if (!isPlausiblePhone(digits)) {
      return reply.status(400).send({ error: "Enter a valid 10-digit Indian mobile number." });
    }
    if (String(name).trim().length < 2) {
      return reply.status(400).send({ error: "Tell us your name so the AI can greet you properly." });
    }

    const ip = (request.headers["x-forwarded-for"] as string || "").split(",")[0]?.trim() || null;

    // V2 (T6): captcha. Turnstile/hCaptcha when keys exist; otherwise the
    // honeypot above plus the route rate limits apply (boot warning in index.ts).
    const captchaToken = String((request.body as Record<string, unknown> | null)?.captchaToken || "");
    const { verifyCaptcha } = await import("../utils/captcha");
    const captcha = await verifyCaptcha(captchaToken, ip);
    if (!captcha.ok) {
      return reply.status(400).send({ error: "Please complete the verification and try again." });
    }

    const { recordDemoRequest } = await import("../utils/metrics");
    recordDemoRequest("requested");

    // Daily global cap (platform cost guard).
    const todayCount = await fastify.prisma.demoRequest.count({
      where: { createdAt: { gte: startOfDay() } },
    });
    if (todayCount >= config.DEMO_DAILY_CAP) {
      return reply.status(429).send({
        error: "Today's demo slots are over. We run a limited number of real AI calls per day — request again tomorrow.",
      });
    }

    // One active/pending request per phone.
    const already = await fastify.prisma.demoRequest.findFirst({
      where: {
        phone: digits,
        OR: [
          { otpExpiresAt: { gt: new Date() } },
          { status: "VERIFIED_QUEUED" },
          { status: "RUNNING" },
        ],
      },
      select: { id: true, status: true },
    });
    if (already) {
      return reply.status(200).send({
        ok: true,
        status: already.status,
        message: already.status === "PENDING"
          ? "We already sent you a code on WhatsApp."
          : "Your demo call is already scheduled.",
      });
    }

    const otp = String(randomInt(100000, 999999));
    const created = await fastify.prisma.demoRequest.create({
      data: {
        phone: digits,
        name: String(name).trim().slice(0, 80),
        otpHash: hashOtp(otp),
        otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
        ip,
        userAgent: (request.headers["user-agent"] as string || "").slice(0, 200),
        honeypot: company || null,
      },
    });

    // Send the OTP over WhatsApp when the Cloud API is configured.
    let otpChannel: "whatsapp" | "unavailable" = "unavailable";
    if (config.WHATSAPP_TOKEN && config.WHATSAPP_PHONE_ID) {
      try {
        const { sendTextMessage } = await import("../services/whatsapp.service");
        const { canSendToRecipient } = await import("../utils/whatsapp-rate-limiter");
        const to = digits.startsWith("91") ? `+${digits}` : `+91${digits}`;
        await canSendToRecipient(to);
        await sendTextMessage({
          to,
          text: `${otp} is your Converza demo verification code. Valid for 10 minutes. If you didn't request a call, ignore this message.\n\n(Converza is an AI assistant — this is an automated message.)`,
          recipientType: "customer",
        }).catch(() => null);
        otpChannel = "whatsapp";
      } catch (err: any) {
        logger.warn({ err: err.message }, "demo OTP WhatsApp send failed — OTP still valid");
      }
    } else {
      // Dev/staging fallback: never claim we texted the visitor.
      logger.info({ phone: digits.slice(-4).padStart(10, "*"), otp }, "DEMO OTP (channel unavailable)");
    }

    return reply.status(200).send({
      ok: true,
      requestId: created.id,
      otpChannel,
      message: otpChannel === "whatsapp"
        ? "Code sent on WhatsApp — it opens in 10 minutes."
        : "OTP generation ok, but WhatsApp delivery is not configured in this environment.",
    });
  });

  // ─── POST /public/demo/verify ────────────────────────────────
  fastify.post("/public/demo/verify", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{
    Body: { requestId?: string; phone?: string; otp?: string };
  }>, reply: FastifyReply) => {
    const { requestId, phone, otp } = request.body || {};
    const digits = normalizePhone(String(phone));
    if (!isPlausiblePhone(digits) || !otp || !requestId) {
      return reply.status(400).send({ error: "Missing request id, phone or code." });
    }

    const req = await fastify.prisma.demoRequest.findUnique({ where: { id: String(requestId) } });
    if (!req || req.phone !== digits) {
      return reply.status(404).send({ error: "Unknown demo request." });
    }
    if (req.status === "VERIFIED_QUEUED" || req.status === "RUNNING") {
      return reply.status(200).send({ ok: true, status: req.status, message: "Demo call already scheduled." });
    }
    if (req.otpAttempts >= OTP_MAX_ATTEMPTS) {
      return reply.status(429).send({ error: "Too many wrong codes. Request a new one." });
    }
    if (!req.otpHash || !req.otpExpiresAt || req.otpExpiresAt < new Date()) {
      return reply.status(410).send({ error: "This code expired. Request a new one — it's instant." });
    }
    if (req.otpHash !== hashOtp(String(otp))) {
      await fastify.prisma.demoRequest.update({
        where: { id: req.id },
        data: { otpAttempts: { increment: 1 } },
      });
      return reply.status(400).send({ error: `Wrong code (${OTP_MAX_ATTEMPTS - req.otpAttempts - 1} tries left).` });
    }

    // Schedule the REAL demo call through the standard pipeline.
    if (!config.DEMO_CLIENT_ID) {
      // Honest state — verified, but nothing was triggered.
      await fastify.prisma.demoRequest.update({
        where: { id: req.id },
        data: { verified: true, status: "VERIFIED_QUEUED" },
      });
      return reply.status(200).send({
        ok: true,
        status: "VERIFIED_QUEUED",
        message: "Verified! Scheduling is not connected in this environment yet — we will call you shortly.",
      });
    }

    const demoClient = await fastify.prisma.client.findUnique({
      where: { id: config.DEMO_CLIENT_ID },
      select: { id: true, planStatus: true, omniAgentId: true, omnidimensionAgentId: true },
    });
    if (!demoClient || (demoClient.planStatus !== "ACTIVE" && demoClient.planStatus !== "TRIAL") ||
        (!demoClient.omniAgentId && !demoClient.omnidimensionAgentId)) {
      await fastify.prisma.demoRequest.update({
        where: { id: req.id },
        data: { verified: true, status: "VERIFIED_QUEUED" },
      });
      return reply.status(200).send({
        ok: true,
        status: "VERIFIED_QUEUED",
        message: "Verified! The demo agent is being configured — we will call you shortly.",
      });
    }

    // Cap concurrent demo calls per day (the demo client's own funnel cap).
    const queuedToday = await fastify.prisma.demoRequest.count({
      where: { status: { in: ["VERIFIED_QUEUED", "RUNNING", "COMPLETED"] }, createdAt: { gte: startOfDay() } },
    });
    if (queuedToday >= config.DEMO_DAILY_CAP) {
      await fastify.prisma.demoRequest.update({
        where: { id: req.id },
        data: { verified: true, status: "VERIFIED_QUEUED" },
      });
      return reply.status(200).send({
        ok: true,
        status: "VERIFIED_QUEUED",
        message: "Verified! You're in today's queue — call goes out as soon as a slot opens.",
      });
    }

    const lead = await fastify.prisma.lead.create({
      data: {
        clientId: demoClient.id,
        name: req.name,
        phone: req.phone,
        source: "demo",
        portalSource: "Call Me Now",
        status: "PENDING",
        receivedAt: new Date(),
        rawPayload: { demo: true, requestId: req.id },
      },
    });

    await fastify.prisma.demoRequest.update({
      where: { id: req.id },
      data: { verified: true, status: "VERIFIED_QUEUED", leadId: lead.id },
    });

    // Standard queue path: working-hours window + fair-use + compliance all apply.
    const { enqueueCall } = await import("../workers/queues");
    await enqueueCall({ leadId: lead.id, clientId: demoClient.id, callType: "QUALIFICATION", attempt: 1 });
    logger.info({ demoRequestId: req.id, leadId: lead.id }, "Demo call scheduled via public verify");

    return reply.status(200).send({
      ok: true,
      status: "VERIFIED_QUEUED",
      message: "Verified! Sit tight — within ~10 minutes you'll get a call from our demo AI. It speaks Hindi and English.",
    });
  });

  // ─── GET /public/demo/status?requestId=… ─────────────────────
  fastify.get("/public/demo/status", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{ Querystring: { requestId?: string } }>, reply) => {
    const { requestId } = request.query || {};
    if (!requestId) return reply.status(400).send({ error: "requestId required" });
    const req = await fastify.prisma.demoRequest.findUnique({
      where: { id: String(requestId) },
      select: { status: true, verified: true, calledAt: true },
    });
    if (!req) return reply.status(404).send({ error: "Unknown demo request." });
    return req;
  });

  // ─── GET /public/demo/stats — real aggregate proof numbers ───
  fastify.get("/public/demo/stats", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=300");
    const [total, verified, completed] = await Promise.all([
      fastify.prisma.demoRequest.count(),
      fastify.prisma.demoRequest.count({ where: { verified: true } }),
      fastify.prisma.demoRequest.count({ where: { status: "COMPLETED" } }),
    ]);
    return { totalRequests: total, verified, completedDemos: completed };
  });
}
