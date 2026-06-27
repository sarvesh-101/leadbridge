/**
 * Circuit Breaker — prevents cascading failures when external services are down.
 *
 * Used primarily for Omnidimension. When repeated dispatch failures are detected,
 * the circuit "opens" and subsequent calls fail fast without hitting the API.
 * After a cooldown period, a single test request is allowed ("half-open").
 *
 * States:
 *   CLOSED  ─ Normal operation, requests pass through
 *   OPEN    ─ Fail fast, requests rejected immediately
 *   HALF_OPEN ─ Test request allowed, if it succeeds → CLOSED, if fails → OPEN
 *
 * Usage:
 *   import { circuitBreaker } from "../utils/circuit-breaker";
 *
 *   const result = await circuitBreaker.call("omnidimension", () => dispatchCall(params));
 */

import { logger } from "../utils/logger";

interface CircuitState {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
  cooldownUntil: number;
}

const circuits = new Map<string, CircuitState>();

const DEFAULTS = {
  /** Number of consecutive failures before circuit opens */
  THRESHOLD: 5,
  /** How long the circuit stays open before allowing a test (ms) */
  COOLDOWN_MS: 5 * 60 * 1000, // 5 minutes
  /** How many successes in HALF_OPEN state to close the circuit */
  HALF_OPEN_SUCCESSES: 2,
};

/**
 * Get or initialize circuit state for a service.
 */
function getCircuit(name: string): CircuitState {
  if (!circuits.has(name)) {
    circuits.set(name, {
      state: "CLOSED",
      failureCount: 0,
      lastFailureTime: 0,
      successCount: 0,
      cooldownUntil: 0,
    });
  }
  return circuits.get(name)!;
}

/**
 * Reset circuit state (e.g., after manual recovery or config change).
 */
export function resetCircuit(name: string): void {
  circuits.delete(name);
  logger.info({ service: name }, "Circuit breaker reset");
}

/**
 * Get current circuit state for monitoring/metrics.
 */
export function getCircuitState(name: string): {
  state: string;
  failureCount: number;
  cooldownRemainingMs: number;
} {
  const circuit = getCircuit(name);
  const cooldownRemaining = Math.max(0, circuit.cooldownUntil - Date.now());
  return {
    state: circuit.state,
    failureCount: circuit.failureCount,
    cooldownRemainingMs: cooldownRemaining,
  };
}

/**
 * Call a function with circuit breaker protection.
 *
 * @param serviceName - Name of the downstream service (e.g. "omnidimension")
 * @param fn - The async function to call
 * @param fallback - Optional fallback function if circuit is open
 * @returns The result of fn, or fallback if circuit is open
 */
export async function callWithCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>,
  fallback?: () => T | Promise<T>
): Promise<T> {
  const circuit = getCircuit(serviceName);
  const now = Date.now();

  // ─── Circuit is OPEN — check if cooldown elapsed ──────────────
  if (circuit.state === "OPEN") {
    if (now < circuit.cooldownUntil) {
      // Still in cooldown — fail fast
      if (fallback) return fallback();
      throw new Error(
        `Circuit breaker [${serviceName}] is OPEN. ` +
        `Cooling down for ${Math.round((circuit.cooldownUntil - now) / 1000)}s more.`
      );
    }

    // Cooldown elapsed — transition to HALF_OPEN
    circuit.state = "HALF_OPEN";
    circuit.successCount = 0;
    logger.info({ service: serviceName }, "Circuit breaker: OPEN → HALF_OPEN (cooldown elapsed)");
  }

  // ─── Attempt the call ─────────────────────────────────────────
  try {
    const result = await fn();

    // Success — update state based on current mode
    if (circuit.state === "HALF_OPEN") {
      circuit.successCount++;
      if (circuit.successCount >= DEFAULTS.HALF_OPEN_SUCCESSES) {
        circuit.state = "CLOSED";
        circuit.failureCount = 0;
        circuit.successCount = 0;
        logger.info({ service: serviceName }, "Circuit breaker: HALF_OPEN → CLOSED (recovered)");
      }
    } else {
      // CLOSED — reset failure count on success
      circuit.failureCount = 0;
    }

    return result;
  } catch (error: any) {
    // Failure — update circuit state
    circuit.failureCount++;
    circuit.lastFailureTime = now;

    if (circuit.state === "HALF_OPEN") {
      // Test failed — back to OPEN
      circuit.state = "OPEN";
      circuit.cooldownUntil = now + DEFAULTS.COOLDOWN_MS;
      logger.warn(
        { service: serviceName, failureCount: circuit.failureCount },
        "Circuit breaker: HALF_OPEN → OPEN (test call failed)"
      );
    } else if (circuit.failureCount >= DEFAULTS.THRESHOLD) {
      // Threshold crossed — open the circuit
      circuit.state = "OPEN";
      circuit.cooldownUntil = now + DEFAULTS.COOLDOWN_MS;
      logger.warn(
        { service: serviceName, failureCount: circuit.failureCount },
        `Circuit breaker: CLOSED → OPEN (${DEFAULTS.THRESHOLD} consecutive failures)`
      );
    }

    // If we have a fallback, use it
    if (fallback) return fallback();

    // Otherwise re-throw
    throw error;
  }
}
