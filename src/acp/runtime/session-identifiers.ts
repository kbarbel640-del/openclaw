import type { SessionAcpMeta } from "../../config/sessions/types.js";

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
  const provisional = params.meta?.sessionIdsProvisional === true;
  const agentSessionId = normalizeText(params.meta?.agentSessionId);
  const backendSessionId = normalizeText(params.meta?.backendSessionId);
  if (provisional && (agentSessionId || backendSessionId)) {
    return ["session ids: pending (available after the first reply)"];
  }
  const lines: string[] = [];
  if (agentSessionId) {
    lines.push(`agent session id: ${agentSessionId}`);
  }
  if (backendSessionId) {
    lines.push(`${backend} session id: ${backendSessionId}`);
  }
  return lines;
}
