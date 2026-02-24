import { contextBridge, ipcRenderer } from "electron";

const SEND_CHANNELS = [
  "user:message",
  "session:start",
  "session:control",
  "learn:start",
  "learn:observe",
  "flag:action",
] as const;

const RECEIVE_CHANNELS = [
  "sophie:message",
  "session:progress",
  "session:flag",
  "session:complete",
  "learn:status",
  "profile:data",
] as const;

const INVOKE_CHANNELS = ["sophie:query", "sophie:state", "profile:get", "session:list"] as const;

type SendChannel = (typeof SEND_CHANNELS)[number];
type ReceiveChannel = (typeof RECEIVE_CHANNELS)[number];
type InvokeChannel = (typeof INVOKE_CHANNELS)[number];

const api = {
  send(channel: SendChannel, data: unknown): void {
    if ((SEND_CHANNELS as readonly string[]).includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  on(channel: ReceiveChannel, callback: (...args: unknown[]) => void): () => void {
    if (!(RECEIVE_CHANNELS as readonly string[]).includes(channel)) {
      return () => {};
    }
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },

  invoke(channel: InvokeChannel, data?: unknown): Promise<unknown> {
    if ((INVOKE_CHANNELS as readonly string[]).includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Invalid channel: ${channel}`));
  },

  platform: process.platform,
};

contextBridge.exposeInMainWorld("sophie", api);

export type SophieAPI = typeof api;
