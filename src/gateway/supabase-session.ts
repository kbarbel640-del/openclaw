const USER_SCOPE_PREFIX = "webchat:user:";

/**
 * Normalize a bare session key to the canonical `agent:{agentId}:{rest}` format.
 */
function normalizeSessionKey(key: string): string {
  if (key.startsWith("agent:")) {
    return key;
  }
  return `agent:main:${key}`;
}

/**
 * Rewrite a session key to include user scope.
 * "agent:main:main" -> "agent:main:webchat:user:{userId}:main"
 * "main" -> "agent:main:webchat:user:{userId}:main"
 */
export function scopeSessionKeyToUser(key: string, userId: string): string {
  const normalized = normalizeSessionKey(key);
  // Parse: agent:{agentId}:{rest}
  const firstColon = normalized.indexOf(":");
  const secondColon = normalized.indexOf(":", firstColon + 1);
  if (firstColon === -1 || secondColon === -1) {
    // Unexpected format; scope defensively
    return `${normalized}:${USER_SCOPE_PREFIX}${userId}`;
  }
  const prefix = normalized.slice(0, secondColon + 1); // "agent:main:"
  const rest = normalized.slice(secondColon + 1); // "main"
  return `${prefix}${USER_SCOPE_PREFIX}${userId}:${rest}`;
}

/**
 * Check if a session key contains a user scope.
 */
export function isUserScopedSessionKey(key: string): boolean {
  return key.includes(USER_SCOPE_PREFIX);
}

/**
 * Extract the userId from a user-scoped session key, or null if not scoped.
 */
export function extractUserIdFromSessionKey(key: string): string | null {
  const idx = key.indexOf(USER_SCOPE_PREFIX);
  if (idx === -1) {
    return null;
  }
  const afterPrefix = key.slice(idx + USER_SCOPE_PREFIX.length);
  const colonIdx = afterPrefix.indexOf(":");
  if (colonIdx === -1) {
    return afterPrefix || null;
  }
  return afterPrefix.slice(0, colonIdx) || null;
}
