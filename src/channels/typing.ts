import { createTypingKeepaliveLoop } from "./typing-lifecycle.js";

export type TypingCallbacks = {
  onReplyStart: () => Promise<void>;
  onIdle?: () => void;
  /** Called when the typing controller is cleaned up (e.g., on NO_REPLY). */
  onCleanup?: () => void;
};

export function createTypingCallbacks(params: {
  start: () => Promise<void>;
  stop?: () => Promise<void>;
  onStartError: (err: unknown) => void;
  onStopError?: (err: unknown) => void;
  keepaliveIntervalMs?: number;
  /**
   * Failsafe: automatically stop keepalive after this duration if no idle/cleanup arrives.
   * Prevents stuck typing indicators when a channel path misses cleanup.
   */
  maxKeepaliveMs?: number;
}): TypingCallbacks {
  const stop = params.stop;
  const keepaliveIntervalMs = params.keepaliveIntervalMs ?? 3_000;
  const maxKeepaliveMs = params.maxKeepaliveMs ?? 120_000;
  let stopSent = false;
  let closed = false;
  let failsafeTimer: ReturnType<typeof setTimeout> | undefined;

  const fireStart = async () => {
    if (closed) {
      return;
    }
    try {
      await params.start();
    } catch (err) {
      params.onStartError(err);
    }
  };

  const keepaliveLoop = createTypingKeepaliveLoop({
    intervalMs: keepaliveIntervalMs,
    onTick: fireStart,
  });

  const armFailsafe = () => {
    if (maxKeepaliveMs <= 0) {
      return;
    }
    if (failsafeTimer) {
      clearTimeout(failsafeTimer);
    }
    failsafeTimer = setTimeout(() => {
      // Don’t close the callback entirely; just stop this run’s keepalive.
      keepaliveLoop.stop();
      if (!stop || stopSent) {
        return;
      }
      stopSent = true;
      void stop().catch((err) => (params.onStopError ?? params.onStartError)(err));
    }, maxKeepaliveMs);
  };

  const onReplyStart = async () => {
    if (closed) {
      return;
    }
    stopSent = false;
    keepaliveLoop.stop();
    await fireStart();
    keepaliveLoop.start();
    armFailsafe();
  };

  const fireStop = () => {
    closed = true;
    keepaliveLoop.stop();
    if (failsafeTimer) {
      clearTimeout(failsafeTimer);
      failsafeTimer = undefined;
    }
    if (!stop || stopSent) {
      return;
    }
    stopSent = true;
    void stop().catch((err) => (params.onStopError ?? params.onStartError)(err));
  };

  return { onReplyStart, onIdle: fireStop, onCleanup: fireStop };
}
