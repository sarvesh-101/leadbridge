/**
 * Team Management Routes — Multi-Broker Support
 *
 * Allows the account owner (ADMIN role) to invite team members
 * with different permission levels (ADMIN, AGENT, VIEWER).
 *
 * Team members can:
 * - ADMIN: Full access to all features including billing and team management
 * - AGENT: Manage leads, calls, bookings, campaigns
 * - VIEWER: Read-only access to dashboard and reports
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { config } from "../../config";
import { generateAccessToken, generateRefreshToken } from "../../plugins/auth";
import { sendEmail } from "../../services/email.service";

export default async function teamRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── List Team Members ─────────────────────────────────────────
  fastify.get("/team/members", async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = request.clientId!;

    const members = await fastify.prisma.teamMember.findMany({
      where: { clientId },
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        invitedAt: true,
        acceptedAt: true,
      },
    });

    return { members };
  });

  // ─── Invite Team Member ────────────────────────────────────────
  fastify.post("/team/invite", {
    schema: {
      body: {
        type: "object",
        required: ["email", "name", "role"],
        properties: {
          email: { type: "string", format: "email" },
          name: { type: "string", minLength: 1 },
          role: { type: "string", enum: ["ADMIN", "AGENT", "VIEWER"] },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: { email: string; name: string; role: "ADMIN" | "AGENT" | "VIEWER" };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { email, name, role } = request.body;

    // Check if already a member
    const existing = await fastify.prisma.teamMember.findUnique({
      where: { clientId_email: { clientId, email } },
    });

    if (existing) {
      return reply.status(409).send({
        error: existing.status === "PENDING"
          ? "Invitation already sent to this email"
          : "This person is already a team member",
      });
    }

    // Create pending member
    const member = await fastify.prisma.teamMember.create({
      data: {
        clientId,
        email,
        name,
        role,
        status: "PENDING",
        invitedById: request.clientId,
        invitedAt: new Date(),
      },
    });

    // Send invitation email via shared email service (SMTP primary, Resend fallback)
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteUrl = `${config.FRONTEND_URL}/auth/accept-invite?token=${inviteToken}&email=${encodeURIComponent(email)}`;

    // Store the token for acceptance
    await fastify.prisma.teamMember.update({
      where: { id: member.id },
      data: { resetToken: inviteToken, resetTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    try {
      const emailSent = await sendEmail({
        to: email,
        subject: `${name} — you've been invited to join LeadBridge`,
        text: `You've been invited to join LeadBridge as a ${role}.\n\nAccept here: ${inviteUrl}\n\nThis invitation expires in 7 days.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #4F6EF7, #8B5CF6); display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; margin: 0 auto 16px;">👥</div>
              <h1 style="font-size: 22px; font-weight: 600; color: #1a1a2e; margin-bottom: 8px;">You're Invited!</h1>
              <p style="color: #64748b; line-height: 1.6;">
                You've been invited to join <strong>LeadBridge</strong> as a <strong>${role}</strong>.
              </p>
            </div>
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${inviteUrl}" style="display: inline-block; padding: 14px 32px; border-radius: 10px; background: linear-gradient(135deg, #4F6EF7, #8B5CF6); color: white; font-size: 15px; font-weight: 600; text-decoration: none;">
                Accept Invitation
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; text-align: center;">
              This invitation expires in 7 days.
            </p>
          </div>
        `,
      });

      if (!emailSent) {
        fastify.log.warn({ email }, "Failed to send invitation email — no email provider configured");
      }
    } catch (err: any) {
      fastify.log.error({ err }, "Failed to send invitation email");
    }

    return reply.status(201).send({ member: { id: member.id, email: member.email, name: member.name, role: member.role, status: member.status } });
  });

  // ─── Accept Invitation ─────────────────────────────────────────
  fastify.post("/team/accept-invite", {
    schema: {
      body: {
        type: "object",
        required: ["token", "email", "password"],
        properties: {
          token: { type: "string" },
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8 },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: { token: string; email: string; password: string };
  }>, reply: FastifyReply) => {
    const { token, email, password } = request.body;

    const member = await fastify.prisma.teamMember.findFirst({
      where: {
        email,
        resetToken: token,
        resetTokenExpiresAt: { gt: new Date() },
        status: "PENDING",
      },
    });

    if (!member) {
      return reply.status(400).send({ error: "Invalid or expired invitation" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await fastify.prisma.teamMember.update({
      where: { id: member.id },
      data: {
        passwordHash,
        status: "ACTIVE",
        acceptedAt: new Date(),
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });

    return { message: "Invitation accepted. You can now log in." };
  });

  // ─── Remove Team Member ────────────────────────────────────────
  fastify.delete("/team/members/:id", async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;

    const member = await fastify.prisma.teamMember.findFirst({
      where: { id: request.params.id, clientId },
    });

    if (!member) {
      return reply.status(404).send({ error: "Team member not found" });
    }

    await fastify.prisma.teamMember.delete({
      where: { id: member.id },
    });

    return { message: "Team member removed" };
  });

  // ─── Update Member Role ────────────────────────────────────────
  fastify.patch("/team/members/:id/role", {
    schema: {
      body: {
        type: "object",
        required: ["role"],
        properties: {
          role: { type: "string", enum: ["ADMIN", "AGENT", "VIEWER"] },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Params: { id: string };
    Body: { role: "ADMIN" | "AGENT" | "VIEWER" };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;

    const member = await fastify.prisma.teamMember.findFirst({
      where: { id: request.params.id, clientId },
    });

    if (!member) {
      return reply.status(404).send({ error: "Team member not found" });
    }

    await fastify.prisma.teamMember.update({
      where: { id: member.id },
      data: { role: request.body.role },
    });

    return { message: "Role updated" };
  });

  // ─── Team Member Login ─────────────────────────────────────────
  fastify.post("/team/login", {
    schema: {
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 6 },
        },
      },
    },
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{ Body: { email: string; password: string } }>, reply: FastifyReply) => {
    const { email, password } = request.body;

    const member = await fastify.prisma.teamMember.findFirst({
      where: { email, status: "ACTIVE" },
      include: { client: { select: { id: true, businessName: true } } },
    });

    if (!member) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    if (!member.passwordHash) {
      return reply.status(401).send({ error: "Account not set up yet. Accept your invitation first." });
    }

    const valid = await bcrypt.compare(password, member.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const accessToken = generateAccessToken({
      sub: member.id,
      role: "client",  // Use client role for authorization scope
      clientId: member.clientId,
    });
    const refreshToken = generateRefreshToken({ sub: member.id, role: "client" });

    return {
      accessToken,
      refreshToken,
      user: {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role.toLowerCase(),
        businessName: member.client.businessName,
        teamMember: true,
      },
    };
  });
}
