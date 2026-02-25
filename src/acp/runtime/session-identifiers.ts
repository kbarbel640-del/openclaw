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
  const agentSessionId = normalizeText(params.meta?.agentSessionId);
  const backendSessionId = normalizeText(params.meta?.backendSessionId);
  const lines: string[] = [];
  if (agentSessionId) {
    lines.push(`inner session id: ${agentSessionId}`);
  }
  if (backendSessionId) {
    lines.push(`${backend} session id: ${backendSessionId}`);
  }
  return lines;
}
