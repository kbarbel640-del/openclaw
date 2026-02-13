/**
 * Circuit breaker for model provider API calls.
 * Prevents cascading latency when a provider is down by skipping it
 * temporarily after repeated failures.
 *
 * States:
 * - closed (normal): requests pass through, failures counted
 * - open (tripped): skip this provider immediately, go to fallback
 * - half-open (testing): allow one request through to test recovery
 */

export type CircuitBreakerConfig = {
  /** Number of consecutive failures before opening the circuit. Default: 5. */
  failureThreshold?: number;
  /** How long the circuit stays open before trying half-open (ms). Default: 60000 (1 min). */
  resetTimeoutMs?: number;
};

type CircuitState = "closed" | "open" | "half-open";

type ProviderCircuit = {
  state: CircuitState;
  failures: number;
  lastFailureAt: number;
  openedAt: number;
};

const circuits = new Map<string, ProviderCircuit>();

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_RESET_TIMEOUT_MS = 60_000;

function getOrCreate(providerId: string): ProviderCircuit {
  let circuit = circuits.get(providerId);
  if (!circuit) {
    circuit = { state: "closed", failures: 0, lastFailureAt: 0, openedAt: 0 };
    circuits.set(providerId, circuit);
  }
  return circuit;
}

/**
 * Check if a request to `providerId` should be allowed.
 * Returns true if the request can proceed, false if the circuit is open.
 */
export function isCircuitOpen(providerId: string, config?: CircuitBreakerConfig): boolean {
  const circuit = getOrCreate(providerId);
  const resetTimeout = config?.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS;

  if (circuit.state === "closed") {
    return false; // circuit closed = allow request
  }

  if (circuit.state === "open") {
    // Check if enough time has passed to try half-open.
    if (Date.now() - circuit.openedAt >= resetTimeout) {
      circuit.state = "half-open";
      return false; // allow one test request
    }
    return true; // circuit still open, skip this provider
  }

  // half-open: allow the test request
  return false;
}

/** Record a successful API call -- resets the circuit to closed. */
export function recordSuccess(providerId: string): void {
  const circuit = getOrCreate(providerId);
  circuit.state = "closed";
  circuit.failures = 0;
  circuit.lastFailureAt = 0;
  circuit.openedAt = 0;
}

/** Record a failed API call -- may open the circuit. */
export function recordFailure(providerId: string, config?: CircuitBreakerConfig): void {
  const circuit = getOrCreate(providerId);
  const threshold = config?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
  const now = Date.now();

  circuit.failures += 1;
  circuit.lastFailureAt = now;

  if (circuit.state === "half-open") {
    // Test request failed -- reopen the circuit.
    circuit.state = "open";
    circuit.openedAt = now;
    return;
  }

  if (circuit.failures >= threshold) {
    circuit.state = "open";
    circuit.openedAt = now;
  }
}

/** Get the current state of a provider's circuit (for logging/diagnostics). */
export function getCircuitState(providerId: string): { state: CircuitState; failures: number } {
  const circuit = circuits.get(providerId);
  if (!circuit) {
    return { state: "closed", failures: 0 };
  }
  return { state: circuit.state, failures: circuit.failures };
}

/** Reset all circuits (call on shutdown or config change). */
export function resetAllCircuits(): void {
  circuits.clear();
}
