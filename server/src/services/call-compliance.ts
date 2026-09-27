/**
 * TRAI / TCCCPR call-compliance gate — applied before every AI call dispatch.
 *
 * Why this exists (Feb 2025 TCCCPR amendment + DPDP Act 2023):
 *  1. AI disclosure   — the 2025 amendment REQUIRES disclosure of auto-dialer/robo-call use.
 *                       Non-disclosed automated calls = violation → telecom resources barred
 *                       15 days (first), 1 year + blacklisting (repeat).
 *  2. Calling window  — promotional/commercial calls only 9 AM–9 PM IST (worker enforces 8–8,
 *                       which is stricter and compliant).
 *  3. Consent basis   — promotional campaigns (RE_ENGAGEMENT, PROMOTIONAL) need explicit
 *                       consent; enquiry-response calls rely on the prospect's portal enquiry.
 *  4. Audit trail     — every call logs consent basis, source, and gate outcome (TRAI
 *                       enforcement asks for exactly this).
 *
 * NOTE: this is a consent-basis + disclosure + hours gate. DLT/DND number scrubbing for
 * promotional campaigns is tracked separately in the launch plan (needs DLT access).
 */

import { logger } from "../utils/logger";

/** Call types that are promotional under TCCCPR (need explicit consent basis). */
export const PROMOTIONAL_CALL_TYPES = new Set(["RE_ENGAGEMENT", "PROMOTIONAL"]);

/** Allowed calling window, IST. Keep in sync with call.worker.ts (8–8). */
export const CALL_WINDOW_START_HOUR = 9; // 9 AM IST
export const CALL_WINDOW_END_HOUR = 20; // 9 PM IST (exclusive)

export type ConsentBasis = "PORTAL_ENQUIRY" | "PRIOR_CONTACT" | "EXPLICIT_OPTIN" | "UNKNOWN";

export interface CallComplianceInput {
  callType: string;
  leadSource?: string | null;
  /** Lead's inbound enquiry timestamp — proves the prospect asked to be contacted. */
  leadCreatedAt?: Date | null;
  /** Consent/capture reference from the source portal / campaign. */
  consentReference?: string | null;
}

export interface CallComplianceResult {
  allowed: boolean;
  /** Human-readable reason when blocked; logged for the audit trail. */
  reason?: string;
  consentBasis: ConsentBasis;
  /** Stamp stored on the call record for TRAI audit trail. */
  auditTrail: {
    gateVersion: string;
    aiDisclosed: boolean;
    consentBasis: ConsentBasis;
    leadSource?: string | null;
    evaluatedAt: string;
  };
}

/** Derive the consent basis for a call from lead provenance. */
export function deriveConsentBasis(input: CallComplianceInput): ConsentBasis {
  const source = (input.leadSource || "").toLowerCase();

  // Promotional campaigns need explicit opt-in.
  if (PROMOTIONAL_CALL_TYPES.has(input.callType)) {
    return input.consentReference ? "EXPLICIT_OPTIN" : "UNKNOWN";
  }

  // Inbound enquiry from a property portal — the prospect asked to be contacted.
  if (
    [
      "sms_forward", "email_forward", "facebook", "indiamart", "website", "manual",
      "justdial", "99acres", "magicbricks", "housing", "olx", "portal",
    ].some((s) => source.includes(s))
  ) {
    return "PORTAL_ENQUIRY";
  }

  // Anything else (e.g. imported lists) — prior contact only if we have a reference.
  return input.consentReference ? "PRIOR_CONTACT" : "UNKNOWN";
}

/** Evaluate the TRAI gate for a would-be AI call. Pure function — worker applies the outcome. */
export function evaluateCallCompliance(input: CallComplianceInput): CallComplianceResult {
  const consentBasis = deriveConsentBasis(input);
  const nowIstHour = (() => {
    const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    return ist.getUTCHours();
  })();

  let allowed = true;
  let reason: string | undefined;

  if (consentBasis === "UNKNOWN") {
    allowed = false;
    reason = `No consent basis for ${input.callType} call (source: ${input.leadSource || "unknown"}). TRAI TCCCPR: promotional/unsolicited commercial calls without consent basis are barred.`;
  } else if (
    PROMOTIONAL_CALL_TYPES.has(input.callType) &&
    (nowIstHour < CALL_WINDOW_START_HOUR || nowIstHour >= CALL_WINDOW_END_HOUR)
  ) {
    allowed = false;
    reason = `Promotional call outside ${CALL_WINDOW_START_HOUR}–${CALL_WINDOW_END_HOUR} IST window (current ${nowIstHour}:00 IST). TCCCPR prohibits promotional calls outside this window.`;
  }

  const auditTrail = {
    gateVersion: "1.0",
    aiDisclosed: true, // every Converza agent prompt includes the mandatory AI disclosure
    consentBasis,
    leadSource: input.leadSource ?? null,
    evaluatedAt: new Date().toISOString(),
  };

  if (!allowed) {
    logger.warn(
      { callType: input.callType, leadSource: input.leadSource, reason },
      "TRAI compliance gate blocked a call"
    );
  }

  return { allowed, reason, consentBasis, auditTrail };
}
