/**
 * Per-room send queue to ensure message ordering.
 *
 * Matrix orders messages by origin_server_ts. When multiple code paths
 * (auto-reply, message tool, media sends) fire concurrently, they race
 * and messages appear out of order. This queue serializes all sends
 * per room so they arrive in the order they were enqueued.
 *
 * See: https://github.com/openclaw/openclaw/issues/11614
 */

const queues = new Map<string, Promise<unknown>>();

/**
 * Enqueue a send operation for a specific room.
 * Each send waits for the previous one to complete before starting.
 * The 150ms gap ensures Matrix server assigns distinct timestamps.
 */
export async function enqueueSend<T>(roomId: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(roomId) ?? Promise.resolve();
  const SEND_GAP_MS = 150;

  const next = prev
    .catch(() => {}) // don't let previous failures block the queue
    .then(() => delay(SEND_GAP_MS))
    .then(() => fn());

  // Store the chain (void version) so next enqueue waits for this one
  queues.set(
    roomId,
    next.then(
      () => {},
      () => {},
    ),
  );

  // Clean up empty queues to prevent memory leak
  next.finally(() => {
    setTimeout(() => {
      const current = queues.get(roomId);
      if (current && isSettled(current)) {
        queues.delete(roomId);
      }
    }, 1000);
  });

  return next;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isSettled(p: Promise<unknown>): boolean {
  let settled = false;
  p.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  return settled;
}
