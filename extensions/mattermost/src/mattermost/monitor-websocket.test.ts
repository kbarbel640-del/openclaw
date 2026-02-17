import type { RuntimeEnv } from "openclaw/plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import {
  createMattermostConnectOnce,
  type MattermostWebSocketLike,
  WebSocketClosedBeforeOpenError,
} from "./monitor-websocket.js";
import { runWithReconnect } from "./reconnect.js";




class FakeWebSocket implements MattermostWebSocketLike {
  public readonly sent: string[] = [];
  public closeCalls = 0;
  public terminateCalls = 0;
  private openListeners: Array<() => void> = [];
  private messageListeners: Array<(data: Buffer) => void | Promise<void>> = [];
  private closeListeners: Array<(code: number, reason: Buffer) => void> = [];
  private errorListeners: Array<(err: unknown) => void> = [];




  on(event: "open", listener: () => void): void;
  on(event: "message", listener: (data: Buffer) => void | Promise<void>): void;
  on(event: "close", listener: (code: number, reason: Buffer) => void): void;
  on(event: "error", listener: (err: unknown) => void): void;
  on(event: "open" | "message" | "close" | "error", listener: unknown): void {
    if (event === "open") {
      this.openListeners.push(listener as () => void);
      return;
    }
    if (event === "message") {
      this.messageListeners.push(listener as (data: Buffer) => void | Promise<void>);
      return;
    }
    if (event === "close") {
      this.closeListeners.push(listener as (code: number, reason: Buffer) => void);
      return;
    }
    this.errorListeners.push(listener as (err: unknown) => void);
  }




  send(data: string): void {
    this.sent.push(data);
  }




  close(): void {
    this.closeCalls++;
  }




  terminate(): void {
    this.terminateCalls++;
  }




  emitOpen(): void {
    for (const listener of this.openListeners) {
      listener();
    }
  }




  emitMessage(data: Buffer): void {
    for (const listener of this.messageListeners) {
      void listener(data);
    }
  }




  emitClose(code: number, reason = ""): void {
