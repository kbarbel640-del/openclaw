import type { GatewayMessage, ConnectionStatus } from "./types";

type EventHandler = (message: GatewayMessage) => void;
type StatusHandler = (status: ConnectionStatus) => void;

export class GatewayClient {
  private url: string;
  private ws: WebSocket | null = null;
  private eventHandlers: Set<EventHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private pendingRequests: Map<
    string,
    { resolve: (value: GatewayMessage) => void; reject: (reason: Error) => void }
  > = new Map();
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private requestCounter = 0;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.intentionalClose = false;
    this.emitStatus("connecting");

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.emitStatus("error");
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emitStatus("connected");
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data);
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.intentionalClose) {
        this.emitStatus("disconnected");
        this.scheduleReconnect();
      } else {
        this.emitStatus("disconnected");
      }
    };

    this.ws.onerror = () => {
      this.emitStatus("error");
    };
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error("Client disconnected"));
    });
    this.pendingRequests.clear();
  }

  async send(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<GatewayMessage> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket is not connected"));
        return;
      }

      const id = this.generateRequestId();
      const message: GatewayMessage = {
        type: "req",
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out after 30s`));
      }, 30000);

      const originalResolve = resolve;
      this.pendingRequests.set(id, {
        resolve: (value: GatewayMessage) => {
          clearTimeout(timeout);
          originalResolve(value);
        },
        reject: (reason: Error) => {
          clearTimeout(timeout);
          reject(reason);
        },
      });

      try {
        this.ws.send(JSON.stringify(message));
      } catch (err) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  private handleMessage(data: string): void {
    let message: GatewayMessage;
    try {
      message = JSON.parse(data) as GatewayMessage;
    } catch {
      console.error("[GatewayClient] Failed to parse message:", data);
      return;
    }

    if (message.type === "res" && message.id) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.ok) {
          pending.resolve(message);
        } else {
          pending.reject(new Error(message.error ?? "Request failed"));
        }
      }
    }

    if (
      message.type === "event" &&
      message.event === "connect.challenge" &&
      message.payload
    ) {
      this.handleChallenge(message.payload);
      return;
    }

    this.eventHandlers.forEach((handler) => {
      try {
        handler(message);
      } catch (err) {
        console.error("[GatewayClient] Event handler error:", err);
      }
    });
  }

  private handleChallenge(payload: Record<string, unknown>): void {
    const response: GatewayMessage = {
      type: "event",
      event: "connect",
      payload: {
        client: "dem-dashboard",
        version: "0.1.0",
        challenge: payload.nonce ?? null,
      },
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(response));
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) {
      return;
    }

    const baseDelay = 1000;
    const delay = Math.min(
      baseDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private emitStatus(status: ConnectionStatus): void {
    this.statusHandlers.forEach((handler) => {
      try {
        handler(status);
      } catch (err) {
        console.error("[GatewayClient] Status handler error:", err);
      }
    });
  }

  private generateRequestId(): string {
    this.requestCounter++;
    return `dash-${Date.now()}-${this.requestCounter}`;
  }
}
