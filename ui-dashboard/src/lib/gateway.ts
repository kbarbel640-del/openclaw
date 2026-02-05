import type { GatewayEvent } from '../types';
import { useSyncExternalStore } from 'react';

const DEFAULT_URL = 'ws://localhost:18789/dashboard';

// Connection state store (separate from Zustand to avoid re-render loops)
let connectionState = {
  connected: false,
  connecting: false,
  error: null as string | null,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function setConnectionState(updates: Partial<typeof connectionState>) {
  connectionState = { ...connectionState, ...updates };
  notify();
}

class GatewayManager {
  private ws: WebSocket | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private shouldReconnect = true;
  private url = DEFAULT_URL;
  private reconnectInterval = 3000;
  private maxReconnectAttempts = 5;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.shouldReconnect = true;
    setConnectionState({ connecting: true, error: null });

    try {
      const ws = new WebSocket(this.url);
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectAttempts = 0;
        setConnectionState({ connected: true, connecting: false, error: null });

        ws.send(
          JSON.stringify({
            type: 'subscribe',
            channels: ['tasks', 'workers', 'messages', 'reviews'],
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as GatewayEvent;
          // Update Zustand store for data events
          import('../stores/dashboardStore').then(({ useDashboardStore }) => {
            useDashboardStore.getState().handleGatewayEvent(data);
          });
        } catch (err) {
          console.error('[Gateway] Failed to parse message:', err);
        }
      };

      ws.onerror = () => {
        setConnectionState({ error: 'WebSocket connection error', connecting: false });
      };

      ws.onclose = () => {
        setConnectionState({ connected: false, connecting: false });
        this.ws = null;

        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectInterval * Math.min(this.reconnectAttempts, 3);

          this.reconnectTimeout = setTimeout(() => {
            this.connect();
          }, delay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          setConnectionState({ error: `Failed to connect after ${this.maxReconnectAttempts} attempts` });
        }
      };
    } catch (err) {
      setConnectionState({ 
        error: err instanceof Error ? err.message : 'Failed to connect',
        connecting: false 
      });
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    setConnectionState({ connected: false, connecting: false });
    this.reconnectAttempts = 0;
  }

  send(message: unknown): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
}

// Singleton instance
export const gateway = new GatewayManager();

// React hook using useSyncExternalStore
export function useGateway() {
  const state = useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => connectionState,
    () => connectionState
  );

  return {
    ...state,
    connect: () => gateway.connect(),
    disconnect: () => gateway.disconnect(),
    send: (msg: unknown) => gateway.send(msg),
  };
}

export function useSendMessage() {
  return (content: string, trackId?: string) => {
    return gateway.send({
      type: 'message.send',
      payload: {
        content,
        trackId,
        timestamp: Date.now(),
      },
    });
  };
}

// Auto-connect in browser
let autoConnectAttempted = false;
export function initGateway() {
  if (!autoConnectAttempted && typeof window !== 'undefined') {
    autoConnectAttempted = true;
    setTimeout(() => gateway.connect(), 100);
  }
}
