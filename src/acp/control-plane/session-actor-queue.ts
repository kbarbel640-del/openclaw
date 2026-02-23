export class SessionActorQueue {
  private readonly tailBySession = new Map<string, Promise<void>>();

  getTailMapForTesting(): Map<string, Promise<void>> {
    return this.tailBySession;
  }

  async run<T>(actorKey: string, op: () => Promise<T>): Promise<T> {
    const previous = this.tailBySession.get(actorKey) ?? Promise.resolve();
    let release: () => void = () => {};
    const marker = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queuedTail = previous
      .catch(() => {
        // Keep actor queue alive after an operation failure.
      })
      .then(() => marker);
    this.tailBySession.set(actorKey, queuedTail);

    await previous.catch(() => {
      // Previous failures should not block newer commands.
    });
    try {
      return await op();
    } finally {
      release();
      if (this.tailBySession.get(actorKey) === queuedTail) {
        this.tailBySession.delete(actorKey);
      }
    }
  }
}
