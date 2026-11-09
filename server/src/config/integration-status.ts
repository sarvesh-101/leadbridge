/**
 * V2 (T8) — lead-source integration status: SINGLE SOURCE OF TRUTH.
 *
 * Every surface that talks about integrations reads this file:
 *   - GET /public/integrations  → the marketing site (T10)
 *   - the admin portal guide    → routes/admin/integrations.ts
 *   - the AI representative     → {{INTEGRATIONS_TABLE}} in T12
 *   - frontend/src/lib/integrations.autogen.ts (generated, drift-tested)
 *
 * Flipping a status here (and running gen-integrations) changes all of them.
 * Never hardcode an integration status anywhere else.
 */

export type IntegrationAvailability = "LIVE" | "SETUP_ASSISTED" | "IN_SETUP" | "COMING_SOON";

export interface IntegrationStatusEntry {
  /** Stable id used by the dashboard/analytics. */
  id: string;
  /** Customer-facing name. */
  name: string;
  availability: IntegrationAvailability;
  /** Short plain-language note, safe for marketing copy. */
  note: string;
  /** How leads arrive: api | forwarding | file | manual */
  kind: "api" | "forwarding" | "file" | "manual";
}

/**
 * Initial statuses per the V2 plan §T8. A status may only move to LIVE after a
 * human has verified a real lead end-to-end (HUMAN GATE).
 */
export const INTEGRATION_STATUS: IntegrationStatusEntry[] = [
  {
    id: "website_form",
    name: "Website form / widget",
    availability: "LIVE",
    note: "Embed the Converza form or point your site's webhook at us.",
    kind: "api",
  },
  {
    id: "custom_webhook",
    name: "Custom webhook",
    availability: "LIVE",
    note: "Any system that can POST JSON can send us leads.",
    kind: "api",
  },
  {
    id: "csv",
    name: "CSV upload",
    availability: "LIVE",
    note: "Upload an export; duplicates are detected automatically.",
    kind: "file",
  },
  {
    id: "manual",
    name: "Manual entry",
    availability: "LIVE",
    note: "Type or paste a lead straight into the dashboard.",
    kind: "manual",
  },
  {
    id: "google_sheets",
    name: "Google Sheets",
    availability: "LIVE",
    note: "Two-way sync with a sheet you already maintain.",
    kind: "api",
  },
  {
    id: "facebook",
    name: "Facebook Lead Ads",
    availability: "LIVE",
    note: "Connect your Page and lead-form submissions arrive automatically.",
    kind: "api",
  },
  {
    id: "indiamart",
    name: "IndiaMART",
    availability: "LIVE",
    note: "Official Leads API (push + pull). Needs your IndiaMART CRM key.",
    kind: "api",
  },
  {
    id: "whatsapp_enquiries",
    name: "WhatsApp enquiries",
    availability: "SETUP_ASSISTED",
    note: "We help you connect your WhatsApp Business number during onboarding.",
    kind: "api",
  },
  {
    id: "99acres",
    name: "99acres",
    availability: "IN_SETUP",
    note: "Enquiry alerts by SMS/email forwarding; setup assisted by our team.",
    kind: "forwarding",
  },
  {
    id: "magicbricks",
    name: "MagicBricks",
    availability: "IN_SETUP",
    note: "Enquiry alerts by SMS/email forwarding; setup assisted by our team.",
    kind: "forwarding",
  },
  {
    id: "housing",
    name: "Housing.com",
    availability: "IN_SETUP",
    note: "Enquiry alerts by SMS/email forwarding; setup assisted by our team.",
    kind: "forwarding",
  },
  {
    id: "justdial",
    name: "JustDial",
    availability: "IN_SETUP",
    note: "Enquiry alerts by SMS/email forwarding; setup assisted by our team.",
    kind: "forwarding",
  },
  {
    id: "email_forwarding",
    name: "Email forwarding",
    availability: "COMING_SOON",
    note: "Not open yet — we will announce it when it is verified.",
    kind: "forwarding",
  },
  {
    id: "sms_forwarding",
    name: "SMS forwarding",
    availability: "COMING_SOON",
    note: "Not open yet — we will announce it when it is verified.",
    kind: "forwarding",
  },
];

export const AVAILABILITY_LABEL: Record<IntegrationAvailability, string> = {
  LIVE: "Live",
  SETUP_ASSISTED: "Setup assisted",
  IN_SETUP: "In setup",
  COMING_SOON: "Coming soon",
};

/** Payload for GET /public/integrations and the generated frontend mirror. */
export function buildIntegrationsPayload() {
  return {
    version: 1,
    sources: INTEGRATION_STATUS.map((entry) => ({
      ...entry,
      label: AVAILABILITY_LABEL[entry.availability],
    })),
  };
}

/** Markdown table for the AI prompt ({{INTEGRATIONS_TABLE}}). */
export function integrationsTableMarkdown(): string {
  const rows = INTEGRATION_STATUS.map(
    (i) => `| ${i.name} | ${AVAILABILITY_LABEL[i.availability]} | ${i.note} |`
  );
  return ["| Lead source | Status | Notes |", "| --- | --- | --- |", ...rows].join("\n");
}

/** Internal status ids an admin guide may render. */
export function integrationById(id: string): IntegrationStatusEntry | undefined {
  return INTEGRATION_STATUS.find((i) => i.id === id);
}
