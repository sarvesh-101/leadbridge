/**
 * Lead parser for Indian real estate portals.
 * Normalizes payloads from 99acres, MagicBricks, Housing.com, JustDial into a standard format.
 */

export interface NormalizedLead {
  name: string;
  phone: string;
  email?: string;
  source: string;
  rawPayload: Record<string, unknown>;
}

function extractPhone(payload: Record<string, unknown>): string {
  const phone =
    (payload.phone as string) ||
    (payload.mobile as string) ||
    (payload.PhoneNumber as string) ||
    (payload.contact_number as string) ||
    (payload.contactNumber as string) ||
    "";
  // Remove non-digits and take last 10 digits
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length >= 10) {
    return `+91${cleaned.slice(-10)}`;
  }
  return phone;
}

function extractName(payload: Record<string, unknown>): string {
  return (
    (payload.name as string) ||
    (payload.Name as string) ||
    (payload.lead_name as string) ||
    (payload.contact_person as string) ||
    (payload.contactPerson as string) ||
    (payload.userName as string) ||
    "Unknown Lead"
  );
}

function extractEmail(payload: Record<string, unknown>): string | undefined {
  return (
    (payload.email as string) ||
    (payload.Email as string) ||
    (payload.email_id as string) ||
    undefined
  );
}

// Portal-specific parsers
const parsers: Record<string, (payload: Record<string, unknown>) => NormalizedLead> = {
  "99acres": (payload) => ({
    name: extractName(payload),
    phone: extractPhone(payload),
    email: extractEmail(payload),
    source: "99acres",
    rawPayload: payload,
  }),

  magicbricks: (payload) => ({
    name: extractName(payload),
    phone: extractPhone(payload),
    email: extractEmail(payload),
    source: "magicbricks",
    rawPayload: payload,
  }),

  housing: (payload) => ({
    name: extractName(payload),
    phone: extractPhone(payload),
    email: extractEmail(payload),
    source: "housing",
    rawPayload: payload,
  }),

  justdial: (payload) => ({
    name: extractName(payload),
    phone: extractPhone(payload),
    email: extractEmail(payload),
    source: "justdial",
    rawPayload: payload,
  }),

  manual: (payload) => ({
    name: payload.name as string || "Unknown",
    phone: extractPhone(payload),
    email: extractEmail(payload),
    source: "manual",
    rawPayload: payload,
  }),
};

export function parseLead(source: string, payload: Record<string, unknown>): NormalizedLead {
  const parser = parsers[source.toLowerCase()] || parsers.manual;
  return parser(payload);
}

/**
 * Generic parser for any webhook payload using field mapping rules.
 * Used when a client sets up custom field mappings.
 */
export function parseWithMapping(
  payload: Record<string, unknown>,
  mapping: Record<string, string>
): NormalizedLead {
  const mapped: Record<string, unknown> = {};
  for (const [targetField, sourceField] of Object.entries(mapping)) {
    mapped[targetField] = payload[sourceField];
  }
  return {
    name: (mapped.name as string) || extractName(payload),
    phone: (mapped.phone as string) || extractPhone(payload),
    email: (mapped.email as string) || extractEmail(payload),
    source: "custom",
    rawPayload: payload,
  };
}
