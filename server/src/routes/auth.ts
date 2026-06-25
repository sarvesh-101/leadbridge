import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Resend } from "resend";
import { OAuth2Client } from "google-auth-library";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../plugins/auth";
import { config } from "../config";

const resend = config.RESEND_API_KEY ? new Resend(config.RESEND_API_KEY) : null;

// Google OAuth client (only initialized if GOOGLE_CLIENT_ID is set)
let googleClient: OAuth2Client | null = null;
if (config.GOOGLE_CLIENT_ID) {
  googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);
}

export default async function authRoutes(fastify: FastifyInstance) {
  // ─── Register (create client) ─────────────────────────────────
  fastify.post("/auth/register", {
    schema: {
      body: {
        type: "object",
        required: ["email", "password", "businessName", "ownerName", "phone", "city"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8 },
          businessName: { type: "string", minLength: 1 },
          ownerName: { type: "string", minLength: 1 },
          phone: { type: "string", minLength: 10 },
          city: { type: "string", minLength: 1 },
          zone: { type: "string" },
          ownerWhatsapp: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: {
      email: string;
      password: string;
      businessName: string;
      ownerName: string;
      phone: string;
      city: string;
      zone?: string;
      ownerWhatsapp?: string;
    };
  }>, reply: FastifyReply) => {
    const { email, password, businessName, ownerName, phone, city, zone, ownerWhatsapp } = request.body;

    // Check if email already exists
    const existing = await fastify.prisma.client.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: "An account with this email already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create the client (no admin assignment needed — adminId is optional)
    const client = await fastify.prisma.client.create({
      data: {
        businessName,
        ownerName,
        email,
        phone,
        city,
        zone: zone || null,
        ownerWhatsapp: ownerWhatsapp || phone,
        passwordHash,
        plan: "GROWTH",
        planStatus: "TRIAL",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
        callsLimit: 100,
        leadSources: ["manual"],
        adminId: null,
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      sub: client.id,
      role: "client",
      clientId: client.id,
    });
    const refreshToken = generateRefreshToken({ sub: client.id, role: "client" });

    return reply.status(201).send({
      accessToken,
      refreshToken,
      user: {
        id: client.id,
        businessName: client.businessName,
        ownerName: client.ownerName,
        email: client.email,
        phone: client.phone,
        role: "client",
        plan: client.plan,
        planStatus: client.planStatus,
        callsThisMonth: client.callsThisMonth,
        callsLimit: client.callsLimit,
        city: client.city,
        zone: client.zone,
      },
    });
  });

  // ─── Admin Login ──────────────────────────────────────────────
  fastify.post("/auth/admin/login", {
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

    const admin = await fastify.prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const accessToken = generateAccessToken({ sub: admin.id, role: "admin" });
    const refreshToken = generateRefreshToken({ sub: admin.id, role: "admin" });

    return {
      accessToken,
      refreshToken,
      user: { id: admin.id, name: admin.name, email: admin.email, role: "admin" },
    };
  });

  // ─── Client Login ─────────────────────────────────────────────
  fastify.post("/auth/login", {
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

    const client = await fastify.prisma.client.findUnique({ where: { email } });
    if (!client) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, client.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const accessToken = generateAccessToken({
      sub: client.id,
      role: "client",
      clientId: client.id,
    });
    const refreshToken = generateRefreshToken({ sub: client.id, role: "client" });

    return {
      accessToken,
      refreshToken,
      user: {
        id: client.id,
        businessName: client.businessName,
        ownerName: client.ownerName,
        email: client.email,
        phone: client.phone,
        role: "client",
        plan: client.plan,
        planStatus: client.planStatus,
        callsThisMonth: client.callsThisMonth,
        callsLimit: client.callsLimit,
        city: client.city,
        zone: client.zone,
      },
    };
  });

  // ─── Refresh Token ────────────────────────────────────────────
  fastify.post("/auth/refresh", {
    schema: {
      body: {
        type: "object",
        required: ["refreshToken"],
        properties: {
          refreshToken: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { refreshToken: string } }>, reply: FastifyReply) => {
    const { refreshToken } = request.body;
    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      return reply.status(401).send({ error: "Invalid or expired refresh token" });
    }

    const accessToken = generateAccessToken({
      sub: decoded.sub,
      role: decoded.role as "admin" | "client",
      ...(decoded.role === "client" ? { clientId: decoded.sub } : {}),
    });
    const newRefreshToken = generateRefreshToken({
      sub: decoded.sub,
      role: decoded.role as "admin" | "client",
    });

    return { accessToken, refreshToken: newRefreshToken };
  });

  // ─── Logout ───────────────────────────────────────────────────
  fastify.post("/auth/logout", {
    preHandler: [fastify.authenticate],
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    // In a production system, invalidate the refresh token here
    return { message: "Logged out successfully" };
  });

  // ─── Google Sign-In ───────────────────────────────────────────
  fastify.post("/auth/google", {
    schema: {
      body: {
        type: "object",
        required: ["credential"],
        properties: {
          credential: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { credential: string } }>, reply: FastifyReply) => {
    if (!googleClient) {
      return reply.status(400).send({ error: "Google Sign-In is not configured. Set GOOGLE_CLIENT_ID in .env" });
    }

    try {
      // Verify the Google ID token
      const ticket = await googleClient.verifyIdToken({
        idToken: request.body.credential,
        audience: config.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return reply.status(400).send({ error: "Failed to get user info from Google" });
      }

      const googleEmail = payload.email;
      const googleName = payload.name || payload.email.split("@")[0];
      const googlePicture = payload.picture;

      // Find or create the client
      let client = await fastify.prisma.client.findUnique({ where: { email: googleEmail } });

      if (!client) {
        // Auto-create account from Google profile
        const randomPassword = crypto.randomBytes(24).toString("hex");
        const passwordHash = await bcrypt.hash(randomPassword, 12);

        client = await fastify.prisma.client.create({
          data: {
            businessName: `${googleName}'s Business`,
            ownerName: googleName,
            email: googleEmail,
            phone: "",
            city: "",
            ownerWhatsapp: "",
            passwordHash,
            plan: "GROWTH",
            planStatus: "TRIAL",
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            callsLimit: 100,
            leadSources: ["manual"],
            adminId: null,
          },
        });
      }

      // Generate tokens
      const accessToken = generateAccessToken({
        sub: client.id,
        role: "client",
        clientId: client.id,
      });
      const refreshToken = generateRefreshToken({ sub: client.id, role: "client" });

      return {
        accessToken,
        refreshToken,
        user: {
          id: client.id,
          businessName: client.businessName,
          ownerName: client.ownerName,
          email: client.email,
          phone: client.phone,
          role: "client",
          plan: client.plan,
          planStatus: client.planStatus,
          callsThisMonth: client.callsThisMonth,
          callsLimit: client.callsLimit,
          city: client.city,
          picture: googlePicture,
        },
      };
    } catch (err: any) {
      return reply.status(401).send({ error: "Invalid Google credential" });
    }
  });

  // ─── Forgot Password ─────────────────────────────────────────
  fastify.post("/auth/forgot-password", {
    schema: {
      body: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email" },
        },
      },
    },
    config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{ Body: { email: string } }>, reply: FastifyReply) => {
    const { email } = request.body;

    // Look up user in both client and admin tables
    const client = await fastify.prisma.client.findUnique({ where: { email } });
    const admin = await fastify.prisma.admin.findUnique({ where: { email } });

    if (!client && !admin) {
      // Don't reveal whether the email exists — always return success
      return { message: "If an account with that email exists, a reset link has been sent." };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token
    if (client) {
      await fastify.prisma.client.update({
        where: { id: client.id },
        data: { resetToken, resetTokenExpiresAt },
      });
    } else if (admin) {
      await fastify.prisma.admin.update({
        where: { id: admin.id },
        data: { resetToken, resetTokenExpiresAt },
      });
    }

    // Send email via Resend
    if (resend) {
      fastify.log.info({ email }, "Sending password reset email");
      const resetUrl = `${config.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;

      try {
        await resend.emails.send({
          from: `LeadFlow AI <${config.FROM_EMAIL}>`,
          to: email,
          subject: "Reset your LeadFlow AI password",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
              <div style="text-align: center; margin-bottom: 32px;">
                <div style="display: inline-flex; align-items: center; gap: 8px;">
                  <div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #6366F1, #8B5CF6); display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">⚡</div>
                  <span style="font-size: 20px; font-weight: 700; color: #1a1a2e;">LeadFlow AI</span>
                </div>
              </div>
              <h1 style="font-size: 22px; font-weight: 600; color: #1a1a2e; margin-bottom: 12px;">Reset your password</h1>
              <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
                We received a request to reset the password for your LeadFlow AI account.
                Click the button below to set a new password. This link expires in 1 hour.
              </p>
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; border-radius: 10px; background: linear-gradient(135deg, #6366F1, #8B5CF6); color: white; font-size: 15px; font-weight: 600; text-decoration: none;">
                  Reset Password
                </a>
              </div>
              <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
                If you didn't request this, you can safely ignore this email.
                Your password will not be changed.
              </p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
              <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                LeadFlow AI — Never Lose Another Lead Again
              </p>
            </div>
          `,
        });
      } catch (err: any) {
        fastify.log.error({ err }, "Failed to send password reset email");
      }
    } else {
      fastify.log.warn(
        "RESEND_API_KEY not configured — password reset token stored but email not sent. " +
        "Set RESEND_API_KEY in your environment to enable password reset emails."
      );
    }

    return { message: "If an account with that email exists, a reset link has been sent." };
  });

  // ─── Reset Password ──────────────────────────────────────────
  fastify.post("/auth/reset-password", {
    schema: {
      body: {
        type: "object",
        required: ["token", "password"],
        properties: {
          token: { type: "string" },
          password: { type: "string", minLength: 8 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { token: string; password: string } }>, reply: FastifyReply) => {
    const { token, password } = request.body;

    // Look up by token in both tables
    const client = await fastify.prisma.client.findFirst({
      where: { resetToken: token, resetTokenExpiresAt: { gt: new Date() } },
    });
    const admin = await fastify.prisma.admin.findFirst({
      where: { resetToken: token, resetTokenExpiresAt: { gt: new Date() } },
    });

    if (!client && !admin) {
      return reply.status(400).send({ error: "Invalid or expired reset token" });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update password and clear token
    if (client) {
      await fastify.prisma.client.update({
        where: { id: client.id },
        data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
      });
    } else if (admin) {
      await fastify.prisma.admin.update({
        where: { id: admin.id },
        data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
      });
    }

    return { message: "Password has been reset successfully. You can now log in." };
  });
}
