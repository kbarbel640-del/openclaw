import { createDedupeCache } from "../infra/dedupe.js";
import type { FileLockOptions } from "./file-lock.js";
import { withFileLock } from "./file-lock.js";
import { readJsonFileWithFallback, writeJsonFileAtomically } from "./json-store.js";

type PersistentDedupeData = Record<string, number>;

/**
 * @description Configuration options for a {@link PersistentDedupe} instance
 * created via {@link createPersistentDedupe}.
 */
export type PersistentDedupeOptions = {
  /**
   * How long (in milliseconds) a recorded key remains valid. Set to `0` to
   * keep entries indefinitely (until evicted by `fileMaxEntries`).
   */
  ttlMs: number;
  /** Maximum number of entries kept in the in-process memory cache. */
  memoryMaxSize: number;
  /**
   * Maximum number of entries written to the backing JSON file per namespace.
   * Older entries are evicted first when this limit is exceeded.
   */
  fileMaxEntries: number;
  /**
   * Returns the absolute file path for a given namespace string. Called once
   * per namespace on first disk access.
   */
  resolveFilePath: (namespace: string) => string;
  /** Optional overrides for the file-lock retry/staleness behavior. */
  lockOptions?: Partial<FileLockOptions>;
  /** Optional callback invoked when a disk I/O error occurs. */
  onDiskError?: (error: unknown) => void;
};

/**
 * @description Per-call options for {@link PersistentDedupe.checkAndRecord}.
 */
export type PersistentDedupeCheckOptions = {
  /**
   * Namespace that scopes the key. Defaults to `"global"`. Use separate
   * namespaces to dedupe the same key in different contexts (e.g. per-account).
   */
  namespace?: string;
  /** Override the current timestamp (ms since epoch); defaults to `Date.now()`. */
  now?: number;
  /** Per-call disk-error handler that overrides the instance-level handler. */
  onDiskError?: (error: unknown) => void;
};

/**
 * @description A two-layer (memory + disk) deduplication handle returned by
 * {@link createPersistentDedupe}.
 */
export type PersistentDedupe = {
  /**
   * Checks whether `key` has been seen recently and records it if not.
   * Returns `true` when the key is **new** (safe to process), `false` when it
   * is a **duplicate** (should be skipped). Concurrent calls for the same
   * scoped key are coalesced — only one disk write occurs.
   *
   * @param key - Deduplication key (e.g. a message ID).
   * @param options - Optional namespace, timestamp override, and error handler.
   */
  checkAndRecord: (key: string, options?: PersistentDedupeCheckOptions) => Promise<boolean>;
  /** Clears all in-memory cached entries without touching the disk store. */
  clearMemory: () => void;
  /** Returns the current number of entries in the in-memory cache. */
  memorySize: () => number;
};

const DEFAULT_LOCK_OPTIONS: FileLockOptions = {
  retries: {
    retries: 6,
    factor: 1.35,
    minTimeout: 8,
    maxTimeout: 180,
    randomize: true,
  },
  stale: 60_000,
};

function mergeLockOptions(overrides?: Partial<FileLockOptions>): FileLockOptions {
  return {
    stale: overrides?.stale ?? DEFAULT_LOCK_OPTIONS.stale,
    retries: {
      retries: overrides?.retries?.retries ?? DEFAULT_LOCK_OPTIONS.retries.retries,
      factor: overrides?.retries?.factor ?? DEFAULT_LOCK_OPTIONS.retries.factor,
      minTimeout: overrides?.retries?.minTimeout ?? DEFAULT_LOCK_OPTIONS.retries.minTimeout,
      maxTimeout: overrides?.retries?.maxTimeout ?? DEFAULT_LOCK_OPTIONS.retries.maxTimeout,
      randomize: overrides?.retries?.randomize ?? DEFAULT_LOCK_OPTIONS.retries.randomize,
    },
  };
}

function sanitizeData(value: unknown): PersistentDedupeData {
  if (!value || typeof value !== "object") {
    return {};
  }
  const out: PersistentDedupeData = {};
  for (const [key, ts] of Object.entries(value as Record<string, unknown>)) {
    if (typeof ts === "number" && Number.isFinite(ts) && ts > 0) {
      out[key] = ts;
    }
  }
  return out;
}

function pruneData(
  data: PersistentDedupeData,
  now: number,
  ttlMs: number,
  maxEntries: number,
): void {
  if (ttlMs > 0) {
    for (const [key, ts] of Object.entries(data)) {
      if (now - ts >= ttlMs) {
        delete data[key];
      }
    }
  }

  const keys = Object.keys(data);
  if (keys.length <= maxEntries) {
    return;
  }

  keys
    .toSorted((a, b) => data[a] - data[b])
    .slice(0, keys.length - maxEntries)
    .forEach((key) => {
      delete data[key];
    });
}

/**
 * @description Creates a two-layer deduplication store that combines an
 * in-process LRU/TTL memory cache with a file-backed JSON store to survive
 * process restarts. Use it to prevent duplicate processing of inbound messages
 * (e.g. webhook replays or polling double-delivery).
 *
 * - **Memory layer** — fast O(1) lookup, bounded by `options.memoryMaxSize`.
 * - **Disk layer** — persisted to a JSON file guarded by a file lock.  Entries
 *   older than `options.ttlMs` are pruned on each write; the file is capped at
 *   `options.fileMaxEntries`.
 *
 * @param options - Configuration for TTL, cache sizes, file path resolver, and
 *   error handling. See {@link PersistentDedupeOptions}.
 * @returns A {@link PersistentDedupe} instance.
 *
 * @example
 * ```ts
 * const dedupe = createPersistentDedupe({
 *   ttlMs: 60_000,
 *   memoryMaxSize: 1000,
 *   fileMaxEntries: 5000,
 *   resolveFilePath: (ns) => `/data/dedupe-${ns}.json`,
 * });
 *
 * const isNew = await dedupe.checkAndRecord(messageId, { namespace: accountId });
 * if (!isNew) return; // duplicate – skip
 * ```
 */
export function createPersistentDedupe(options: PersistentDedupeOptions): PersistentDedupe {
  const ttlMs = Math.max(0, Math.floor(options.ttlMs));
  const memoryMaxSize = Math.max(0, Math.floor(options.memoryMaxSize));
  const fileMaxEntries = Math.max(1, Math.floor(options.fileMaxEntries));
  const lockOptions = mergeLockOptions(options.lockOptions);
  const memory = createDedupeCache({ ttlMs, maxSize: memoryMaxSize });
  const inflight = new Map<string, Promise<boolean>>();

  async function checkAndRecordInner(
    key: string,
    namespace: string,
    scopedKey: string,
    now: number,
    onDiskError?: (error: unknown) => void,
  ): Promise<boolean> {
    if (memory.check(scopedKey, now)) {
      return false;
    }

    const path = options.resolveFilePath(namespace);
    try {
      const duplicate = await withFileLock(path, lockOptions, async () => {
        const { value } = await readJsonFileWithFallback<PersistentDedupeData>(path, {});
        const data = sanitizeData(value);
        const seenAt = data[key];
        const isRecent = seenAt != null && (ttlMs <= 0 || now - seenAt < ttlMs);
        if (isRecent) {
          return true;
        }
        data[key] = now;
        pruneData(data, now, ttlMs, fileMaxEntries);
        await writeJsonFileAtomically(path, data);
        return false;
      });
      return !duplicate;
    } catch (error) {
      onDiskError?.(error);
      return true;
    }
  }

  async function checkAndRecord(
    key: string,
    dedupeOptions?: PersistentDedupeCheckOptions,
  ): Promise<boolean> {
    const trimmed = key.trim();
    if (!trimmed) {
      return true;
    }
    const namespace = dedupeOptions?.namespace?.trim() || "global";
    const scopedKey = `${namespace}:${trimmed}`;
    if (inflight.has(scopedKey)) {
      return false;
    }

    const onDiskError = dedupeOptions?.onDiskError ?? options.onDiskError;
    const now = dedupeOptions?.now ?? Date.now();
    const work = checkAndRecordInner(trimmed, namespace, scopedKey, now, onDiskError);
    inflight.set(scopedKey, work);
    try {
      return await work;
    } finally {
      inflight.delete(scopedKey);
    }
  }

  return {
    checkAndRecord,
    clearMemory: () => memory.clear(),
    memorySize: () => memory.size(),
  };
}
