import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import path from "path";
import fs from "fs";
import { saveFile, deleteFilesByUrls } from "../../utils/local-storage";

const PROPERTY_UPDATABLE_FIELDS = [
  "name", "description", "price", "currency", "bedrooms", "bathrooms",
  "area", "areaUnit", "location", "city", "zone", "status", "featured",
  "images", "amenities", "tags",
];

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export default async function clientPropertyRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── List Properties ───────────────────────────────────────────
  fastify.get("/properties", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const { page = "1", limit = "20", status, search } =
      request.query as Record<string, string>;

    const where: Record<string, unknown> = { clientId };

    if (status && status !== "all") {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [properties, total] = await Promise.all([
      fastify.prisma.property.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: { _count: { select: { bookings: true } } },
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      }),
      fastify.prisma.property.count({ where }),
    ]);

    return { properties, total, page: parseInt(page), limit: parseInt(limit) };
  });

  // ─── Get Property ──────────────────────────────────────────────
  fastify.get("/properties/:id", async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const clientId = request.clientId!;
    const property = await fastify.prisma.property.findFirst({
      where: { id: request.params.id, clientId },
      include: {
        bookings: {
          include: { lead: { select: { name: true, phone: true, status: true } } },
          orderBy: { visitDate: "desc" },
          take: 10,
        },
      },
    });

    if (!property) {
      return { property: null };
    }

    return { property };
  });

  // ─── Create Property ───────────────────────────────────────────
  fastify.post("/properties", {
    schema: {
      body: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1 },
          description: { type: "string" },
          price: { type: "number" },
          currency: { type: "string" },
          bedrooms: { type: "integer" },
          bathrooms: { type: "integer" },
          area: { type: "number" },
          areaUnit: { type: "string" },
          location: { type: "string" },
          city: { type: "string" },
          zone: { type: "string" },
          status: { type: "string", enum: ["AVAILABLE", "BOOKED", "SOLD", "OFF_MARKET"] },
          featured: { type: "boolean" },
          images: { type: "array", items: { type: "string" } },
          amenities: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: Record<string, unknown>;
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const body = request.body;

    const property = await fastify.prisma.property.create({
      data: {
        clientId,
        name: body.name as string,
        description: (body.description as string) || null,
        price: (body.price as number) ?? null,
        currency: (body.currency as string) || "INR",
        bedrooms: (body.bedrooms as number) ?? null,
        bathrooms: (body.bathrooms as number) ?? null,
        area: (body.area as number) ?? null,
        areaUnit: (body.areaUnit as string) || "sqft",
        location: (body.location as string) || null,
        city: (body.city as string) || null,
        zone: (body.zone as string) || null,
        status: (body.status as "AVAILABLE" | "BOOKED" | "SOLD" | "OFF_MARKET") || "AVAILABLE",
        featured: (body.featured as boolean) ?? false,
        images: (body.images as string[]) ?? [],
        amenities: (body.amenities as string[]) ?? [],
        tags: (body.tags as string[]) ?? [],
      },
    });

    // Auto-sync knowledge base in background
    syncPropertyKnowledge(clientId, fastify).catch((err: Error) => {
      fastify.log.error({ err: err.message }, "Failed to sync property knowledge base");
    });

    return reply.status(201).send({ property });
  });

  // ─── Update Property ───────────────────────────────────────────
  fastify.patch("/properties/:id", async (request: FastifyRequest<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const property = await fastify.prisma.property.findFirst({
      where: { id: request.params.id, clientId },
    });

    if (!property) {
      return reply.status(404).send({ error: "Property not found" });
    }

    const data = Object.fromEntries(
      PROPERTY_UPDATABLE_FIELDS
        .filter((k) => k in request.body)
        .map((k) => [k, request.body[k]])
    );

    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ error: "No valid fields to update" });
    }

    const updated = await fastify.prisma.property.update({
      where: { id: property.id },
      data: data as Record<string, unknown>,
    });

    // Auto-sync knowledge base in background
    syncPropertyKnowledge(clientId, fastify).catch((err: Error) => {
      fastify.log.error({ err: err.message }, "Failed to sync property knowledge base");
    });

    return { property: updated };
  });

  // ─── Delete Property ───────────────────────────────────────────
  fastify.delete("/properties/:id", async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const property = await fastify.prisma.property.findFirst({
      where: { id: request.params.id, clientId },
    });

    if (!property) {
      return reply.status(404).send({ error: "Property not found" });
    }

    await fastify.prisma.property.delete({
      where: { id: property.id },
    });

    // Sync knowledge base (will clear if no properties remain)
    syncPropertyKnowledge(clientId, fastify).catch((err: Error) => {
      fastify.log.error({ err: err.message }, "Failed to sync property knowledge base");
    });

    return { message: "Property deleted" };
  });

  // ─── Toggle Featured ───────────────────────────────────────────
  fastify.post("/properties/:id/feature", async (request: FastifyRequest<{
    Params: { id: string };
  }>) => {
    const clientId = request.clientId!;
    const property = await fastify.prisma.property.findFirst({
      where: { id: request.params.id, clientId },
    });

    if (!property) {
      return { error: "Property not found" };
    }

    const updated = await fastify.prisma.property.update({
      where: { id: property.id },
      data: { featured: !property.featured },
    });

    return { property: updated };
  });

  // ─── Upload Property Image ─────────────────────────────────────
  fastify.post("/properties/upload", {
    config: {
      rateLimit: { max: 20, timeWindow: "1 minute" },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(data.mimetype)) {
      return reply.status(400).send({
        error: `Unsupported file type: ${data.mimetype}. Allowed: JPEG, PNG, WebP, GIF, AVIF`,
      });
    }

    // Read file buffer
    const buffer = await data.toBuffer();
    if (buffer.length > MAX_IMAGE_SIZE) {
      return reply.status(400).send({ error: "File too large. Maximum 5MB." });
    }

    // Save to local storage
    const urlPath = await saveFile(buffer, data.filename);

    if (!urlPath) {
      return reply.status(500).send({ error: "Failed to save file" });
    }

    return reply.status(201).send({
      url: urlPath,
      filename: data.filename,
    });
  });

  // ─── Delete Property Images ────────────────────────────────────
  fastify.post("/properties/images/delete", async (request: FastifyRequest<{
    Body: { urls: string[] };
  }>, reply: FastifyReply) => {
    const { urls } = request.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return reply.status(400).send({ error: "No image URLs provided" });
    }

    await deleteFilesByUrls(urls);
    return { success: true, deleted: urls.length };
  });

  // ─── Serve Uploaded Images ─────────────────────────────────────
  fastify.get("/uploads/properties/:filename", async (request: FastifyRequest<{
    Params: { filename: string };
  }>, reply: FastifyReply) => {
    const uploadsDir = path.resolve(__dirname, "../../../uploads/properties");
    const filePath = path.join(uploadsDir, request.params.filename);

    // Security: prevent directory traversal
    if (!filePath.startsWith(uploadsDir)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    try {
      const stream = fs.createReadStream(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".avif": "image/avif",
      };
      reply.type(mimeTypes[ext] || "application/octet-stream");
      return reply.send(stream);
    } catch {
      return reply.status(404).send({ error: "File not found" });
    }
  });

  // ─── Manually Sync Knowledge Base ──────────────────────────────
  fastify.post("/properties/sync-knowledge", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    await syncPropertyKnowledge(clientId, fastify);
    return { message: "Knowledge base synced successfully" };
  });

  // ─── Bulk Create Properties ────────────────────────────────────
  fastify.post("/properties/bulk", {
    schema: {
      body: {
        type: "object",
        required: ["properties"],
        properties: {
          properties: {
            type: "array",
            items: {
              type: "object",
              required: ["name"],
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                price: { type: "number" },
                bedrooms: { type: "integer" },
                bathrooms: { type: "integer" },
                area: { type: "number" },
                location: { type: "string" },
                city: { type: "string" },
              },
            },
          },
        },
      },
    },
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{
    Body: { properties: Array<Record<string, unknown>> };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;

    const created = await fastify.prisma.property.createMany({
      data: request.body.properties.map((p) => ({
        clientId,
        name: p.name as string,
        description: (p.description as string) || null,
        price: (p.price as number) ?? null,
        bedrooms: (p.bedrooms as number) ?? null,
        bathrooms: (p.bathrooms as number) ?? null,
        area: (p.area as number) ?? null,
        location: (p.location as string) || null,
        city: (p.city as string) || null,
      })),
    });

    return reply.status(201).send({ count: created.count });
  });
}

/**
 * Sync all properties for a client into the AI agent's knowledge base.
 * Generates structured property text and updates broker's knowledgeBase field.
 * Clears knowledgeBase when no properties remain.
 */
async function syncPropertyKnowledge(clientId: string, fastify: FastifyInstance): Promise<void> {
  const client = await fastify.prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, businessName: true },
  });

  if (!client) return;

  const properties = await fastify.prisma.property.findMany({
    where: {
      clientId,
      status: { in: ["AVAILABLE", "BOOKED"] },
    },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  let knowledgeText: string;

  if (properties.length === 0) {
    knowledgeText = "";
  } else {
    const propertySummary = properties.map((p, i) => {
      const lines: string[] = [
        `${i + 1}. ${p.name}`,
      ];
      if (p.description) lines.push(`   Description: ${p.description}`);
      if (p.price) lines.push(`   Price: ₹${p.price.toLocaleString("en-IN")}`);
      if (p.bedrooms || p.bathrooms) {
        const parts: string[] = [];
        if (p.bedrooms) parts.push(`${p.bedrooms} BHK`);
        if (p.bathrooms) parts.push(`${p.bathrooms} bathroom${p.bathrooms > 1 ? "s" : ""}`);
        lines.push(`   Specs: ${parts.join(", ")}`);
      }
      if (p.area) lines.push(`   Area: ${p.area} ${p.areaUnit}`);
      if (p.location) lines.push(`   Location: ${p.location}`);
      if (Array.isArray(p.amenities) && p.amenities.length > 0) {
        lines.push(`   Amenities: ${p.amenities.join(", ")}`);
      }
      if (p.status === "BOOKED") lines.push(`   Status: Currently booked for a visit`);
      return lines.join("\n");
    }).join("\n\n");

    knowledgeText = [
      `🏢 PROPERTIES BY ${client.businessName.toUpperCase()}`,
      `============================================`,
      ``,
      `Here are the available properties you can discuss with leads:`,
      ``,
      propertySummary,
      ``,
      `When a lead asks about properties, use this list to recommend options.`,
      `Ask about their budget, preferred location, and requirements to match them.`,
    ].join("\n");
  }

  // Update the broker's knowledgeBase field
  await fastify.prisma.client.update({
    where: { id: clientId },
    data: { knowledgeBase: knowledgeText || null },
  });

  // Mark all synced properties with timestamp
  await fastify.prisma.property.updateMany({
    where: { clientId },
    data: { lastSyncedToAgentAt: new Date() },
  });

  fastify.log.info({ clientId, propertyCount: properties.length }, "Property knowledge base synced");
}
