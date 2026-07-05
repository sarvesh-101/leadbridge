/**
 * Document / KYC Management Routes.
 *
 * Allows leads to upload and manage documents (ID proof, income proof, etc.)
 * as part of the booking/conversion process.
 * Documents are stored in Supabase storage and linked to leads.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

const ALLOWED_DOC_TYPES = [
  "aadhar",
  "pan",
  "passport",
  "voter_id",
  "driving_license",
  "income_proof",
  "bank_statement",
  "property_document",
  "other",
] as const;

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default async function documentRoutes(fastify: FastifyInstance) {
  // ─── List documents for a lead (broker side) ─────────────────
  fastify.get("/leads/:id/documents", {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const clientId = request.clientId!;
    const lead = await fastify.prisma.lead.findFirst({
      where: { id, clientId },
    });

    if (!lead) {
      return reply.status(404).send({ error: "Lead not found" });
    }

    const documents = await fastify.prisma.document.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        status: true,
        notes: true,
        uploadedBy: true,
        uploadedAt: true,
        verifiedAt: true,
      },
    });

    return { documents };
  });

  // ─── Upload document (customer portal side) ──────────────────
  fastify.post("/customer/documents/upload", {
    preHandler: [fastify.authenticate],
    config: {
      rateLimit: { max: 10, timeWindow: "1 minute" },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const leadId = request.userId;

    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
      return reply.status(400).send({
        error: `Unsupported file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
      });
    }

    // Read file
    const buffer = await file.toBuffer();
    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(400).send({ error: "File too large. Maximum 10MB." });
    }

    // Get doc type from form field
    const docType = (file.fields as any)?.type?.value || "other";
    if (!ALLOWED_DOC_TYPES.includes(docType)) {
      return reply.status(400).send({ error: `Invalid document type. Allowed: ${ALLOWED_DOC_TYPES.join(", ")}` });
    }

    // Upload to Supabase storage
    const { uploadFile } = await import("../../services/storage.service");
    const storagePath = `leads/${leadId}/documents/${Date.now()}-${file.filename}`;
    const publicUrl = await uploadFile("lead-documents", storagePath, buffer, file.mimetype);

    if (!publicUrl) {
      return reply.status(500).send({ error: "Failed to upload document" });
    }

    // Create document record
    const doc = await fastify.prisma.document.create({
      data: {
        leadId,
        type: docType,
        fileName: file.filename,
        fileSize: buffer.length,
        mimeType: file.mimetype,
        storagePath,
        url: publicUrl,
        status: "UPLOADED",
        uploadedBy: "lead",
        uploadedAt: new Date(),
      },
    });

    return reply.status(201).send({ document: doc });
  });

  // ─── Upload document (broker side) ────────────────────────────
  fastify.post("/leads/:id/documents/upload", {
    preHandler: [fastify.authenticate],
    config: {
      rateLimit: { max: 20, timeWindow: "1 minute" },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const clientId = request.clientId!;
    const lead = await fastify.prisma.lead.findFirst({
      where: { id, clientId },
    });

    if (!lead) {
      return reply.status(404).send({ error: "Lead not found" });
    }

    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
      return reply.status(400).send({ error: `Unsupported file type: ${file.mimetype}` });
    }

    const buffer = await file.toBuffer();
    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(400).send({ error: "File too large. Maximum 10MB." });
    }

    const docType = (file.fields as any)?.type?.value || "other";
    if (!ALLOWED_DOC_TYPES.includes(docType)) {
      return reply.status(400).send({ error: `Invalid document type.` });
    }

    const { uploadFile } = await import("../../services/storage.service");
    const storagePath = `leads/${lead.id}/documents/${Date.now()}-${file.filename}`;
    const publicUrl = await uploadFile("lead-documents", storagePath, buffer, file.mimetype);

    if (!publicUrl) {
      return reply.status(500).send({ error: "Failed to upload document" });
    }

    const doc = await fastify.prisma.document.create({
      data: {
        leadId: lead.id,
        type: docType,
        fileName: file.filename,
        fileSize: buffer.length,
        mimeType: file.mimetype,
        storagePath,
        url: publicUrl,
        status: "UPLOADED",
        uploadedBy: "broker",
        uploadedAt: new Date(),
        notes: (file.fields as any)?.notes?.value || null,
      },
    });

    return reply.status(201).send({ document: doc });
  });

  // ─── Verify document (broker marks as verified) ───────────────
  fastify.patch("/leads/:leadId/documents/:docId/verify", {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: "object",
        properties: {
          verified: { type: "boolean" },
          notes: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const { leadId, docId } = request.params as { leadId: string; docId: string };
    const body = request.body as { verified?: boolean; notes?: string };
    const clientId = request.clientId!;
    const lead = await fastify.prisma.lead.findFirst({
      where: { id: leadId, clientId },
    });
    if (!lead) return reply.status(404).send({ error: "Lead not found" });

    const verified = body.verified !== false;
    const doc = await fastify.prisma.document.update({
      where: { id: docId },
      data: {
        status: verified ? "VERIFIED" : "REJECTED",
        verifiedAt: verified ? new Date() : null,
        notes: body.notes || null,
      },
    });

    return { document: doc };
  });

  // ─── Delete document ──────────────────────────────────────────
  fastify.delete("/leads/:leadId/documents/:docId", {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { leadId, docId } = request.params as { leadId: string; docId: string };
    const clientId = request.clientId!;
    const lead = await fastify.prisma.lead.findFirst({
      where: { id: leadId, clientId },
    });
    if (!lead) return reply.status(404).send({ error: "Lead not found" });

    const doc = await fastify.prisma.document.findFirst({
      where: { id: docId, leadId: lead.id },
    });
    if (!doc) return reply.status(404).send({ error: "Document not found" });

    // Delete from storage
    const { deleteFile } = await import("../../services/storage.service");
    await deleteFile("lead-documents", doc.storagePath).catch(() => {});

    // Delete record
    await fastify.prisma.document.delete({ where: { id: doc.id } });

    return { success: true };
  });

  // ─── Get document summary for lead (used in lead detail) ──────
  fastify.get("/leads/:id/documents/summary", {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const clientId = request.clientId!;
    const lead = await fastify.prisma.lead.findFirst({
      where: { id, clientId },
    });
    if (!lead) return reply.status(404).send({ error: "Lead not found" });

    const [total, verified, pending] = await Promise.all([
      fastify.prisma.document.count({ where: { leadId: lead.id } }),
      fastify.prisma.document.count({ where: { leadId: lead.id, status: "VERIFIED" } }),
      fastify.prisma.document.count({ where: { leadId: lead.id, status: "UPLOADED" } }),
    ]);

    return { total, verified, pending, kycComplete: total > 0 && verified === total };
  });
}
