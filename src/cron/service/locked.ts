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

  // When a cron job is executing (e.g. runIsolatedAgentJob), skip the promise
  // chain to prevent deadlock.  The executing job may call back into the cron
  // service (e.g. agent calling cron.add) which would otherwise wait forever
  // for the timer's locked() to release — but the timer is waiting for the
  // job to finish, creating a circular dependency.
  // Safety: Node.js is single-threaded; concurrent mutation can only interleave
  // at await points.  The in-memory store is shared, and persist() uses atomic
  // writes, so skipping the chain here does not risk corruption.
  const skipChain = state.executingJob;
  const opChain = skipChain ? Promise.resolve() : resolveChain(state.op);
  const storeChain = skipChain ? Promise.resolve() : resolveChain(storeOp);
  const next = Promise.all([opChain, storeChain]).then(fn);

  // Keep the chain alive even when the operation fails.
  const keepAlive = resolveChain(next);
  state.op = keepAlive;
  storeLocks.set(storePath, keepAlive);

  return (await next) as T;
}
