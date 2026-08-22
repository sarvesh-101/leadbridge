import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../plugins/auth";
import { config, PRIVACY_POLICY_VERSION } from "../config";
import { sendEmail } from "../services/email.service";

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
          // DPDP Phase 1.3: explicit consent to the Privacy Policy (required)
          consent: { type: "boolean" },
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
      consent?: boolean;
    };
  }>, reply: FastifyReply) => {
    const { email, password, businessName, ownerName, phone, city, zone, ownerWhatsapp, consent } = request.body;

    // DPDP Phase 1.3: no account without explicit consent to the Privacy Policy.
    // (Enforced in code — not the JSON schema — so the error message is clear.)
    if (!consent) {
      return reply.status(400).send({
        error: "You must accept the Privacy Policy and consent to data processing to create an account.",
        consentRequired: true,
      });
    }

    // Check if email already exists
    const existing = await fastify.prisma.client.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: "An account with this email already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // FIX Round-2 #3: email verification (trial-abuse protection) — every new
    // account starts unverified. Login is blocked (403 verificationRequired)
    // until the broker clicks the link in the verification email. This makes
    // fake-email signups useless: they can never activate the 14-day trial
    // (which costs the platform ~₹460/user in real AI calls).
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

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
        callsLimit: 500, // matches Growth plan definition (PLAN_DEFINITIONS.GROWTH.calls in billing.ts)
        leadSources: ["manual"],
        adminId: null,
        emailVerified: false,
        verificationToken,
        verificationTokenExpiresAt,
        // DPDP Phase 1.3: record when + which version of the Privacy Policy
        // the broker consented to at signup.
        consentGivenAt: new Date(),
        consentVersion: PRIVACY_POLICY_VERSION,
      },
    });

    // Send the verification email — FIRE-AND-FORGET (never blocks registration).
    // SMTP can hang for 45s+ from cloud providers; we send the response first
    // and log success/failure asynchronously.
    const verifyUrl = `${config.FRONTEND_URL}/auth/verify-email?token=${verificationToken}`;
    fastify.log.info({ email }, "Queuing verification email (fire-and-forget)");
    sendEmail({
      to: email,
      subject: "Verify your LeadBridge account",
      text: `Welcome to LeadBridge! Verify your email to activate your 14-day free trial: ${verifyUrl}\n\nThis link expires in 48 hours.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-flex; align-items: center; gap: 8px;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #4F6EF7, #8B5CF6); display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">⚡</div>
              <span style="font-size: 20px; font-weight: 700; color: #1a1a2e;">LeadBridge</span>
            </div>
          </div>
          <h1 style="font-size: 22px; font-weight: 600; color: #1a1a2e; margin-bottom: 12px;">Verify your email</h1>
          <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
            Welcome to LeadBridge! Click the button below to verify your email
            and activate your 14-day free trial.
          </p>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${verifyUrl}" style="display: inline-block; padding: 14px 32px; border-radius: 10px; background: linear-gradient(135deg, #4F6EF7, #8B5CF6); color: white; font-size: 15px; font-weight: 600; text-decoration: none;">
              Verify Email
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
            This link expires in 48 hours. If you didn't create a LeadBridge account,
            you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            LeadBridge — Never Lose Another Lead Again
          </p>
        </div>
      `,
    }).then(sent => {
      if (!sent) fastify.log.warn({ email }, "Verification email NOT sent — SMTP not configured");
    }).catch((err: any) => {
      fastify.log.error({ err }, "Failed to send verification email");
    });

    // Return immediately — don't wait for SMTP
    return reply.status(201).send({
      requiresVerification: true,
      emailSent: true, // optimistically true — we fired the request
      message: "Account created. Check your email to verify your account and activate your trial.",
      emailSent,
      message: emailSent
        ? "Account created. Check your email to verify your account and activate your trial."
        : "Account created, but the verification email could not be sent right now. Use the resend button below to try again.",
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

    // FIX Round-2 #3: block unverified accounts from logging in.
    // Existing accounts (created before this fix) are all backfilled to
    // emailVerified=true, so only brand-new signups are gated.
    if (!client.emailVerified) {
      return reply.status(403).send({
        error: "Please verify your email before logging in. Check your inbox for the verification link.",
        verificationRequired: true,
      });
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

  // ─── Verify Email ──────────────────────────────────────────────
  // GET /auth/verify-email?token=... — marks the account verified and returns
  // fresh tokens so the broker is logged in immediately.
  fastify.get("/auth/verify-email", {
    schema: {
      querystring: {
        type: "object",
        required: ["token"],
        properties: { token: { type: "string" } },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { token: string } }>, reply: FastifyReply) => {
    const { token } = request.query;

    const client = await fastify.prisma.client.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiresAt: { gt: new Date() },
      },
    });

    if (!client) {
      return reply.status(400).send({ error: "Invalid or expired verification link" });
    }

    await fastify.prisma.client.update({
      where: { id: client.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiresAt: null,
      },
    });

    const accessToken = generateAccessToken({
      sub: client.id,
      role: "client",
      clientId: client.id,
    });
    const refreshToken = generateRefreshToken({ sub: client.id, role: "client" });

    return {
      message: "Email verified successfully. Welcome to LeadBridge!",
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

  // ─── Resend Verification Email ─────────────────────────────────
  fastify.post("/auth/resend-verification", {
    schema: {
      body: {
        type: "object",
        required: ["email"],
        properties: { email: { type: "string", format: "email" } },
      },
    },
    config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{ Body: { email: string } }>, reply: FastifyReply) => {
    const { email } = request.body;

    const client = await fastify.prisma.client.findUnique({ where: { email } });
    if (!client) {
      // Don't reveal whether the email exists
      return { message: "If an account exists, a new verification link has been sent." };
    }

    if (client.emailVerified) {
      return reply.status(400).send({ error: "This email is already verified. You can log in." });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await fastify.prisma.client.update({
      where: { id: client.id },
      data: { verificationToken, verificationTokenExpiresAt },
    });

    const verifyUrl = `${config.FRONTEND_URL}/auth/verify-email?token=${verificationToken}`;
    // Fire-and-forget: don't block the response on SMTP
    sendEmail({
      to: email,
      subject: "Verify your LeadBridge account",
      text: `Verify your email to activate your trial: ${verifyUrl}\n\nThis link expires in 48 hours.`,
    }).catch((err: any) => fastify.log.error({ err }, "Resend verification email failed"));

    return {
      message: "If an account exists, a new verification link has been sent.",
      emailSent: true,
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

      if (client && !client.emailVerified) {
        // FIX Round-2 #3 (reviewer): a broker who signed up with email/password
        // but never verified can prove ownership via Google — verify them now.
        client = await fastify.prisma.client.update({
          where: { id: client.id },
          data: { emailVerified: true },
        });
      }

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
            callsLimit: 500, // matches Growth plan definition (PLAN_DEFINITIONS.GROWTH.calls in billing.ts)
            leadSources: ["manual"],
            adminId: null,
            // FIX Round-2 #3: Google already verified the email — skip the
            // email-verification step for OAuth signups.
            emailVerified: true,
            // DPDP Phase 1.3: Google OAuth screen itself is the consent
            // moment — record it.
            consentGivenAt: new Date(),
            consentVersion: PRIVACY_POLICY_VERSION,
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

    // Send email via shared email service — fire-and-forget (never blocks response)
    fastify.log.info({ email }, "Queuing password reset email (fire-and-forget)");
    const resetUrl = `${config.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;

    sendEmail({
      to: email,
      subject: "Reset your LeadBridge password",
      text: `You requested a password reset. Click here to reset: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-flex; align-items: center; gap: 8px;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #4F6EF7, #8B5CF6); display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">⚡</div>
              <span style="font-size: 20px; font-weight: 700; color: #1a1a2e;">LeadBridge</span>
            </div>
          </div>
          <h1 style="font-size: 22px; font-weight: 600; color: #1a1a2e; margin-bottom: 12px;">Reset your password</h1>
          <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
            We received a request to reset the password for your LeadBridge account.
            Click the button below to set a new password. This link expires in 1 hour.
          </p>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; border-radius: 10px; background: linear-gradient(135deg, #4F6EF7, #8B5CF6); color: white; font-size: 15px; font-weight: 600; text-decoration: none;">
              Reset Password
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
            If you didn't request this, you can safely ignore this email.
            Your password will not be changed.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            LeadBridge — Never Lose Another Lead Again
          </p>
        </div>
      `,
    }).catch((err: any) => {
      fastify.log.error({ err }, "Failed to send password reset email");
    });

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

    // Invalidate ALL existing reset tokens for this user (prevents token reuse)
    if (client) {
      await fastify.prisma.client.updateMany({
        where: { id: client.id, resetToken: { not: null } },
        data: { resetToken: null, resetTokenExpiresAt: null },
      });
    } else if (admin) {
      await fastify.prisma.admin.updateMany({
        where: { id: admin.id, resetToken: { not: null } },
        data: { resetToken: null, resetTokenExpiresAt: null },
      });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update password only (tokens already cleared above)
    if (client) {
      await fastify.prisma.client.update({
        where: { id: client.id },
        data: { passwordHash },
      });
    } else if (admin) {
      await fastify.prisma.admin.update({
        where: { id: admin.id },
        data: { passwordHash },
      });
    }

    return { message: "Password has been reset successfully. You can now log in." };
  });
}
