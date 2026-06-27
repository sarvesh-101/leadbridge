/**
 * Retry Delay Utility — single source of truth for all retry timing.
 *
 * Previously duplicated in 4 places (exotel webhook, omnidimension webhook,
 * call worker, webhook-retry worker). Now consolidated here.
 *
 * Usage:
 *   import { getRetryDelay, shouldRetry } from "../utils/retry-delay";
 *
 *   if (shouldRetry(currentAttempt, maxAttempts)) {
 *     const delay = getRetryDelay(currentAttempt);
 *     await enqueueCall({ ... }, delay);
 *   }
 */

/** Default max call attempts across the system */
export const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Get the retry delay in milliseconds based on attempt number.
 * Uses exponential backoff: 2h → 4h → (no more retries after max)
 *
 * @param attemptCount - The number of attempts already made (0-indexed)
 * @returns Delay in milliseconds
 */
export function getRetryDelay(attemptCount: number): number {
  if (attemptCount <= 1) {
    return 2 * 60 * 60 * 1000; // 2 hours
  }
  return 4 * 60 * 60 * 1000; // 4 hours
}

/**
 * Check whether another retry should be attempted.
 *
 * @param attemptCount - The number of attempts already made (0-indexed)
 * @param maxAttempts - Maximum allowed attempts (default: 3)
 * @returns true if another attempt should be scheduled
 */
export function shouldRetry(
  attemptCount: number,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS
): boolean {
  return attemptCount < maxAttempts;
}

/**
 * Get the remaining attempts count.
 *
 * @param attemptCount - The number of attempts already made (0-indexed)
 * @param maxAttempts - Maximum allowed attempts (default: 3)
 * @returns Number of retries remaining
 */
export function remainingAttempts(
  attemptCount: number,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS
): number {
  return Math.max(0, maxAttempts - attemptCount);
}
