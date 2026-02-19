import type { OpenClawConfig } from "../config/config.js";
import type { ResolvedQmdConfig } from "./backend-config.js";
import type {
  MemoryEmbeddingProbeResult,
  MemorySearchManager,
  MemorySyncProgressUpdate,
} from "./types.js";
import { resolveAgentWorkspaceDir } from "../agents/agent-scope.js";
import { resolveBrainTieredConfig } from "../config/types.brain-tiered.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveMemoryBackendConfig } from "./backend-config.js";

const log = createSubsystemLogger("memory");
const QMD_MANAGER_CACHE = new Map<string, MemorySearchManager>();
const BRAIN_TIERED_CACHE = new Map<string, MemorySearchManager>();

export type MemorySearchManagerResult = {
  manager: MemorySearchManager | null;
  error?: string;
};

export async function getMemorySearchManager(params: {
  cfg: OpenClawConfig;
  agentId: string;
}): Promise<MemorySearchManagerResult> {
  const resolved = resolveMemoryBackendConfig(params);

  // Handle brain-tiered backend
  if (resolved.backend === "brain-tiered") {
    const brainTieredConfig = params.cfg.memory?.brainTiered;
    if (brainTieredConfig) {
      // Per-agent workspace ID: check agent config first, fall back to global config
      const agentEntry = params.cfg.agents?.list?.find((a) => a.id === params.agentId);
      const effectiveWorkspaceId = agentEntry?.brainWorkspaceId ?? brainTieredConfig.workspaceId;
      const cacheKey = `brain-tiered:${params.agentId}:${effectiveWorkspaceId}`;
      const cached = BRAIN_TIERED_CACHE.get(cacheKey);
      if (cached) {
        return { manager: cached };
      }
      try {
        const workspaceDir = resolveAgentWorkspaceDir(params.cfg, params.agentId);
        const mergedConfig =
          effectiveWorkspaceId !== brainTieredConfig.workspaceId
            ? { ...brainTieredConfig, workspaceId: effectiveWorkspaceId }
            : brainTieredConfig;
        const resolvedBrainConfig = resolveBrainTieredConfig(mergedConfig, workspaceDir);
        const { BrainTieredManager } = await import("./brain-tiered-manager.js");
        const primary = await BrainTieredManager.create(resolvedBrainConfig);

        // Wrap with fallback to builtin
        const wrapper = new FallbackMemoryManager(
          {
            primary,
            fallbackFactory: async () => {
              const { MemoryIndexManager } = await import("./manager.js");
              return await MemoryIndexManager.get(params);
            },
          },
          () => BRAIN_TIERED_CACHE.delete(cacheKey),
        );
        BRAIN_TIERED_CACHE.set(cacheKey, wrapper);
        return { manager: wrapper };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn(`brain-tiered memory unavailable; falling back to builtin: ${message}`);
      }
    } else {
      log.warn(
        "brain-tiered backend selected but brainTiered config missing; falling back to builtin",
      );
    }
  }

  // Handle qmd backend
  if (resolved.backend === "qmd" && resolved.qmd) {
    const cacheKey = buildQmdCacheKey(params.agentId, resolved.qmd);
    const cached = QMD_MANAGER_CACHE.get(cacheKey);
    if (cached) {
      return { manager: cached };
    }
    try {
      const { QmdMemoryManager } = await import("./qmd-manager.js");
      const primary = await QmdMemoryManager.create({
        cfg: params.cfg,
        agentId: params.agentId,
        resolved,
      });
      if (primary) {
        const wrapper = new FallbackMemoryManager(
          {
            primary,
            fallbackFactory: async () => {
              const { MemoryIndexManager } = await import("./manager.js");
              return await MemoryIndexManager.get(params);
            },
          },
          () => QMD_MANAGER_CACHE.delete(cacheKey),
        );
        QMD_MANAGER_CACHE.set(cacheKey, wrapper);
        return { manager: wrapper };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn(`qmd memory unavailable; falling back to builtin: ${message}`);
    }
  }

  // Fallback to builtin backend
  try {
    const { MemoryIndexManager } = await import("./manager.js");
    const manager = await MemoryIndexManager.get(params);
    return { manager };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { manager: null, error: message };
  }
}

class FallbackMemoryManager implements MemorySearchManager {
  private fallback: MemorySearchManager | null = null;
  private primaryFailed = false;
  private primaryFailedAt = 0;
  private lastError?: string;

  /** Retry primary after 60s instead of permanently falling back. */
  private static readonly PRIMARY_RETRY_MS = 60_000;

  constructor(
    private readonly deps: {
      primary: MemorySearchManager;
      fallbackFactory: () => Promise<MemorySearchManager | null>;
    },
    private readonly onClose?: () => void,
  ) {}

  private shouldRetryPrimary(): boolean {
    return (
      this.primaryFailed &&
      Date.now() - this.primaryFailedAt >= FallbackMemoryManager.PRIMARY_RETRY_MS
    );
  }

  async search(
    query: string,
    opts?: { maxResults?: number; minScore?: number; sessionKey?: string },
  ) {
    if (!this.primaryFailed || this.shouldRetryPrimary()) {
      try {
        const results = await this.deps.primary.search(query, opts);
        if (this.primaryFailed) {
          log.info("primary memory recovered after transient failure");
          this.primaryFailed = false;
        }
        return results;
      } catch (err) {
        this.primaryFailed = true;
        this.primaryFailedAt = Date.now();
        this.lastError = err instanceof Error ? err.message : String(err);
        log.warn(`primary memory failed; using fallback: ${this.lastError}`);
      }
    }
    const fallback = await this.ensureFallback();
    if (fallback) {
      return await fallback.search(query, opts);
    }
    throw new Error(this.lastError ?? "memory search unavailable");
  }

  async readFile(params: { relPath: string; from?: number; lines?: number }) {
    if (!this.primaryFailed || this.shouldRetryPrimary()) {
      try {
        const result = await this.deps.primary.readFile(params);
        if (this.primaryFailed) {
          this.primaryFailed = false;
        }
        return result;
      } catch (err) {
        this.primaryFailed = true;
        this.primaryFailedAt = Date.now();
        this.lastError = err instanceof Error ? err.message : String(err);
      }
    }
    const fallback = await this.ensureFallback();
    if (fallback) {
      return await fallback.readFile(params);
    }
    throw new Error(this.lastError ?? "memory read unavailable");
  }

  status() {
    if (!this.primaryFailed || this.shouldRetryPrimary()) {
      return this.deps.primary.status();
    }
    const fallbackStatus = this.fallback?.status();
    const fallbackInfo = { from: "qmd", reason: this.lastError ?? "unknown" };
    if (fallbackStatus) {
      const custom = fallbackStatus.custom ?? {};
      return {
        ...fallbackStatus,
        fallback: fallbackInfo,
        custom: {
          ...custom,
          fallback: { disabled: true, reason: this.lastError ?? "unknown" },
        },
      };
    }
    const primaryStatus = this.deps.primary.status();
    const custom = primaryStatus.custom ?? {};
    return {
      ...primaryStatus,
      fallback: fallbackInfo,
      custom: {
        ...custom,
        fallback: { disabled: true, reason: this.lastError ?? "unknown" },
      },
    };
  }

  async sync(params?: {
    reason?: string;
    force?: boolean;
    progress?: (update: MemorySyncProgressUpdate) => void;
  }) {
    if (!this.primaryFailed) {
      await this.deps.primary.sync?.(params);
      return;
    }
    const fallback = await this.ensureFallback();
    await fallback?.sync?.(params);
  }

  async probeEmbeddingAvailability(): Promise<MemoryEmbeddingProbeResult> {
    if (!this.primaryFailed) {
      return await this.deps.primary.probeEmbeddingAvailability();
    }
    const fallback = await this.ensureFallback();
    if (fallback) {
      return await fallback.probeEmbeddingAvailability();
    }
    return { ok: false, error: this.lastError ?? "memory embeddings unavailable" };
  }

  async probeVectorAvailability() {
    if (!this.primaryFailed) {
      return await this.deps.primary.probeVectorAvailability();
    }
    const fallback = await this.ensureFallback();
    return (await fallback?.probeVectorAvailability()) ?? false;
  }

  async close() {
    await this.deps.primary.close?.();
    await this.fallback?.close?.();
    this.onClose?.();
  }

  private async ensureFallback(): Promise<MemorySearchManager | null> {
    if (this.fallback) {
      return this.fallback;
    }
    const fallback = await this.deps.fallbackFactory();
    if (!fallback) {
      log.warn("memory fallback requested but builtin index is unavailable");
      return null;
    }
    this.fallback = fallback;
    return this.fallback;
  }
}

function buildQmdCacheKey(agentId: string, config: ResolvedQmdConfig): string {
  return `${agentId}:${stableSerialize(config)}`;
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }
  if (value && typeof value === "object") {
    const sortedEntries = Object.keys(value as Record<string, unknown>)
      .toSorted((a, b) => a.localeCompare(b))
      .map((key) => [key, sortValue((value as Record<string, unknown>)[key])]);
    return Object.fromEntries(sortedEntries);
  }
  return value;
}
