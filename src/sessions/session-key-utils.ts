export type ParsedAgentSessionKey = {
  agentId: string;
  rest: string;
};

export function parseAgentSessionKey(
  sessionKey: string | undefined | null,
): ParsedAgentSessionKey | null {
  const raw = (sessionKey ?? "").trim();
  if (!raw) {
    return null;
  }
  const parts = raw.split(":").filter(Boolean);
  if (parts.length < 3) {
    return null;
  }
  if (parts[0] !== "agent") {
    return null;
  }
  const agentId = parts[1]?.trim();
  const rest = parts.slice(2).join(":");
  if (!agentId || !rest) {
    return null;
  }
  return { agentId, rest };
}

export function isCronRunSessionKey(sessionKey: string | undefined | null): boolean {
  const parsed = parseAgentSessionKey(sessionKey);
  if (!parsed) {
    return false;
  }
  return /^cron:[^:]+:run:[^:]+$/.test(parsed.rest);
}

export function isSubagentSessionKey(sessionKey: string | undefined | null): boolean {
  const raw = (sessionKey ?? "").trim();
  if (!raw) {
    return false;
  }
  if (raw.toLowerCase().startsWith("subagent:")) {
    return true;
  }
  const parsed = parseAgentSessionKey(raw);
  return Boolean((parsed?.rest ?? "").toLowerCase().startsWith("subagent:"));
}

export function isAcpSessionKey(sessionKey: string | undefined | null): boolean {
  const raw = (sessionKey ?? "").trim();
  if (!raw) {
    return false;
  }
  const normalized = raw.toLowerCase();
  if (normalized.startsWith("acp:")) {
    return true;
  }
  const parsed = parseAgentSessionKey(raw);
  return Boolean((parsed?.rest ?? "").toLowerCase().startsWith("acp:"));
}

export function getSubagentDepth(sessionKey: string | undefined | null): number {
  const raw = (sessionKey ?? "").trim();
  if (!raw) {
    return 0;
  }
  const parsed = parseAgentSessionKey(raw);
  if (!parsed) {
    return 0;
  }
  const rest = parsed.rest.toLowerCase();
  if (!rest.startsWith("subagent:")) {
    return 0;
  }
  const parts = rest.split(":");
  let depth = 1;
  let i = 2;
  while (i + 1 < parts.length) {
    if (parts[i] === "sub") {
      depth++;
      i += 2;
    } else {
      break;
    }
  }
  return depth;
}

export function getParentSubagentKey(sessionKey: string | undefined | null): string | null {
  const raw = (sessionKey ?? "").trim();
  if (!raw) {
    return null;
  }
  const depth = getSubagentDepth(raw);
  if (depth === 0) {
    return null;
  }
  if (depth === 1) {
    const parsed = parseAgentSessionKey(raw);
    if (!parsed) {
      return null;
    }
    return `agent:${parsed.agentId}:main`;
  }
  const lastSubIdx = raw.lastIndexOf(":sub:");
  if (lastSubIdx <= 0) {
    return null;
  }
  return raw.substring(0, lastSubIdx);
}

const THREAD_SESSION_MARKERS = [":thread:", ":topic:"];

export function resolveThreadParentSessionKey(
  sessionKey: string | undefined | null,
): string | null {
  const raw = (sessionKey ?? "").trim();
  if (!raw) {
    return null;
  }
  const normalized = raw.toLowerCase();
  let idx = -1;
  for (const marker of THREAD_SESSION_MARKERS) {
    const candidate = normalized.lastIndexOf(marker);
    if (candidate > idx) {
      idx = candidate;
    }
  }
  if (idx <= 0) {
    return null;
  }
  const parent = raw.slice(0, idx).trim();
  return parent ? parent : null;
}
