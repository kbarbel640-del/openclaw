/**
 * SSE/HTTP MCP client — connects to remote MCP servers.
 *
 * Supports both SSE (Server-Sent Events) and Streamable HTTP transports.
 * Handles reconnection with exponential backoff.
 */

import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpServerConfig } from "./config.js";
import { McpClientBase } from "./client-base.js";

export class SseMcpClient extends McpClientBase {
  private transport: SSEClientTransport | StreamableHTTPClientTransport | null = null;

  async connect(): Promise<void> {
    this.status = "connecting";
    this.cancelRestart();

    try {
      const url = new URL(this.config.url!);
      const headers = this.config.headers ?? {};

      if (this.config.transport === "http") {
        this.transport = new StreamableHTTPClientTransport(url, {
          requestInit: { headers },
        });
      } else {
        this.transport = new SSEClientTransport(url, {
          requestInit: { headers },
        });
      }

      this.transport.onclose = () => this.handleDisconnect();
      this.transport.onerror = () => this.handleDisconnect();

      await this.initializeClient(this.transport);
    } catch (err) {
      this.status = "error";
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.status = "closed";
    this.cancelRestart();
    try {
      await this.client?.close();
    } catch {
      /* ignore close errors */
    }
    this.transport = null;
    this.client = null;
  }
}
