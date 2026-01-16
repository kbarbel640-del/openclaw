export type HeartbeatContextRuntimeValue = {
  isHeartbeat: boolean;
  mode?: "all" | "recent-messages" | "summarize-tools";
  maxMessages?: number;
  toolSummaryMaxChars?: number;
};

const REGISTRY = new WeakMap<object, HeartbeatContextRuntimeValue>();

export function setHeartbeatContextRuntime(
  sessionManager: unknown,
  value: HeartbeatContextRuntimeValue | null,
): void {
  if (!sessionManager || typeof sessionManager !== "object") {
    return;
  }

  const key = sessionManager as object;
  if (value === null) {
    REGISTRY.delete(key);
    return;
  }

  REGISTRY.set(key, value);
}

export function getHeartbeatContextRuntime(
  sessionManager: unknown,
): HeartbeatContextRuntimeValue | null {
  if (!sessionManager || typeof sessionManager !== "object") {
    return null;
  }

  return REGISTRY.get(sessionManager as object) ?? null;
}
