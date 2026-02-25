// Per-chat debounce manager.
// Maintains an in-memory map of conversation timers (not messages — those live in SQLite).

export type DebounceCallback = (conversationId: string) => void;

export type DebounceManager = {
  /** Reset (or start) the debounce timer for a conversation */
  touch: (conversationId: string) => void;
  /** Cancel the timer for a single conversation */
  cancel: (conversationId: string) => void;
  /** Cancel all pending timers */
  cleanup: () => void;
};

/**
 * Create a debounce manager that fires `callback` after `delayMs` of silence
 * per conversation. Each call to `touch` resets that conversation's timer.
 */
export function createDebounceManager(
  delayMs: number,
  callback: DebounceCallback,
): DebounceManager {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function touch(conversationId: string): void {
    // Clear existing timer for this conversation
    const existing = timers.get(conversationId);
    if (existing !== undefined) {
      clearTimeout(existing);
    }

    // Start a new timer
    const timer = setTimeout(() => {
      timers.delete(conversationId);
      callback(conversationId);
    }, delayMs);

    timers.set(conversationId, timer);
  }

  function cancel(conversationId: string): void {
    const timer = timers.get(conversationId);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.delete(conversationId);
    }
  }

  function cleanup(): void {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
  }

  return { touch, cancel, cleanup };
}
