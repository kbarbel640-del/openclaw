type AsyncTick = (signal: AbortSignal) => Promise<void> | void;

export type TypingKeepaliveLoop = {
  tick: () => Promise<void>;
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
};

export function createTypingKeepaliveLoop(params: {
  intervalMs: number;
  onTick: AsyncTick;
}): TypingKeepaliveLoop {
  let timer: ReturnType<typeof setInterval> | undefined;
  let tickInFlight = false;
  let abortController: AbortController | undefined;

  const tick = async () => {
    if (tickInFlight) {
      return;
    }
    tickInFlight = true;
    abortController = new AbortController();
    try {
      await params.onTick(abortController.signal);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Swallow abort errors — expected when stop() cancels an in-flight tick.
        return;
      }
      throw err;
    } finally {
      tickInFlight = false;
      abortController = undefined;
    }
  };

  const start = () => {
    if (params.intervalMs <= 0 || timer) {
      return;
    }
    timer = setInterval(() => {
      void tick();
    }, params.intervalMs);
  };

  const stop = () => {
    // Always abort any in-flight tick, even if the interval was never started.
    if (abortController) {
      abortController.abort();
      abortController = undefined;
    }
    if (!timer) {
      return;
    }
    clearInterval(timer);
    timer = undefined;
    tickInFlight = false;
  };

  const isRunning = () => timer !== undefined;

  return {
    tick,
    start,
    stop,
    isRunning,
  };
}
