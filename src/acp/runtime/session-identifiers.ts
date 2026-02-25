import type { SessionAcpIdentity, SessionAcpMeta } from "../../config/sessions/types.js";
import { isSessionIdentityPending, resolveSessionIdentityFromMeta } from "./session-identity.js";

export const ACP_SESSION_IDENTITY_RENDERER_VERSION = "v1";

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function resolveAcpSessionIdentifierLines(params: {
  sessionKey: string;
  meta?: SessionAcpMeta;
}): string[] {
  const backend = normalizeText(params.meta?.backend) ?? "backend";
  const identity = resolveSessionIdentityFromMeta(params.meta);
  return resolveAcpSessionIdentifierLinesFromIdentity({
    backend,
    identity,
  });
}

export function resolveAcpSessionIdentifierLinesFromIdentity(params: {
  backend: string;
  identity?: SessionAcpIdentity;
}): string[] {
  const backend = normalizeText(params.backend) ?? "backend";
  const identity = params.identity;
  const agentSessionId = normalizeText(identity?.agentSessionId);
  const acpxSessionId = normalizeText(identity?.acpxSessionId);
  const acpxRecordId = normalizeText(identity?.acpxRecordId);
  if (isSessionIdentityPending(identity) && (agentSessionId || acpxSessionId || acpxRecordId)) {
    return ["session ids: pending (available after the first reply)"];
  }
  const lines: string[] = [];
  if (agentSessionId) {
    lines.push(`agent session id: ${agentSessionId}`);
  }
  if (acpxSessionId) {
    lines.push(`${backend} session id: ${acpxSessionId}`);
  }
  if (acpxRecordId) {
    lines.push(`${backend} record id: ${acpxRecordId}`);
  }
  return lines;
}
