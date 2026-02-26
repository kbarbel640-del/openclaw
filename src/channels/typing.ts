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
  /** Stop the keepalive loop after this many consecutive start() failures. */
  maxConsecutiveFailures?: number;
}): TypingCallbacks {
  const stop = params.stop;
  const keepaliveIntervalMs = params.keepaliveIntervalMs ?? 3_000;
  const maxConsecutiveFailures = params.maxConsecutiveFailures ?? 2;
  let stopSent = false;
  let consecutiveFailures = 0;

  const fireStart = async () => {
    try {
      await params.start();
      consecutiveFailures = 0;
    } catch (err) {
      consecutiveFailures++;
      params.onStartError(err);
      if (consecutiveFailures >= maxConsecutiveFailures) {
        keepaliveLoop.stop();
      }
    }
  };

  const keepaliveLoop = createTypingKeepaliveLoop({
    intervalMs: keepaliveIntervalMs,
    onTick: fireStart,
  });

  const onReplyStart = async () => {
    stopSent = false;
    consecutiveFailures = 0;
    keepaliveLoop.stop();
    await fireStart();
    keepaliveLoop.start();
  };

  const fireStop = () => {
    keepaliveLoop.stop();
    if (!stop || stopSent) {
      return;
    }
    stopSent = true;
    void stop().catch((err) => (params.onStopError ?? params.onStartError)(err));
  };

  return { onReplyStart, onIdle: fireStop, onCleanup: fireStop };
}
