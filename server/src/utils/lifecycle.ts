/**
 * Lead Lifecycle State Machine.
 *
 * Every lead has a status field that can only move forward (or to COLD).
 * These are the ONLY valid transitions. Enforced at the service layer.
 *
 * Status flow:
 * PENDING → CALLING (AI call in progress)
 *   → CALL_FAILED (exotel error, retry)
 *   → NO_ANSWER (rang, no pickup, retry queue)
 *   → FAQ_ONLY (answered FAQs, no booking)
 *   → BOOKED (appointment confirmed in call)
 *   → COLD (explicitly not interested)
 *
 * BOOKED → REMINDED (booking-day reminder sent)
 * REMINDED → VISITED (customer showed up)
 *          → NO_SHOW (didn't show)
 *
 * NO_SHOW → FOLLOWUP_D1 (day 1 follow-up call)
 *         → REBOOKED (re-engaged after no-show)
 *         → COLD (explicitly done)
 *
 * FOLLOWUP_D1 → FOLLOWUP_D2 (day 2 WhatsApp)
 *             → BOOKED (re-engaged)
 *             → COLD
 *
 * FOLLOWUP_D2 → FOLLOWUP_D3 (day 3 final call)
 *             → BOOKED (re-engaged)
 *             → COLD
 *
 * FOLLOWUP_D3 → REBOOKED (new booking made)
 *             → COLD (no response after 3 days)
 *
 * REBOOKED → REMINDED (back to booking flow)
 *
 * VISITED → CONVERTED (deal closed)
 *
 * COLD & CONVERTED are terminal states.
 */

export type LeadStatus =
  | "PENDING"
  | "CALLING"
  | "CALL_FAILED"
  | "NO_ANSWER"
  | "FAQ_ONLY"
  | "BOOKED"
  | "REMINDED"
  | "VISITED"
  | "NO_SHOW"
  | "FOLLOWUP_D1"
  | "FOLLOWUP_D2"
  | "FOLLOWUP_D3"
  | "REBOOKED"
  | "COLD"
  | "CONVERTED";

const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  PENDING: ["CALLING", "COLD"],
  CALLING: ["CALL_FAILED", "NO_ANSWER", "FAQ_ONLY", "BOOKED", "COLD"],
  CALL_FAILED: ["CALLING", "COLD"],
  NO_ANSWER: ["CALLING", "COLD"],
  FAQ_ONLY: ["BOOKED", "COLD"],
  BOOKED: ["REMINDED", "COLD"],
  REMINDED: ["VISITED", "NO_SHOW"],
  VISITED: ["CONVERTED"],
  NO_SHOW: ["FOLLOWUP_D1", "REBOOKED", "COLD"],
  FOLLOWUP_D1: ["FOLLOWUP_D2", "BOOKED", "COLD"],
  FOLLOWUP_D2: ["FOLLOWUP_D3", "BOOKED", "COLD"],
  FOLLOWUP_D3: ["REBOOKED", "COLD"],
  REBOOKED: ["REMINDED", "COLD"],
  COLD: [],
  CONVERTED: [],
};

const TERMINAL_STATES: LeadStatus[] = ["COLD", "CONVERTED"];

const CALLABLE_STATES: LeadStatus[] = [
  "PENDING", "NO_ANSWER", "CALL_FAILED", "NO_SHOW",
  "FOLLOWUP_D1", "FOLLOWUP_D3",
];

const BOOKABLE_STATES: LeadStatus[] = [
  "PENDING", "NO_ANSWER", "CALL_FAILED", "FAQ_ONLY",
  "NO_SHOW", "FOLLOWUP_D1", "FOLLOWUP_D2",
];

/**
 * Check if a state transition is valid.
 */
export function canTransition(from: string, to: string): boolean {
  const allowed = VALID_TRANSITIONS[from as LeadStatus];
  if (!allowed) return false;
  return allowed.includes(to as LeadStatus);
}

/**
 * Get all valid next states for a given current state.
 */
export function getValidTransitions(from: string): string[] {
  return VALID_TRANSITIONS[from as LeadStatus] || [];
}

/**
 * Check if a state is terminal.
 */
export function isTerminal(status: string): boolean {
  return TERMINAL_STATES.includes(status as LeadStatus);
}

/**
 * Check if a lead can be called in its current state.
 */
export function isCallable(status: string): boolean {
  return CALLABLE_STATES.includes(status as LeadStatus);
}

/**
 * Check if a lead can be booked in its current state.
 */
export function isBookable(status: string): boolean {
  return BOOKABLE_STATES.includes(status as LeadStatus);
}

/**
 * Check if the lead is in a follow-up state.
 */
export function isInFollowup(status: string): boolean {
  return ["NO_SHOW", "FOLLOWUP_D1", "FOLLOWUP_D2", "FOLLOWUP_D3"].includes(status);
}

/**
 * Validate and return the new status, or throw.
 */
export function validateTransition(from: string, to: string): LeadStatus {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid transition: ${from} → ${to}. ` +
      `Allowed transitions: [${getValidTransitions(from).join(", ")}]`
    );
  }
  return to as LeadStatus;
}

/**
 * Status display configuration for the frontend.
 */
export const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Waiting", color: "gray" },
  CALLING: { label: "Calling...", color: "blue" },
  CALL_FAILED: { label: "Call failed", color: "red" },
  NO_ANSWER: { label: "No answer", color: "amber" },
  FAQ_ONLY: { label: "FAQ only", color: "purple" },
  BOOKED: { label: "Visit booked", color: "green" },
  REMINDED: { label: "Reminded", color: "teal" },
  VISITED: { label: "Visited", color: "green" },
  NO_SHOW: { label: "No show", color: "red" },
  FOLLOWUP_D1: { label: "Follow-up D1", color: "amber" },
  FOLLOWUP_D2: { label: "Follow-up D2", color: "amber" },
  FOLLOWUP_D3: { label: "Follow-up D3", color: "amber" },
  REBOOKED: { label: "Rebooked", color: "green" },
  COLD: { label: "Cold", color: "gray" },
  CONVERTED: { label: "Converted", color: "green" },
};
