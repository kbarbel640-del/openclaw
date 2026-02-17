import { getChannelPlugin, normalizeChannelId } from "../../channels/plugins/index.js";
import type { ChannelId } from "../../channels/plugins/types.js";

export function normalizeChannelTargetInput(raw: string): string {
  return raw.trim();
}

export function normalizeTargetForProvider(provider: string, raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  const providerId = normalizeChannelId(provider);
  const plugin = providerId ? getChannelPlugin(providerId) : undefined;
  const normalized = readNormalizedTarget(plugin?.messaging?.normalizeTarget?.(raw)) ?? raw.trim();
  return normalized || undefined;
}

function readNormalizedTarget(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const targetObj = value as { to?: unknown; target?: unknown; ok?: unknown };
  if ("ok" in targetObj && targetObj.ok === false) {
    return undefined;
  }
  const candidate = typeof targetObj.to === "string" ? targetObj.to : targetObj.target;
  if (typeof candidate !== "string") {
    return undefined;
  }
  const trimmed = candidate.trim();
  return trimmed || undefined;
}

export function buildTargetResolverSignature(channel: ChannelId): string {
  const plugin = getChannelPlugin(channel);
  const resolver = plugin?.messaging?.targetResolver;
  const hint = resolver?.hint ?? "";
  const looksLike = resolver?.looksLikeId;
  const source = looksLike ? looksLike.toString() : "";
  return hashSignature(`${hint}|${source}`);
}

function hashSignature(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}
