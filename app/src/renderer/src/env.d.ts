/// <reference types="vite/client" />

interface SophieAPI {
  send(channel: string, data: unknown): void;
  on(channel: string, callback: (...args: unknown[]) => void): () => void;
  invoke(channel: string, data?: unknown): Promise<unknown>;
  platform: string;
}

interface Window {
  sophie: SophieAPI;
}
