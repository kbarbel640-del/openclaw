import { createHmac, randomBytes } from "node:crypto";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const pending = new Map<string, number>();

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function generateState(secret: string): string {
  const nonce = randomBytes(16).toString("hex");
  const signature = sign(nonce, secret);
  const state = `${nonce}.${signature}`;
  pending.set(state, Date.now());
  return state;
}

export function consumeState(state: string, secret: string): boolean {
  const dotIdx = state.indexOf(".");
  if (dotIdx === -1) return false;

  const nonce = state.slice(0, dotIdx);
  const providedSig = state.slice(dotIdx + 1);
  const expectedSig = sign(nonce, secret);

  if (providedSig !== expectedSig) return false;

  const createdAt = pending.get(state);
  if (createdAt === undefined) return false;

  pending.delete(state);

  if (Date.now() - createdAt > STATE_TTL_MS) return false;

  return true;
}

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, createdAt] of pending) {
    if (now - createdAt > STATE_TTL_MS) {
      pending.delete(key);
    }
  }
}, 60_000).unref();
