import { createHash } from "node:crypto";

const DEDUP_WINDOW_MS = 30_000; // 30 seconds

type InFlightEntry = {
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  expiresAt: number;
};

const inFlight = new Map<string, InFlightEntry>();

// ---------------------------------------------------------------------------
// Generate dedup key from request content
// ---------------------------------------------------------------------------

export function makeDedupKey(model: string, messages: unknown[], temperature?: number): string {
  const hash = createHash("sha256");
  hash.update(`dedup:${model}`);
  hash.update(JSON.stringify(messages));
  if (temperature !== undefined) {
    hash.update(String(temperature));
  }
  return hash.digest("hex");
}

// ---------------------------------------------------------------------------
// Check if an identical request is already in-flight
// ---------------------------------------------------------------------------

export function isInFlight(key: string): boolean {
  const entry = inFlight.get(key);
  if (!entry) {
    return false;
  }
  if (Date.now() > entry.expiresAt) {
    inFlight.delete(key);
    return false;
  }
  return true;
}

// Wait for an in-flight request to complete
export function waitForInFlight<T = unknown>(key: string): Promise<T> | undefined {
  const entry = inFlight.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    inFlight.delete(key);
    return undefined;
  }
  return entry.promise as Promise<T>;
}

// Register a new in-flight request
export function registerInFlight(key: string): {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: unknown) => void;
  let reject!: (error: unknown) => void;

  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  inFlight.set(key, {
    promise,
    resolve,
    reject,
    expiresAt: Date.now() + DEDUP_WINDOW_MS,
  });

  return { resolve, reject };
}

// Complete an in-flight request (resolves all waiters)
export function completeInFlight(key: string, result: unknown): void {
  const entry = inFlight.get(key);
  if (entry) {
    entry.resolve(result);
    inFlight.delete(key);
  }
}

// Fail an in-flight request (rejects all waiters)
export function failInFlight(key: string, error: unknown): void {
  const entry = inFlight.get(key);
  if (entry) {
    entry.reject(error);
    inFlight.delete(key);
  }
}

export function clearInFlight(): void {
  for (const entry of inFlight.values()) {
    entry.reject(new Error("ClawBack shutting down"));
  }
  inFlight.clear();
}
