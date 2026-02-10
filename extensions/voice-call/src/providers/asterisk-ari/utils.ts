import crypto from "node:crypto";
import type { NormalizedEvent } from "../../types.js";

export function nowMs(): number {
  return Date.now();
}

export function buildEndpoint(to: string, trunk?: string): string {
  if (to.includes("/")) {
    return to;
  }
  const t = trunk?.trim();
  return t ? `PJSIP/${t}/${to}` : `PJSIP/${to}`;
}

export function makeEvent(partial: Omit<NormalizedEvent, "id" | "timestamp">): NormalizedEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: nowMs(),
    ...partial,
  } as NormalizedEvent;
}
