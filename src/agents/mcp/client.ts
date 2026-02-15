/**
 * MCP Client.
 *
 * Connects to MCP servers via stdio transport and provides
 * methods to list tools and call them.
 *
 * Note: This is a lightweight implementation that communicates
 * over JSON-RPC via stdin/stdout, following the MCP specification.
 * If @modelcontextprotocol/sdk is available, it can be used instead.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import type { McpServerConfig, McpToolDefinition, McpToolCallResult } from "./types.js";

const INIT_TIMEOUT_MS = 15_000;
const CALL_TIMEOUT_MS = 30_000;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
};

type PendingRequest = {
  resolve: (value: JsonRpcResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * MCP client that communicates with a server process via stdio.
 */
export class McpClient {
  private process: ChildProcess | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private initialized = false;
  private serverName: string;
  private config: McpServerConfig;

  constructor(serverName: string, config: McpServerConfig) {
    this.serverName = serverName;
    this.config = config;
  }

  /**
   * Start the MCP server process and initialize the connection.
   */
  async connect(): Promise<void> {
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (this.config.env) {
      for (const [key, value] of Object.entries(this.config.env)) {
        env[key] = value;
      }
    }

    this.process = spawn(this.config.command, this.config.args ?? [], {
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });

    if (!this.process.stdout || !this.process.stdin) {
      throw new Error(`Failed to start MCP server ${this.serverName}: no stdio`);
    }

    // Read JSON-RPC responses line by line
    const rl = createInterface({ input: this.process.stdout });
    rl.on("line", (line) => {
      this.handleLine(line);
    });

    this.process.on("error", (err) => {
      this.rejectAll(new Error(`MCP server ${this.serverName} error: ${err.message}`));
    });

    this.process.on("close", (code) => {
      this.rejectAll(new Error(`MCP server ${this.serverName} exited with code ${code}`));
      this.process = null;
    });

    // Initialize the connection
    await this.initialize();
  }

  /**
   * Send the initialize request.
   */
  private async initialize(): Promise<void> {
    const response = await this.request(
      "initialize",
      {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "openclaw",
          version: "1.0.0",
        },
      },
      INIT_TIMEOUT_MS,
    );

    if (response.error) {
      throw new Error(`MCP server ${this.serverName} initialize error: ${response.error.message}`);
    }

    // Send initialized notification
    this.notify("notifications/initialized", {});
    this.initialized = true;
  }

  /**
   * List available tools from the MCP server.
   */
  async listTools(): Promise<McpToolDefinition[]> {
    if (!this.initialized) {
      throw new Error(`MCP server ${this.serverName} not initialized`);
    }

    const response = await this.request("tools/list", {});
    if (response.error) {
      throw new Error(`MCP server ${this.serverName} tools/list error: ${response.error.message}`);
    }

    const result = response.result as { tools?: unknown[] } | undefined;
    if (!result?.tools || !Array.isArray(result.tools)) {
      return [];
    }

    return result.tools
      .filter((t): t is Record<string, unknown> => Boolean(t && typeof t === "object"))
      .map((t) => ({
        name: typeof t.name === "string" ? t.name : "",
        description: typeof t.description === "string" ? t.description : undefined,
        inputSchema:
          t.inputSchema && typeof t.inputSchema === "object"
            ? (t.inputSchema as Record<string, unknown>)
            : { type: "object", properties: {} },
      }))
      .filter((t) => t.name);
  }

  /**
   * Call a tool on the MCP server.
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    if (!this.initialized) {
      throw new Error(`MCP server ${this.serverName} not initialized`);
    }

    const response = await this.request("tools/call", {
      name: toolName,
      arguments: args,
    });

    if (response.error) {
      return {
        content: [{ type: "text", text: response.error.message }],
        isError: true,
      };
    }

    const result = response.result as { content?: unknown[]; isError?: boolean } | undefined;
    if (!result?.content || !Array.isArray(result.content)) {
      return { content: [{ type: "text", text: "(empty result)" }] };
    }

    const content = result.content
      .filter((c): c is Record<string, unknown> => Boolean(c && typeof c === "object"))
      .map((c) => {
        if (c.type === "text" && typeof c.text === "string") {
          return { type: "text" as const, text: c.text };
        }
        if (c.type === "image" && typeof c.data === "string" && typeof c.mimeType === "string") {
          return { type: "image" as const, data: c.data, mimeType: c.mimeType };
        }
        return { type: "text" as const, text: JSON.stringify(c) };
      });

    return { content, isError: result.isError === true };
  }

  /**
   * Disconnect and kill the server process.
   */
  async disconnect(): Promise<void> {
    this.initialized = false;
    this.rejectAll(new Error("Client disconnected"));

    if (this.process) {
      this.process.kill("SIGTERM");
      // Give it a moment to exit gracefully, then force kill
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (this.process) {
            this.process.kill("SIGKILL");
          }
          resolve();
        }, 2000);

        if (this.process) {
          this.process.once("close", () => {
            clearTimeout(timer);
            resolve();
          });
        } else {
          clearTimeout(timer);
          resolve();
        }
      });
      this.process = null;
    }
  }

  get isConnected(): boolean {
    return this.initialized && this.process !== null;
  }

  private async request(
    method: string,
    params: Record<string, unknown>,
    timeoutMs = CALL_TIMEOUT_MS,
  ): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.send(request);
    });
  }

  private notify(method: string, params: Record<string, unknown>): void {
    this.send({
      jsonrpc: "2.0",
      method,
      params,
    });
  }

  private send(data: unknown): void {
    if (!this.process?.stdin) {
      return;
    }
    const json = JSON.stringify(data);
    this.process.stdin.write(json + "\n");
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    let response: JsonRpcResponse;
    try {
      response = JSON.parse(trimmed) as JsonRpcResponse;
    } catch {
      return;
    }

    if (typeof response.id !== "number") {
      return; // Notification or invalid — ignore
    }

    const pending = this.pending.get(response.id);
    if (pending) {
      this.pending.delete(response.id);
      clearTimeout(pending.timer);
      pending.resolve(response);
    }
  }

  private rejectAll(error: Error): void {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}
