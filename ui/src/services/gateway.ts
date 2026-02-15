/**
 * Gateway service singleton for Astro islands.
 *
 * Wraps the existing GatewayBrowserClient and exposes nanostores
 * so every island can subscribe to connection state reactively.
 */

import { atom } from "nanostores";
import { $connected } from "../stores/app.ts";
import { $hello, $gatewayUrl } from "../stores/gateway.ts";
import {
  GatewayBrowserClient,
  type GatewayBrowserClientOptions,
  type GatewayEventFrame,
  type GatewayHelloOk,
} from "../ui/gateway.ts";
import { loadSettings, type UiSettings } from "../ui/storage.ts";

// Event bus for gateway events (islands can subscribe)
export const $gatewayEvent = atom<GatewayEventFrame | null>(null);
export const $gatewayError = atom<string | null>(null);

let client: GatewayBrowserClient | null = null;
let autoConnected = false;

function resolveWsUrl(settings: UiSettings): string {
  if (settings.gatewayUrl.trim()) {
    return settings.gatewayUrl.trim();
  }
  const proto = globalThis.location?.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${globalThis.location?.host ?? "localhost:18789"}`;
}

function createClient(url: string, token?: string, password?: string): GatewayBrowserClient {
  const opts: GatewayBrowserClientOptions = {
    url,
    token: token || undefined,
    password: password || undefined,
    clientName: "openclaw-control-ui",
    platform: "browser",
    mode: "ui",
    onHello(hello: GatewayHelloOk) {
      $hello.set(hello);
      $connected.set(true);
      $gatewayError.set(null);
    },
    onEvent(evt: GatewayEventFrame) {
      $gatewayEvent.set(evt);
    },
    onClose(info: { code: number; reason: string }) {
      $connected.set(false);
      if (info.code !== 1000) {
        $gatewayError.set(info.reason || `Connection closed (code ${info.code})`);
      }
    },
  };
  return new GatewayBrowserClient(opts);
}

/** Ensure we have an active connection. Auto-connects on first call. */
function ensureConnected(): void {
  if (client?.connected) {
    return;
  }
  if (!autoConnected) {
    autoConnected = true;
    gateway.connect();
  }
}

export const gateway = {
  /** Connect to the gateway WebSocket. */
  connect(url?: string, token?: string, password?: string): void {
    if (client) {
      client.stop();
      client = null;
    }
    $connected.set(false);
    $hello.set(null);

    const settings = loadSettings();
    const wsUrl = url ?? resolveWsUrl(settings);
    const wsToken = token ?? settings.token;
    const wsPassword = password ?? "";

    $gatewayUrl.set(wsUrl);

    client = createClient(wsUrl, wsToken, wsPassword);
    client.start();
  },

  /** Disconnect from the gateway. */
  disconnect(): void {
    if (client) {
      client.stop();
      client = null;
    }
    $connected.set(false);
    $hello.set(null);
  },

  /**
   * Make an RPC call to the gateway.
   * Auto-connects if not yet connected.
   */
  async call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    ensureConnected();
    if (!client) {
      throw new Error("Gateway client not initialized");
    }
    const result = await client.request(method, params);
    return result as T;
  },

  /** Whether the gateway WebSocket is currently open. */
  get connected(): boolean {
    return client?.connected ?? false;
  },

  /** The raw GatewayBrowserClient instance (for advanced use). */
  get client(): GatewayBrowserClient | null {
    return client;
  },
};
