import type { CronServiceState } from "./state.js";

const storeLocks = new Map<string, Promise<void>>();

const resolveChain = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    () => undefined,
  );

export async function locked<T>(state: CronServiceState, fn: () => Promise<T>): Promise<T> {
  const storePath = state.deps.storePath;
  const storeOp = storeLocks.get(storePath) ?? Promise.resolve();
  const next = Promise.all([resolveChain(state.op), resolveChain(storeOp)]).then(fn);

  // Keep the chain alive even when the operation fails.
  const keepAlive = resolveChain(next);
  state.op = keepAlive;
  storeLocks.set(storePath, keepAlive);

  return (await next) as T;
}

/**
 * Try to acquire the lock within `timeoutMs`.  If the lock is held for
 * longer (e.g. a long-running job execution), run `fn` immediately without
 * waiting — safe for **read-only** operations that don't mutate state.
 *
 * BUG-026: When 9 catch-up jobs fire at once, the single locked() block in
 * onTimer holds the lock for 10+ minutes.  status() and list() queue
 * behind it and the 60s client timeout fires.  This helper lets read-only
 * calls bypass the stalled lock.
 */
export async function lockedWithTimeout<T>(
  state: CronServiceState,
  fn: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const storePath = state.deps.storePath;
  const storeOp = storeLocks.get(storePath) ?? Promise.resolve();

  // Race the lock acquisition against a timeout.
  const lockReady = Promise.all([resolveChain(state.op), resolveChain(storeOp)]);
  const winner = await Promise.race([
    lockReady.then(() => "acquired" as const),
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), timeoutMs)),
  ]);

  if (winner === "acquired") {
    // Got the lock normally — proceed as usual.
    const next = lockReady.then(fn);
    const keepAlive = resolveChain(next);
    state.op = keepAlive;
    storeLocks.set(storePath, keepAlive);
    return (await next) as T;
  }

  // Lock timed out — run the read-only callback immediately.
  // We do NOT update state.op or storeLocks because we're not actually
  // holding the lock.  This is safe for read-only operations.
  state.deps.log.warn(
    { timeoutMs, storePath },
    "cron: lock acquisition timed out, running read-only operation without lock",
  );
  return await fn();
}
