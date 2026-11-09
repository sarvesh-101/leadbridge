/**
 * V2 (T5) — calling-window helpers (pure, testable).
 *
 * Window is ALWAYS 09:00–21:00 IST (TRAI/TCCCPR), single-sourced from
 * config/plans.ts CALL_WINDOW. Never "24/7 calling" — marketing included.
 */
import { CALL_WINDOW, FAIR_USE_MINUTES_PER_LEAD, FIRST_CALL_DELAY_MINUTES } from "../config/plans";

export const IST_OFFSET_MINUTES = 330; // UTC+5:30

/** Current IST hour (0–23) for a given instant. */
export function istHour(d: Date = new Date()): number {
  return new Date(d.getTime() + IST_OFFSET_MINUTES * 60 * 1000).getUTCHours();
}

/** Inside 09:00–21:00 IST? (end-exclusive: 21:00 means "window is over"). */
export function isWithinCallingWindow(d: Date = new Date()): boolean {
  const h = istHour(d);
  return h >= CALL_WINDOW.startHour && h < CALL_WINDOW.endHour;
}

/** Next moment the window opens (today, or tomorrow if past window end). */
export function nextWindowStart(d: Date = new Date()): Date {
  const shifted = new Date(d.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const nextStart = new Date(shifted);
  nextStart.setUTCHours(CALL_WINDOW.startHour, 0, 0, 0);
  if (istHour(d) >= CALL_WINDOW.endHour) {
    nextStart.setUTCDate(nextStart.getUTCDate() + 1);
  }
  // Shift back out of IST offset to real UTC instant.
  return new Date(nextStart.getTime() - IST_OFFSET_MINUTES * 60 * 1000);
}

/**
 * Random jitter (0–30 min) applied when re-queuing out-of-window calls so the
 * queue doesn't stampede every lead at 09:00:00 sharp. Exported as a function
 * wrapper so tests can pin randomness.
 */
export function windowJitterMs(): number {
  // 1 ms .. 29m59.999s — strictly >0 (spreads the queue) and never past 30 min.
  return Math.floor(Math.random() * (30 * 60 * 1000 - 1)) + 1;
}

/**
 * V2 (T5): a human just shared their number — the AI never dials instantly.
 * First outbound attempt waits ≥ FIRST_CALL_DELAY_MINUTES after ingest.
 */
export function firstCallDelayMs(): number {
  void FAIR_USE_MINUTES_PER_LEAD; // keep imports doc-meaningful
  return FIRST_CALL_DELAY_MINUTES * 60 * 1000;
}

/**
 * V2 (T5): the moment the window is open for a lead received at `receivedAt`.
 * Inside the window that is the receipt time itself.
 */
export function windowOpenFor(receivedAt: Date): Date {
  return isWithinCallingWindow(receivedAt) ? receivedAt : nextWindowStart(receivedAt);
}

/**
 * V2 (T5) — firstCallDelaySeconds, measured from max(receivedAt, windowOpenAt)
 * as the doc defines it (a 3 AM lead is not "late"; the clock starts at 09:00).
 */
export function firstCallDelaySecondsFor(receivedAt: Date, firstCallAt: Date): number {
  const baseline = windowOpenFor(receivedAt).getTime();
  return Math.max(0, Math.round((firstCallAt.getTime() - baseline) / 1000));
}
