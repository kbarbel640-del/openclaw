import type { SessionStoreAdapter } from "./adapter.js";
import { loadSessionStore, updateSessionStore } from "./store.js";
import type { SessionEntry } from "./types.js";

/**
 * Filesystem-backed session store adapter.
 *
 * Delegates to the existing JSON-file session store implementation,
 * providing the {@link SessionStoreAdapter} interface on top.
 */
export class FilesystemSessionStoreAdapter implements SessionStoreAdapter {
  constructor(private readonly storePath: string) {}

  load(sessionKey: string): SessionEntry | undefined {
    const store = loadSessionStore(this.storePath);
    return store[sessionKey];
  }

  async save(sessionKey: string, entry: SessionEntry): Promise<void> {
    await updateSessionStore(this.storePath, (store) => {
      store[sessionKey] = entry;
    });
  }

  list(): string[] {
    const store = loadSessionStore(this.storePath);
    return Object.keys(store);
  }

  async delete(sessionKey: string): Promise<void> {
    await updateSessionStore(this.storePath, (store) => {
      delete store[sessionKey];
    });
  }
}
