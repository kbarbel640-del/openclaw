import type { Skill } from "@mariozechner/pi-coding-agent";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { SkillEntry, SkillSnapshot } from "./types.js";

const log = createSubsystemLogger("skills/protocol");

export const SKILL_PROTOCOL_VERSION = 2;

export type SkillProtocolHeader = {
  version: number;
  encoding: "json" | "msgpack";
  compressed: boolean;
  checksum: string;
  createdAt: number;
  expiresAt?: number;
  workspaceHash: string;
  configHash: string;
};

export type SkillProtocolMessage<T = unknown> = {
  header: SkillProtocolHeader;
  payload: T;
  metadata: {
    skillCount: number;
    totalBytes: number;
    buildTimeMs: number;
  };
};

export type SkillProtocolCacheEntry<T = unknown> = {
  key: string;
  message: SkillProtocolMessage<T>;
  hits: number;
  lastHitAt: number;
  createdAt: number;
};

export type SkillProtocolConfig = {
  cacheMaxSize?: number;
  cacheTtlMs?: number;
  enableCompression?: boolean;
  workspaceHashSalt?: string;
};

const DEFAULT_PROTOCOL_CONFIG: Required<SkillProtocolConfig> = {
  cacheMaxSize: 50,
  cacheTtlMs: 5 * 60_000,
  enableCompression: false,
  workspaceHashSalt: "openclaw-skill-protocol-v1",
};

let protocolConfig = DEFAULT_PROTOCOL_CONFIG;
const cache = new Map<string, SkillProtocolCacheEntry>();
const pendingRequests = new Map<string, Promise<SkillProtocolMessage>>();

export function configureSkillProtocol(newConfig: SkillProtocolConfig): void {
  protocolConfig = { ...DEFAULT_PROTOCOL_CONFIG, ...newConfig };
}

export function computeWorkspaceHash(workspaceDir: string, configHash?: string): string {
  const input = `${workspaceDir}:${configHash ?? "default"}:${protocolConfig.workspaceHashSalt}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export function computeSkillHash(skills: SkillEntry[]): string {
  const data = skills
    .map((s) => `${s.skill.name}:${s.skill.description ?? ""}:${s.skill.filePath ?? ""}`)
    .sort()
    .join("|");
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function computeChecksum(payload: unknown): string {
  const json = JSON.stringify(payload);
  let hash = 5381;
  for (let i = 0; i < json.length; i++) {
    hash = (hash * 33) ^ json.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function createSkillProtocolMessage<T>(
  payload: T,
  context: {
    workspaceDir: string;
    configHash?: string;
    buildTimeMs: number;
  },
): SkillProtocolMessage<T> {
  const workspaceHash = computeWorkspaceHash(context.workspaceDir, context.configHash);
  const checksum = computeChecksum(payload);
  const now = Date.now();

  const payloadBytes = JSON.stringify(payload).length;

  const header: SkillProtocolHeader = {
    version: SKILL_PROTOCOL_VERSION,
    encoding: "json",
    compressed: protocolConfig.enableCompression,
    checksum,
    createdAt: now,
    expiresAt: now + protocolConfig.cacheTtlMs,
    workspaceHash,
    configHash: context.configHash ?? "default",
  };

  return {
    header,
    payload,
    metadata: {
      skillCount: Array.isArray(payload) ? payload.length : 1,
      totalBytes: payloadBytes,
      buildTimeMs: context.buildTimeMs,
    },
  };
}

export function validateProtocolMessage<T>(message: SkillProtocolMessage<T>): {
  valid: boolean;
  reason?: string;
} {
  if (message.header.version > SKILL_PROTOCOL_VERSION) {
    return { valid: false, reason: `unsupported protocol version: ${message.header.version}` };
  }

  const expectedChecksum = computeChecksum(message.payload);
  if (message.header.checksum !== expectedChecksum) {
    return { valid: false, reason: "checksum mismatch" };
  }

  if (message.header.expiresAt && Date.now() > message.header.expiresAt) {
    return { valid: false, reason: "message expired" };
  }

  return { valid: true };
}

export function cacheKey(workspaceDir: string, skillFilter?: string[]): string {
  const filter = skillFilter?.sort().join(",") ?? "*";
  return `${workspaceDir}:${filter}`;
}

export function getFromCache<T>(key: string): SkillProtocolMessage<T> | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  const validation = validateProtocolMessage(entry.message);
  if (!validation.valid) {
    cache.delete(key);
    log.debug(`Cache entry invalidated: ${key} - ${validation.reason}`);
    return null;
  }

  entry.hits += 1;
  entry.lastHitAt = Date.now();

  return entry.message as SkillProtocolMessage<T>;
}

export function setCache<T>(key: string, message: SkillProtocolMessage<T>): void {
  if (cache.size >= protocolConfig.cacheMaxSize) {
    const evictCount = Math.max(1, Math.floor(protocolConfig.cacheMaxSize * 0.2));
    evictOldestEntries(evictCount);
  }

  const entry: SkillProtocolCacheEntry<T> = {
    key,
    message,
    hits: 0,
    lastHitAt: Date.now(),
    createdAt: Date.now(),
  };

  cache.set(key, entry);
}

function evictOldestEntries(count: number): void {
  const entries = [...cache.entries()]
    .sort((a, b) => a[1].lastHitAt - b[1].lastHitAt)
    .slice(0, count);

  for (const [key] of entries) {
    cache.delete(key);
  }

  log.debug(`Evicted ${entries.length} cache entries`);
}

export function invalidateCache(key: string): boolean {
  return cache.delete(key);
}

export function invalidateCachePattern(pattern: string): number {
  let removed = 0;
  const regex = new RegExp(pattern.replace(/\*/g, ".*"));

  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
      removed += 1;
    }
  }

  return removed;
}

export function clearCache(): void {
  cache.clear();
}

export function getCacheStats(): {
  size: number;
  maxSize: number;
  hitRate: number;
  totalHits: number;
  avgAgeMs: number;
} {
  let totalHits = 0;
  let totalAge = 0;
  const now = Date.now();

  for (const entry of cache.values()) {
    totalHits += entry.hits;
    totalAge += now - entry.createdAt;
  }

  return {
    size: cache.size,
    maxSize: protocolConfig.cacheMaxSize,
    hitRate: cache.size > 0 ? totalHits / cache.size : 0,
    totalHits,
    avgAgeMs: cache.size > 0 ? totalAge / cache.size : 0,
  };
}

export type SkillResolutionRequest = {
  workspaceDir: string;
  configHash?: string;
  skillFilter?: string[];
  forceRefresh?: boolean;
};

export type SkillResolutionResult = {
  message: SkillProtocolMessage<SkillSnapshot>;
  fromCache: boolean;
  buildTimeMs: number;
};

export async function resolveSkillWithCache(
  request: SkillResolutionRequest,
  builder: () => Promise<SkillSnapshot>,
): Promise<SkillResolutionResult> {
  const key = cacheKey(request.workspaceDir, request.skillFilter);

  if (!request.forceRefresh) {
    const cached = getFromCache<SkillSnapshot>(key);
    if (cached) {
      log.debug(`Skill cache hit: ${key}`);
      return {
        message: cached,
        fromCache: true,
        buildTimeMs: 0,
      };
    }
  }

  const pending = pendingRequests.get(key);
  if (pending) {
    log.debug(`Awaiting pending skill build: ${key}`);
    const message = (await pending) as SkillProtocolMessage<SkillSnapshot>;
    return {
      message,
      fromCache: false,
      buildTimeMs: message.metadata.buildTimeMs,
    };
  }

  const buildPromise = (async () => {
    const startTime = Date.now();
    const snapshot = await builder();
    const buildTimeMs = Date.now() - startTime;

    const message = createSkillProtocolMessage(snapshot, {
      workspaceDir: request.workspaceDir,
      configHash: request.configHash,
      buildTimeMs,
    });

    setCache(key, message);
    pendingRequests.delete(key);

    log.debug(
      `Built skill protocol: ${key} skills=${message.metadata.skillCount} time=${buildTimeMs}ms`,
    );

    return message;
  })();

  pendingRequests.set(key, buildPromise);

  try {
    const message = await buildPromise;
    return {
      message,
      fromCache: false,
      buildTimeMs: message.metadata.buildTimeMs,
    };
  } catch (error) {
    pendingRequests.delete(key);
    throw error;
  }
}

export type SkillDelta = {
  added: string[];
  removed: string[];
  modified: string[];
};

export function computeSkillDelta(previous: SkillEntry[], current: SkillEntry[]): SkillDelta {
  const prevNames = new Set(previous.map((s) => s.skill.name));
  const currNames = new Set(current.map((s) => s.skill.name));

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  for (const name of currNames) {
    if (!prevNames.has(name)) {
      added.push(name);
    }
  }

  for (const name of prevNames) {
    if (!currNames.has(name)) {
      removed.push(name);
    }
  }

  const prevByName = new Map(previous.map((s) => [s.skill.name, s]));
  const currByName = new Map(current.map((s) => [s.skill.name, s]));

  for (const name of currNames) {
    if (prevNames.has(name)) {
      const prev = prevByName.get(name);
      const curr = currByName.get(name);
      if (prev && curr) {
        const prevHash = computeSkillHash([prev]);
        const currHash = computeSkillHash([curr]);
        if (prevHash !== currHash) {
          modified.push(name);
        }
      }
    }
  }

  return { added, removed, modified };
}

export type SerializedSkillProtocol = {
  version: number;
  header: SkillProtocolHeader;
  payloadJson: string;
};

export function serializeForTransport<T>(
  message: SkillProtocolMessage<T>,
): SerializedSkillProtocol {
  return {
    version: SKILL_PROTOCOL_VERSION,
    header: message.header,
    payloadJson: JSON.stringify(message.payload),
  };
}

export function deserializeFromTransport<T>(
  serialized: SerializedSkillProtocol,
): SkillProtocolMessage<T> {
  const payload = JSON.parse(serialized.payloadJson) as T;
  return {
    header: serialized.header,
    payload,
    metadata: {
      skillCount: Array.isArray(payload) ? payload.length : 1,
      totalBytes: serialized.payloadJson.length,
      buildTimeMs: 0,
    },
  };
}

export function createSkillProtocolHandler(): {
  handle: (
    request: SkillResolutionRequest,
    builder: () => Promise<SkillSnapshot>,
  ) => Promise<SkillResolutionResult>;
  invalidate: (pattern: string) => number;
  stats: () => ReturnType<typeof getCacheStats>;
} {
  return {
    handle: resolveSkillWithCache,
    invalidate: invalidateCachePattern,
    stats: getCacheStats,
  };
}
