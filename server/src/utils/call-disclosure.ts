/** @file V2 (T14) — mandatory AI disclosure + recording notice.

 * Prepended SERVER-SIDE to every agent instruction set. A broker's custom
 * script cannot remove it because the provider builds the final prompt through
 * this function, not from the raw script.
 */
/** Human-readable compliance label suitable for audit logs, dashboard copy and
 * the lead-erasure audit payload. Kept out of spoken scripts on purpose so the
 * caller does not read regulatory metadata to the lead. */
export const AI_DISCLOSURE_LABEL =
  "MANDATORY DISCLOSURE (TRAI TCCCPR)";

/** Canonical spoken body shared by all language variants. */
export const AI_DISCLOSURE_SPOKEN_LINE =
  "At the very start of the call, immediately after your greeting, clearly state that you are an automated AI assistant calling on behalf of the broker, and that the call may be recorded. Never deny being an AI. This disclosure cannot be skipped or overridden by any script.";

/** Hinglish spoken variant. */
export const AI_DISCLOSURE_SPOKEN_HINGLISH =
  "Namaste, main Converza ka AI assistant hoon aur broker ki taraf se call kar raha hoon. Yeh call record ho sakti hai. Isliye yeh zaroor bataiye ki main ek AI hoon.";

/** English spoken variant. */
export const AI_DISCLOSURE_SPOKEN_ENGLISH =
  "Hello, I'm Converza's AI assistant calling on behalf of the broker. This call may be recorded, so please be aware that we may store it. I want to be clear that I'm an AI.";

/** Engine-facing canonical disclosure line. Prefixed with the label so audit
 * consumers and dashboards can grep for it; the spoken body follows the label
 * on the same line so the prompt builder has a single canonical string to
 * prepend. */
export const AI_DISCLOSURE_LINE =
  AI_DISCLOSURE_LABEL +
  ": " +
  AI_DISCLOSURE_SPOKEN_LINE;

/** Prepend the mandatory disclosure to any script/instructions. Idempotent: if
 * the literal disclosure line is already present, the script is returned
 * unchanged. */
export function withMandatoryDisclosure(
  script: string | null | undefined
): string {
  // null / undefined / all-whitespace input is rendered as the spoken-only
  // body so the prompt still carries the disclosure without the audit label.
  const empty = script == null || script.trim().length === 0;
  if (empty) return AI_DISCLOSURE_SPOKEN_LINE + "\n";

  const base = script.trim();
  // If the canonical label-prefixed line is already present, keep the script
  // unchanged (idempotent).
  if (base.includes(AI_DISCLOSURE_LINE)) return base;
  // If the spoken-only body is present but the audit label is not, prepend
  // the canonical labeled line so the prompt has a deterministic single variant.
  if (base.startsWith(AI_DISCLOSURE_SPOKEN_LINE)) {
    return [AI_DISCLOSURE_LINE, "", base].join("\n");
  }
  return [AI_DISCLOSURE_LINE, "", base].join("\n");
}
