# Fix for Issue #29: QMD Eager Init Concurrency

## Changes

### 1. Concurrency De-duplication in search-manager.ts

Problem: Multiple concurrent calls to `getMemorySearchManager()` can each create a QmdMemoryManager.

Fix: Add in-flight promise cache to dedupe concurrent initialization.

### 2. Timer Ordering in qmd-manager.ts

Problem: Boot update runs before timer is armed. If boot update fails/times out, timer never gets armed.

Fix: Arm timer first, then run boot update.

## Implementation

### File: src/memory/search-manager.ts

```typescript
// Add in-flight promise cache
const QMD_MANAGER_INFLIGHT = new Map<string, Promise<MemorySearchManagerResult>>();

export async function getMemorySearchManager(params: {
  cfg: OpenClawConfig;
  agentId: string;
}): Promise<MemorySearchManagerResult> {
  const resolved = resolveMemoryBackendConfig(params);
  if (resolved.backend === "qmd" && resolved.qmd) {
    const cacheKey = buildQmdCacheKey(params.agentId, resolved.qmd);

    // Check in-flight first
    const inflight = QMD_MANAGER_INFLIGHT.get(cacheKey);
    if (inflight) {
      return await inflight;
    }

    // Check cache next
    const cached = QMD_MANAGER_CACHE.get(cacheKey);
    if (cached) {
      return { manager: cached };
    }

    // Start new initialization
    const initPromise = (async () => {
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
        // Failed to create primary, fall through to builtin
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn(`qmd memory unavailable; falling back to builtin: ${message}`);
      }

      // Builtin fallback
      try {
        const { MemoryIndexManager } = await import("./manager.js");
        const manager = await MemoryIndexManager.get(params);
        return { manager };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { manager: null, error: message };
      }
    })();

    QMD_MANAGER_INFLIGHT.set(cacheKey, initPromise);

    try {
      const result = await initPromise;
      return result;
    } finally {
      QMD_MANAGER_INFLIGHT.delete(cacheKey);
    }
  }

  // Builtin path
  // ... existing code
}
```

### File: src/memory/qmd-manager.ts

```typescript
private async initialize(): Promise<void> {
// ... existing collection setup ...

    // FIX: Arm timer BEFORE boot update
    // This ensures retries continue even if boot update fails
    if (this.qmd.update.intervalMs > 0) {
      this.updateTimer = setInterval(() => {
        void this.runUpdate("interval").catch((err) => {
          log.warn(`qmd update failed (${String(err)})`);
        });
      }, this.qmd.update.intervalMs);
    }

    // FIX: Boot update runs AFTER timer is armed
    if (this.qmd.update.onBoot) {
      const bootRun = this.runUpdate("boot", true);
      if (this.qmd.update.waitForBootSync) {
        await bootRun.catch((err) => {
          log.warn(`qmd boot update failed: ${String(err)}`);
        });
      } else {
        void bootRun.catch((err) => {
          log.warn(`qmd boot update failed: ${String(err)}`);
        });
      }
    }
}
```

## Testing

1. **Concurrency test**: Simulate 10 concurrent calls to getMemorySearchManager - only 1 QmdMemoryManager should be created
2. **Timer ordering test**: If boot update fails, verify timer still runs interval updates
