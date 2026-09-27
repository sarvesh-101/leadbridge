/**
 * Supported AI agent languages for Converza voice agents.
 *
 * Backed by Omnidimension's multilingual platform (100+ languages — all major
 * Indian + international). Values are Omnidim dashboard display names: their
 * API requires each language as a display-name string exactly as it appears
 * in their language picker (unrecognized names are silently skipped).
 *
 * Source: https://omnidim.io/multilingual · https://docs.omnidim.io/docs/api-reference/agents/createAgent
 */

export interface AgentLanguage {
  /** Omnidim dashboard display name — the exact string sent to their API */
  omnidimName: string;
  /** Human label for the dashboard UI */
  label: string;
  /** BCP-47 code (best-effort; several Indian languages have no single code) */
  code?: string;
  region: "indian" | "international";
}

/** All languages Converza brokers can configure their AI agent to speak. */
export const SUPPORTED_AGENT_LANGUAGES: AgentLanguage[] = [
  // ─── Indian languages (Omnidim full support) ─────────────────────
  { omnidimName: "Hinglish", label: "Hinglish (Hindi + English)", region: "indian" },
  { omnidimName: "Hindi", label: "Hindi", code: "hi-IN", region: "indian" },
  { omnidimName: "English", label: "English", code: "en-IN", region: "indian" },
  { omnidimName: "Tamil", label: "Tamil", code: "ta-IN", region: "indian" },
  { omnidimName: "Telugu", label: "Telugu", code: "te-IN", region: "indian" },
  { omnidimName: "Bengali", label: "Bengali", code: "bn-IN", region: "indian" },
  { omnidimName: "Marathi", label: "Marathi", code: "mr-IN", region: "indian" },
  { omnidimName: "Gujarati", label: "Gujarati", code: "gu-IN", region: "indian" },
  { omnidimName: "Kannada", label: "Kannada", code: "kn-IN", region: "indian" },
  { omnidimName: "Malayalam", label: "Malayalam", code: "ml-IN", region: "indian" },
  { omnidimName: "Punjabi", label: "Punjabi", code: "pa-IN", region: "indian" },
  { omnidimName: "Odia", label: "Odia", region: "indian" },
  { omnidimName: "Urdu", label: "Urdu", region: "indian" },
  { omnidimName: "Assamese", label: "Assamese", region: "indian" },
  // ─── International (Omnidim 100+ language platform) ──────────────
  { omnidimName: "Spanish", label: "Spanish", code: "es-ES", region: "international" },
  { omnidimName: "French", label: "French", code: "fr-FR", region: "international" },
  { omnidimName: "German", label: "German", code: "de-DE", region: "international" },
  { omnidimName: "Mandarin", label: "Mandarin Chinese", region: "international" },
  { omnidimName: "Arabic", label: "Arabic", region: "international" },
  { omnidimName: "Portuguese", label: "Portuguese", region: "international" },
  { omnidimName: "Russian", label: "Russian", region: "international" },
  { omnidimName: "Japanese", label: "Japanese", region: "international" },
  { omnidimName: "English (US)", label: "English (US)", code: "en-US", region: "international" },
];

/** Default agent languages (legacy `language` values map into this). */
export const DEFAULT_AGENT_LANGUAGES = ["Hinglish", "English"];

/**
 * Map legacy/DB language values (`hinglish`, `hi-IN`, …) to Omnidim display names.
 * Keeps pre-existing Client.language data working with the new multilingual flow.
 */
export function toOmnidimLanguageNames(values: (string | null | undefined)[]): string[] {
  const names: string[] = [];
  for (const raw of values) {
    if (!raw) continue;
    const v = raw.trim();
    if (!v) continue;

    // Exact display-name match (case-insensitive)
    const direct = SUPPORTED_AGENT_LANGUAGES.find(
      (l) => l.omnidimName.toLowerCase() === v.toLowerCase()
    );
    if (direct) {
      names.push(direct.omnidimName);
      continue;
    }

    // Legacy code match (`hi-IN`, `en-IN`, …) or legacy value (`hinglish`)
    const byCode = SUPPORTED_AGENT_LANGUAGES.find(
      (l) => l.code?.toLowerCase() === v.toLowerCase()
    );
    if (byCode) {
      names.push(byCode.omnidimName);
      continue;
    }
    if (v.toLowerCase() === "hinglish") {
      names.push("Hinglish");
      continue;
    }
    if (v.toLowerCase().startsWith("en")) {
      names.push("English");
      continue;
    }
    if (v.toLowerCase().startsWith("hi")) {
      names.push("Hindi");
      continue;
    }
    // Unknown value — send it through verbatim; Omnidim skips unrecognized names.
    names.push(v);
  }
  return [...new Set(names)];
}

/** Narrowed list exposed to the frontend dashboard picker. */
export const AGENT_LANGUAGE_OPTIONS = SUPPORTED_AGENT_LANGUAGES.map(
  ({ omnidimName, label, region }) => ({ value: omnidimName, label, region })
);
