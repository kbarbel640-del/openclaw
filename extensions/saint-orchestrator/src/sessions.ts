import type { ResolvedTier, SaintToolContext, SessionTierState } from "./types.js";
import { SESSION_TIER_TTL_MS } from "./constants.js";
import { normalizeId, resolveWorkspaceDir, uniqueStrings } from "./normalize.js";
import { resolveTierForContext } from "./tiers.js";

const sessionTierCache = new Map<string, SessionTierState>();

export function extractSessionTier(sessionKey?: string): SessionTierState | null {
  if (!sessionKey) {
    return null;
  }
  const cached = sessionTierCache.get(sessionKey);
  if (!cached) {
    return null;
  }
  if (Date.now() - cached.updatedAtMs > SESSION_TIER_TTL_MS) {
    sessionTierCache.delete(sessionKey);
    return null;
  }
  return cached;
}

export function setSessionTier(sessionKey: string | undefined, state: SessionTierState) {
  if (!sessionKey) {
    return;
  }
  sessionTierCache.set(sessionKey, state);
}

export function cleanupSessionTierCache(now: number): void {
  for (const [key, entry] of sessionTierCache) {
    if (now - entry.updatedAtMs > SESSION_TIER_TTL_MS) {
      sessionTierCache.delete(key);
    }
  }
}

export async function resolveTierForToolContext(ctx: SaintToolContext): Promise<ResolvedTier> {
  const workspaceDir = resolveWorkspaceDir(ctx);
  if (!workspaceDir) {
    throw new Error("workspace path unavailable");
  }

  const cached = extractSessionTier(ctx.sessionKey);
  if (cached && cached.workspaceDir === workspaceDir) {
    return cached.tier;
  }

  const tier = await resolveTierForContext({
    workspaceDir,
    messageProvider: ctx.messageChannel,
    peerId: ctx.peerId,
    senderE164: ctx.senderE164,
    sessionKey: ctx.sessionKey,
  });

  setSessionTier(ctx.sessionKey, {
    workspaceDir,
    peerId: ctx.peerId,
    senderE164: ctx.senderE164,
    tier,
    updatedAtMs: Date.now(),
  });

  return tier;
}

export function resolveTierFromHookContext(ctx: {
  sessionKey?: string;
  agentId?: string;
  peerId?: string;
  senderE164?: string;
}): SessionTierState | null {
  const bySession = extractSessionTier(ctx.sessionKey);
  if (bySession) {
    return bySession;
  }
  return null;
}

export function inferSessionOwnership(tier: ResolvedTier, sessionKey: string): boolean {
  if (tier.tierName === "owner") {
    return true;
  }
  const key = normalizeId(sessionKey);
  const slug = normalizeId(tier.contactSlug);
  if (!slug) {
    return false;
  }
  // Use delimiter-aware matching to prevent short slugs (e.g. "al") from
  // matching unrelated session keys (e.g. "alice-session", "general").
  // Session keys use ":" as the structural delimiter (e.g. "agent:main:direct:employee-john").
  // We split only on ":" since slugs themselves may contain "-", "_", etc.
  const parts = key.split(":");
  return parts.some((part) => part === slug);
}

export function filterSessionsPayloadByTier(params: {
  payload: Record<string, unknown>;
  tier: ResolvedTier;
}): Record<string, unknown> {
  if (params.tier.tierName === "owner" || params.tier.tier.sessions_scope === "all") {
    return params.payload;
  }

  const sessions = params.payload.sessions;
  if (Array.isArray(sessions)) {
    const filtered = sessions.filter((entry) => {
      if (!entry || typeof entry !== "object") {
        return false;
      }
      const key =
        typeof (entry as { key?: unknown }).key === "string" ? (entry as { key: string }).key : "";
      return inferSessionOwnership(params.tier, key);
    });
    return {
      ...params.payload,
      count: filtered.length,
      sessions: filtered,
    };
  }

  const sessionKey =
    typeof params.payload.sessionKey === "string" ? params.payload.sessionKey : undefined;
  if (sessionKey && !inferSessionOwnership(params.tier, sessionKey)) {
    return {
      status: "forbidden",
      error: `Session not visible for tier ${params.tier.tierName}`,
    };
  }

  return params.payload;
}

export function resolveBootstrapAllowlist(tier: ResolvedTier): Set<string> | null {
  if (tier.tierName === "owner") {
    return null;
  }
  const list = uniqueStrings(tier.tier.system_prompt_includes?.bootstrap);
  if (list.length === 0) {
    return new Set(["SOUL.md", "IDENTITY.md"]);
  }
  return new Set(list);
}
