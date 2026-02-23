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
  const runtimeSessionId = normalizeText(params.meta?.runtimeSessionId);
  const backendSessionId = normalizeText(params.meta?.backendSessionId);
  const lines: string[] = [];
  if (runtimeSessionId) {
    lines.push(`inner session id: ${runtimeSessionId}`);
  }
  if (backendSessionId) {
    lines.push(`${backend} session id: ${backendSessionId}`);
  }
  return lines;
}
