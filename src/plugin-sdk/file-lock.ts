import fs from "node:fs/promises";
import path from "node:path";
import { isPidAlive } from "../shared/pid-alive.js";
import { resolveProcessScopedMap } from "../shared/process-scoped-map.js";

/**
 * @description Configuration options for acquiring a file lock.
 */
export type FileLockOptions = {
  /**
   * Retry configuration for acquiring the lock. Uses an exponential-backoff
   * strategy with optional jitter.
   */
  retries: {
    /** Total number of retry attempts after the first failure. */
    retries: number;
    /** Exponential back-off factor applied between retry attempts. */
    factor: number;
    /** Minimum delay in milliseconds between retries. */
    minTimeout: number;
    /** Maximum delay in milliseconds between retries. */
    maxTimeout: number;
    /** When true, adds random jitter to each computed delay. */
    randomize?: boolean;
  };
  /**
   * Number of milliseconds after which a lock is considered stale and may be
   * forcibly removed by a competing caller.
   */
  stale: number;
};

type LockFilePayload = {
  pid: number;
  createdAt: string;
};

type HeldLock = {
  count: number;
  handle: fs.FileHandle;
  lockPath: string;
};

const HELD_LOCKS_KEY = Symbol.for("openclaw.fileLockHeldLocks");
const HELD_LOCKS = resolveProcessScopedMap<HeldLock>(HELD_LOCKS_KEY);

function computeDelayMs(retries: FileLockOptions["retries"], attempt: number): number {
  const base = Math.min(
    retries.maxTimeout,
    Math.max(retries.minTimeout, retries.minTimeout * retries.factor ** attempt),
  );
  const jitter = retries.randomize ? 1 + Math.random() : 1;
  return Math.min(retries.maxTimeout, Math.round(base * jitter));
}

async function readLockPayload(lockPath: string): Promise<LockFilePayload | null> {
  try {
    const raw = await fs.readFile(lockPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LockFilePayload>;
    if (typeof parsed.pid !== "number" || typeof parsed.createdAt !== "string") {
      return null;
    }
    return { pid: parsed.pid, createdAt: parsed.createdAt };
  } catch {
    return null;
  }
}

async function resolveNormalizedFilePath(filePath: string): Promise<string> {
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);
  await fs.mkdir(dir, { recursive: true });
  try {
    const realDir = await fs.realpath(dir);
    return path.join(realDir, path.basename(resolved));
  } catch {
    return resolved;
  }
}

async function isStaleLock(lockPath: string, staleMs: number): Promise<boolean> {
  const payload = await readLockPayload(lockPath);
  if (payload?.pid && !isPidAlive(payload.pid)) {
    return true;
  }
  if (payload?.createdAt) {
    const createdAt = Date.parse(payload.createdAt);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > staleMs) {
      return true;
    }
  }
  try {
    const stat = await fs.stat(lockPath);
    return Date.now() - stat.mtimeMs > staleMs;
  } catch {
    return true;
  }
}

/**
 * @description A handle returned after successfully acquiring a file lock.
 */
export type FileLockHandle = {
  /** Absolute path of the `.lock` file that was created. */
  lockPath: string;
  /**
   * Releases the lock. When the same process holds re-entrant locks, the
   * underlying lock file is only removed after the outermost `release()` call.
   */
  release: () => Promise<void>;
};

async function releaseHeldLock(normalizedFile: string): Promise<void> {
  const current = HELD_LOCKS.get(normalizedFile);
  if (!current) {
    return;
  }
  current.count -= 1;
  if (current.count > 0) {
    return;
  }
  HELD_LOCKS.delete(normalizedFile);
  await current.handle.close().catch(() => undefined);
  await fs.rm(current.lockPath, { force: true }).catch(() => undefined);
}

/**
 * @description Acquires an exclusive file lock by creating a sibling `.lock`
 * file next to `filePath`. Supports re-entrant acquisition within the same
 * process: if the lock is already held, the call increments a reference count
 * and returns immediately. Stale locks (owner PID dead or past `options.stale`
 * ms) are automatically removed before retrying.
 *
 * @param filePath - Path to the file that should be locked. A corresponding
 *   `<filePath>.lock` file is used as the mutex.
 * @param options - Retry and staleness configuration.
 * @returns A {@link FileLockHandle} whose `release()` must be called when done.
 * @throws {Error} If all retry attempts are exhausted without acquiring the lock.
 *
 * @example
 * ```ts
 * const lock = await acquireFileLock("/data/store.json", opts);
 * try {
 *   // exclusive access
 * } finally {
 *   await lock.release();
 * }
 * ```
 */
export async function acquireFileLock(
  filePath: string,
  options: FileLockOptions,
): Promise<FileLockHandle> {
  const normalizedFile = await resolveNormalizedFilePath(filePath);
  const lockPath = `${normalizedFile}.lock`;
  const held = HELD_LOCKS.get(normalizedFile);
  if (held) {
    held.count += 1;
    return {
      lockPath,
      release: () => releaseHeldLock(normalizedFile),
    };
  }

  const attempts = Math.max(1, options.retries.retries + 1);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const handle = await fs.open(lockPath, "wx");
      await handle.writeFile(
        JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }, null, 2),
        "utf8",
      );
      HELD_LOCKS.set(normalizedFile, { count: 1, handle, lockPath });
      return {
        lockPath,
        release: () => releaseHeldLock(normalizedFile),
      };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "EEXIST") {
        throw err;
      }
      if (await isStaleLock(lockPath, options.stale)) {
        await fs.rm(lockPath, { force: true }).catch(() => undefined);
        continue;
      }
      if (attempt >= attempts - 1) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, computeDelayMs(options.retries, attempt)));
    }
  }

  throw new Error(`file lock timeout for ${normalizedFile}`);
}

/**
 * @description Acquires a file lock, runs an async callback, then releases the
 * lock — even if the callback throws. This is the preferred alternative to
 * manually calling `acquireFileLock` / `release()`.
 *
 * @param filePath - Path to the file that should be locked.
 * @param options - Retry and staleness configuration (see {@link FileLockOptions}).
 * @param fn - Async callback executed while the lock is held.
 * @returns The resolved value of `fn`.
 * @throws Propagates any error thrown by `fn` or by lock acquisition.
 *
 * @example
 * ```ts
 * const result = await withFileLock("/data/store.json", opts, async () => {
 *   const data = await readJsonFileWithFallback("/data/store.json", {});
 *   await writeJsonFileAtomically("/data/store.json", { ...data, updated: true });
 *   return data;
 * });
 * ```
 */
export async function withFileLock<T>(
  filePath: string,
  options: FileLockOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const lock = await acquireFileLock(filePath, options);
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
