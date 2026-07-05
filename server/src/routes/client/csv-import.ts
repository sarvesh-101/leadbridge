import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { enqueueCall } from "../../workers/queues";

interface CsvLeadRow {
  name: string;
  phone: string;
  email?: string;
  source?: string;
  budget?: string;
  location?: string;
  timeline?: string;
  propertyType?: string;
  bedrooms?: string;
  notes?: string;
}

export default async function csvImportRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── Upload & Parse CSV ────────────────────────────────────────
  fastify.post("/leads/import/preview", {
    config: {
      rateLimit: { max: 10, timeWindow: "1 minute" },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = request.clientId!;

    // Check plan limits
    const client = await fastify.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return reply.status(404).send({ error: "Client not found" });
    if (client.planStatus !== "TRIAL" && client.planStatus !== "ACTIVE") {
      return reply.status(403).send({ error: "Account is not active." });
    }

    // Parse multipart upload
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    // Validate file type
    const filename = file.filename.toLowerCase();
    if (!filename.endsWith(".csv")) {
      return reply.status(400).send({ error: "Only CSV files are supported" });
    }

    // Read file content
    const buffer = await file.toBuffer();
    const content = buffer.toString("utf-8");

    // Parse CSV
    const rows = parseCsv(content);

    if (rows.length === 0) {
      return reply.status(400).send({ error: "CSV file is empty or has no valid data rows" });
    }

    if (rows.length > 500) {
      return reply.status(400).send({ error: "Maximum 500 leads per import" });
    }

    // Validate rows
    const validRows: CsvLeadRow[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    const phoneSet = new Set<string>();

    rows.forEach((row, i) => {
      const rowNum = i + 2; // +2 for 1-indexed + header row
      const name = (row.name || row.Name || row.NAME || "").toString().trim();
      const phone = (row.phone || row.Phone || row.PHONE || row.mobile || row.Mobile || "").toString().trim();

      if (!name && !phone) {
        errors.push({ row: rowNum, message: "Row is empty — skipped" });
        return;
      }
      if (!name) {
        errors.push({ row: rowNum, message: "Name is required" });
        return;
      }
      if (!phone) {
        errors.push({ row: rowNum, message: "Phone is required" });
        return;
      }

      const cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.length < 10) {
        errors.push({ row: rowNum, message: `Invalid phone: "${phone}"` });
        return;
      }

      if (phoneSet.has(cleanPhone)) {
        errors.push({ row: rowNum, message: `Duplicate phone in CSV: "${phone}"` });
        return;
      }
      phoneSet.add(cleanPhone);

      validRows.push({
        name,
        phone: cleanPhone,
        email: (row.email || row.Email || row.EMAIL || "").toString().trim() || undefined,
        source: (row.source || row.Source || row.SOURCE || row.leadSource || "").toString().trim() || "csv-import",
        budget: (row.budget || row.Budget || row.BUDGET || "").toString().trim() || undefined,
        location: (row.location || row.Location || row.LOCATION || row.city || row.City || "").toString().trim() || undefined,
        timeline: (row.timeline || row.Timeline || row.TIMELINE || "").toString().trim() || undefined,
        propertyType: (row.propertyType || row.property || row.Property || "").toString().trim() || undefined,
        bedrooms: (row.bedrooms || row.Bedrooms || row.BEDROOMS || "").toString().trim() || undefined,
        notes: (row.notes || row.Notes || row.NOTES || "").toString().trim() || undefined,
      });
    });

    // Check for duplicates against existing leads in DB (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const existingLeads = await fastify.prisma.lead.findMany({
      where: {
        clientId,
        phone: { in: validRows.map((r) => r.phone) },
        receivedAt: { gte: thirtyDaysAgo },
      },
      select: { phone: true, name: true, status: true },
    });
    const existingPhoneSet = new Set(existingLeads.map((l) => l.phone));

    const duplicates = validRows.filter((r) => existingPhoneSet.has(r.phone));
    const newRows = validRows.filter((r) => !existingPhoneSet.has(r.phone));

    return {
      total: validRows.length,
      valid: newRows.length,
      duplicates: duplicates.length,
      errors: errors.length,
      errorDetails: errors.slice(0, 10),
      duplicateDetails: duplicates.slice(0, 10).map((d) => ({
        name: d.name,
        phone: d.phone,
      })),
      preview: newRows.slice(0, 5).map((r) => ({
        name: r.name,
        phone: r.phone,
        email: r.email || "",
        source: r.source || "csv-import",
      })),
      filename,
      totalRows: rows.length,
    };
  });

  // ─── Execute CSV Import ────────────────────────────────────────
  fastify.post("/leads/import/execute", {
    config: {
      rateLimit: { max: 5, timeWindow: "1 minute" },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = request.clientId!;

    const client = await fastify.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return reply.status(404).send({ error: "Client not found" });

    // Parse multipart upload
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const buffer = await file.toBuffer();
    const content = buffer.toString("utf-8");
    const rows = parseCsv(content);

    // Validate and filter just like preview
    const validRows: CsvLeadRow[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    const phoneSet = new Set<string>();

    rows.forEach((row, i) => {
      const rowNum = i + 2;
      const name = (row.name || row.Name || row.NAME || "").toString().trim();
      const phone = (row.phone || row.Phone || row.PHONE || row.mobile || row.Mobile || "").toString().trim();
      if (!name || !phone) {
        errors.push({ row: rowNum, message: !name ? "Name required" : "Phone required" });
        return;
      }
      const cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.length < 10) {
        errors.push({ row: rowNum, message: `Invalid phone` });
        return;
      }
      if (phoneSet.has(cleanPhone)) {
        errors.push({ row: rowNum, message: `Duplicate phone` });
        return;
      }
      phoneSet.add(cleanPhone);
      validRows.push({
        name,
        phone: cleanPhone,
        email: (row.email || row.Email || row.EMAIL || "").toString().trim() || undefined,
        source: (row.source || row.Source || row.SOURCE || "").toString().trim() || "csv-import",
        budget: (row.budget || row.Budget || row.BUDGET || "").toString().trim() || undefined,
        location: (row.location || row.Location || row.LOCATION || "").toString().trim() || undefined,
        timeline: (row.timeline || row.Timeline || row.TIMELINE || "").toString().trim() || undefined,
        propertyType: (row.propertyType || row.property || row.Property || "").toString().trim() || undefined,
        bedrooms: (row.bedrooms || row.Bedrooms || row.BEDROOMS || "").toString().trim() || undefined,
      });
    });

    // Deduplicate against DB
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const existingLeads = await fastify.prisma.lead.findMany({
      where: {
        clientId,
        phone: { in: validRows.map((r) => r.phone) },
        receivedAt: { gte: thirtyDaysAgo },
      },
      select: { phone: true },
    });
    const existingPhoneSet = new Set(existingLeads.map((l) => l.phone));
    const toImport = validRows.filter((r) => !existingPhoneSet.has(r.phone));

    // Import in batches of 50
    let imported = 0;
    const batchSize = 50;

    for (let i = 0; i < toImport.length; i += batchSize) {
      const batch = toImport.slice(i, i + batchSize);
      const leads = await Promise.all(
        batch.map((row) =>
          fastify.prisma.lead.create({
            data: {
              clientId,
              name: row.name,
              phone: row.phone,
              email: row.email || null,
              source: row.source || "csv-import",
              budget: row.budget || null,
              location: row.location || null,
              timeline: row.timeline || null,
              propertyType: row.propertyType || null,
              bedrooms: row.bedrooms || null,
              rawPayload: { notes: row.notes || null, importSource: "csv" },
              status: "PENDING",
              receivedAt: new Date(),
            },
          })
        )
      );
      imported += leads.length;

      // Auto-assign each lead to a team member
      const { assignLead } = await import("../../services/lead-assignment.service");
      for (const lead of leads) {
        assignLead(clientId, lead.id).catch(() => {});
      }

      // Enqueue calls for each lead (non-blocking)
      for (const lead of leads) {
        enqueueCall({
          leadId: lead.id,
          clientId,
          callType: "QUALIFICATION",
          attempt: 1,
        }).catch(() => {});
      }
    }

    return {
      imported,
      skipped: validRows.length - imported,
      total: toImport.length,
      message: `Imported ${imported} leads successfully`,
    };
  });

  // ─── Download Sample CSV ───────────────────────────────────────
  fastify.get("/leads/import/sample", async (_request: FastifyRequest, reply: FastifyReply) => {
    const sampleCsv = `name,phone,email,source,budget,location,timeline,propertyType,bedrooms,notes
Rajesh Sharma,9876543210,rajesh@example.com,99acres,8000000,Andheri West,Within 1 month,Apartment,3,Looking for 3BHK near metro
Priya Patel,9876543211,priya@example.com,MagicBricks,5000000,Borivali East,Immediate,Apartment,2,Budget flexible
Amit Singh,9876543212,,Housing.com,12000000,Bandra West,Within 3 months,Penthouse,4,Sea view preferred
Neha Gupta,9876543213,neha@example.com,JustDial,3500000,Navi Delhi,Within 2 months,Flat,2,Near office
Vikram Verma,9876543214,vikram@example.com,Facebook,6000000,Gurgaon,Immediate,Villa,3,Need ready-to-move
`;

    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", "attachment; filename=leadbridge-sample-import.csv");
    return reply.send(sampleCsv);
  });
}

/**
 * Simple CSV parser — handles quoted fields, newlines in quotes, and various delimiters.
 */
function parseCsv(content: string): Record<string, string>[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  // Handle quoted fields (including newlines within quotes)
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "\n" && !inQuotes) {
      if (current.trim()) lines.push(current.trim());
      current = "";
      continue;
    }
    if (char === "\r") continue;
    current += char;
  }
  if (current.trim()) lines.push(current.trim());

  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const result: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, j) => {
      row[header] = j < values.length ? values[j].trim() : "";
    });
    result.push(row);
  }

  return result;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current);

  return result;
}
