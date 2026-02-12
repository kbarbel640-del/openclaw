# ACP-Level MCP Support: Implementation Guide

This document describes how to add full MCP (Model Context Protocol) server support to the OpenClaw ACP (Agent Client Protocol) translator. Today, the ACP translator silently ignores MCP servers passed by clients during session creation. The goal is to accept MCP server configurations, connect to them, discover their tools, and make those tools available to the agent during sessions.

---

## Table of Contents

1. [Overview and Architecture](#1-overview-and-architecture)
2. [New File: `src/acp/mcp-client.ts`](#2-new-file-srcacpmcp-clientts)
3. [New File: `src/acp/mcp-tool-bridge.ts`](#3-new-file-srcacpmcp-tool-bridgets)
4. [Changes to `src/acp/translator.ts`](#4-changes-to-srcacptranslatorts)
5. [Changes to Gateway Tool Pipeline](#5-changes-to-gateway-tool-pipeline)
6. [Session-Scoped MCP Lifecycle](#6-session-scoped-mcp-lifecycle)
7. [Security Considerations](#7-security-considerations)
8. [Testing Strategy](#8-testing-strategy)
9. [Estimated Effort](#9-estimated-effort)
10. [Open Questions / Design Decisions](#10-open-questions--design-decisions)

---

## 1. Overview and Architecture

### Current State

The ACP translator (`src/acp/translator.ts`) is a thin bridge between the ACP protocol and the OpenClaw gateway. It:

- Implements the ACP `Agent` interface (`AcpGatewayAgent`)
- Advertises `mcpCapabilities: { http: false, sse: false }` during `initialize()`
- Ignores MCP servers in `newSession()` and `loadSession()` with a log message
- Sends messages to the gateway via `chat.send` RPC and relays tool events back to the ACP client

### Target State

```
ACP Client (IDE / CLI)
    |
    | ACP protocol (ndjson over stdio)
    v
AcpGatewayAgent (src/acp/translator.ts)
    |                    |
    | gateway RPC        | MCP connections
    v                    v
OpenClaw Gateway    McpClientManager (src/acp/mcp-client.ts)
    |                    |
    | tool execution     | JSON-RPC 2.0
    |                    v
    |               MCP Servers (stdio / HTTP / SSE)
    |                    |
    v                    v
Agent Model         McpToolBridge (src/acp/mcp-tool-bridge.ts)
    |                    |
    | tool calls         | bridged tools
    +---------+----------+
              |
              v
      Combined Tool Set
```

### Lifecycle

1. **Session start**: Client calls `session/new` or `session/load` with `mcpServers[]`.
2. **MCP connect**: `McpClientManager` spawns stdio processes or opens HTTP/SSE connections.
3. **Tool discovery**: Manager calls `tools/list` on each connected server, receives tool schemas.
4. **Tool bridging**: `McpToolBridge` converts MCP tool schemas into `AnyAgentTool` instances.
5. **Tool registration**: Bridged tools are injected into the gateway session's tool set.
6. **Usage**: When the model calls an MCP-bridged tool, the bridge routes it through the manager to the correct MCP server via `tools/call`.
7. **Cleanup**: On session end or disconnect, `McpClientManager.disconnect()` shuts down all connections and child processes.

### Data Flow for a Single MCP Tool Call

```
Model decides to call "mcp:my-server:analyze_code"
    |
    v
Gateway emits agent event: tool_execution_start
    |
    v
Bridged AgentTool.execute() is invoked
    |
    v
McpToolBridge routes to McpClientManager.callTool("my-server", "analyze_code", args)
    |
    v
McpClientManager sends JSON-RPC request to the "my-server" MCP process
    |
    v
MCP server processes and returns result
    |
    v
McpClientManager returns result to bridge
    |
    v
Bridge converts MCP result -> AgentToolResult
    |
    v
Gateway receives tool result, continues agent loop
```

---

## 2. New File: `src/acp/mcp-client.ts`

This module manages connections to one or more MCP servers for a single session. Estimated size: 250-350 LOC.

### Types

```typescript
// src/acp/mcp-client.ts

import type { ChildProcess } from "node:child_process";

/** MCP server config as received from the ACP client (mirrors ACP SDK schema). */
export type McpServerConfig =
  | McpServerStdioConfig
  | McpServerHttpConfig
  | McpServerSseConfig;

export type McpServerStdioConfig = {
  type: "stdio";
  name: string;
  command: string;
  args: string[];
  env: Array<{ name: string; value: string }>;
};

export type McpServerHttpConfig = {
  type: "http";
  name: string;
  url: string;
  headers: Array<{ name: string; value: string }>;
};

export type McpServerSseConfig = {
  type: "sse";
  name: string;
  url: string;
  headers: Array<{ name: string; value: string }>;
};

/** A single tool as reported by an MCP server via tools/list. */
export type McpToolDefinition = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>; // JSON Schema object
};

/** Result from an MCP tools/call response. */
export type McpToolCallResult = {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
};

/** Internal connection handle for a single MCP server. */
type McpConnection = {
  config: McpServerConfig;
  transport: McpTransport;
  tools: McpToolDefinition[];
  requestId: number;
  healthy: boolean;
};

/** Abstraction over the three transport types. */
type McpTransport = {
  send: (request: JsonRpcRequest) => Promise<JsonRpcResponse>;
  close: () => Promise<void>;
};

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};
```

### McpClientManager Class

```typescript
export type McpClientManagerOptions = {
  /** Timeout for MCP server initialization handshake (ms). */
  initTimeoutMs?: number;
  /** Timeout for individual tool calls (ms). */
  callTimeoutMs?: number;
  /** Logger function. */
  log?: (msg: string) => void;
};

export class McpClientManager {
  private connections = new Map<string, McpConnection>();
  private disposed = false;
  private opts: Required<McpClientManagerOptions>;

  constructor(opts: McpClientManagerOptions = {}) {
    this.opts = {
      initTimeoutMs: opts.initTimeoutMs ?? 30_000,
      callTimeoutMs: opts.callTimeoutMs ?? 120_000,
      log: opts.log ?? (() => {}),
    };
  }

  /**
   * Connect to all provided MCP servers.
   * Failures on individual servers are logged but do not block other connections.
   */
  async connect(servers: McpServerConfig[]): Promise<void> { /* ... */ }

  /**
   * Discover tools from all connected MCP servers.
   * Returns a flat array of tool definitions, each tagged with its server name.
   */
  async discoverTools(): Promise<Array<McpToolDefinition & { serverName: string }>> { /* ... */ }

  /**
   * Call a specific tool on a specific MCP server.
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<McpToolCallResult> { /* ... */ }

  /**
   * Disconnect all MCP servers and clean up child processes.
   */
  async disconnect(): Promise<void> { /* ... */ }

  /** Check if any MCP servers are connected. */
  get hasConnections(): boolean { return this.connections.size > 0; }

  /** List connected server names. */
  get serverNames(): string[] { return [...this.connections.keys()]; }
}
```

### Transport Implementations

#### Stdio Transport

The stdio transport spawns a child process and communicates via JSON-RPC 2.0 over stdin/stdout. This is the transport that all ACP agents MUST support.

```typescript
async function createStdioTransport(
  config: McpServerStdioConfig,
  log: (msg: string) => void,
): Promise<{ transport: McpTransport; process: ChildProcess }> {
  const env: Record<string, string> = { ...process.env };
  for (const entry of config.env) {
    env[entry.name] = entry.value;
  }

  const child = spawn(config.command, config.args, {
    stdio: ["pipe", "pipe", "pipe"],
    env,
  });

  // Buffer stdout for line-delimited JSON-RPC responses.
  // Each line is a complete JSON-RPC response.
  const pendingRequests = new Map<number, {
    resolve: (res: JsonRpcResponse) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }>();

  // Parse newline-delimited JSON from stdout
  let stdoutBuffer = "";
  child.stdout!.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as JsonRpcResponse;
        const pending = pendingRequests.get(parsed.id);
        if (pending) {
          clearTimeout(pending.timer);
          pendingRequests.delete(parsed.id);
          pending.resolve(parsed);
        }
      } catch {
        log(`mcp stdio parse error: ${line.slice(0, 200)}`);
      }
    }
  });

  child.on("exit", (code) => {
    log(`mcp stdio process exited: ${config.name} (code=${code})`);
    for (const [id, pending] of pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`MCP server ${config.name} exited (code=${code})`));
      pendingRequests.delete(id);
    }
  });

  const transport: McpTransport = {
    send: (request) => {
      return new Promise((resolve, reject) => {
        if (!child.stdin?.writable) {
          reject(new Error(`MCP server ${config.name} stdin not writable`));
          return;
        }
        const timer = setTimeout(() => {
          pendingRequests.delete(request.id);
          reject(new Error(`MCP server ${config.name} request timeout`));
        }, 120_000);
        pendingRequests.set(request.id, { resolve, reject, timer });
        child.stdin.write(JSON.stringify(request) + "\n");
      });
    },
    close: async () => {
      child.kill("SIGTERM");
      // Give 5s for graceful exit before SIGKILL.
      await new Promise<void>((resolve) => {
        const forceTimer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 5000);
        child.on("exit", () => {
          clearTimeout(forceTimer);
          resolve();
        });
      });
    },
  };

  return { transport, process: child };
}
```

#### HTTP Transport (Streamable HTTP)

For HTTP-based MCP servers (the current recommended remote transport). Uses `POST` requests with JSON-RPC bodies.

```typescript
async function createHttpTransport(
  config: McpServerHttpConfig,
): Promise<McpTransport> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  for (const h of config.headers) {
    headers[h.name] = h.value;
  }

  return {
    send: async (request) => {
      const res = await fetch(config.url, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        throw new Error(`MCP HTTP error ${res.status}: ${await res.text()}`);
      }
      return (await res.json()) as JsonRpcResponse;
    },
    close: async () => {
      // Nothing to clean up for stateless HTTP.
    },
  };
}
```

#### SSE Transport (Legacy)

SSE transport uses Server-Sent Events for server-to-client communication and POST for client-to-server requests. This is the legacy transport; new implementations should prefer Streamable HTTP (the "http" type above).

```typescript
async function createSseTransport(
  config: McpServerSseConfig,
  log: (msg: string) => void,
): Promise<McpTransport> {
  const headers: Record<string, string> = {};
  for (const h of config.headers) {
    headers[h.name] = h.value;
  }

  // SSE transport: connect to the SSE endpoint for notifications,
  // POST to the same URL for requests.
  // The SSE stream sends JSON-RPC responses and notifications.
  const pendingRequests = new Map<number, {
    resolve: (res: JsonRpcResponse) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }>();

  let postEndpoint = config.url;
  let abortController = new AbortController();

  // Start SSE connection
  const connectSse = async () => {
    try {
      const res = await fetch(config.url, {
        headers: { ...headers, Accept: "text/event-stream" },
        signal: abortController.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`SSE connect failed: ${res.status}`);
      }
      // Parse SSE stream for endpoint discovery and responses
      // The server may send an "endpoint" event with the POST URL
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const processChunk = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const event of events) {
            const dataLine = event.split("\n").find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            const data = dataLine.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (parsed.endpoint) {
                postEndpoint = new URL(parsed.endpoint, config.url).toString();
              }
              if (parsed.id !== undefined) {
                const pending = pendingRequests.get(parsed.id);
                if (pending) {
                  clearTimeout(pending.timer);
                  pendingRequests.delete(parsed.id);
                  pending.resolve(parsed as JsonRpcResponse);
                }
              }
            } catch {
              log(`mcp sse parse error: ${data.slice(0, 200)}`);
            }
          }
        }
      };
      void processChunk();
    } catch (err) {
      if (!abortController.signal.aborted) {
        log(`mcp sse connection error: ${String(err)}`);
      }
    }
  };

  void connectSse();

  return {
    send: async (request) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingRequests.delete(request.id);
          reject(new Error(`MCP SSE request timeout`));
        }, 120_000);
        pendingRequests.set(request.id, { resolve, reject, timer });
        void fetch(postEndpoint, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(request),
        }).catch((err) => {
          clearTimeout(timer);
          pendingRequests.delete(request.id);
          reject(err);
        });
      });
    },
    close: async () => {
      abortController.abort();
      for (const [id, pending] of pendingRequests) {
        clearTimeout(pending.timer);
        pending.reject(new Error("MCP SSE transport closed"));
        pendingRequests.delete(id);
      }
    },
  };
}
```

### MCP Initialization Handshake

Every MCP connection must perform the `initialize` handshake before calling `tools/list`:

```typescript
private async initializeConnection(conn: McpConnection): Promise<void> {
  const initResponse = await conn.transport.send({
    jsonrpc: "2.0",
    id: ++conn.requestId,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: {
        name: "openclaw-acp",
        version: "1.0.0",
      },
    },
  });

  if (initResponse.error) {
    throw new Error(
      `MCP initialize failed for ${conn.config.name}: ${initResponse.error.message}`,
    );
  }

  // Send initialized notification (no response expected, but we send it as
  // a notification with no id).
  // For simplicity, send as a request; servers should accept both.
  await conn.transport.send({
    jsonrpc: "2.0",
    id: ++conn.requestId,
    method: "notifications/initialized",
    params: {},
  });
}
```

### Tool Discovery

```typescript
async discoverTools(): Promise<Array<McpToolDefinition & { serverName: string }>> {
  const allTools: Array<McpToolDefinition & { serverName: string }> = [];

  for (const [name, conn] of this.connections) {
    try {
      const response = await conn.transport.send({
        jsonrpc: "2.0",
        id: ++conn.requestId,
        method: "tools/list",
        params: {},
      });

      if (response.error) {
        this.opts.log(`mcp tools/list failed for ${name}: ${response.error.message}`);
        continue;
      }

      const result = response.result as { tools?: McpToolDefinition[] } | undefined;
      const tools = result?.tools ?? [];
      conn.tools = tools;
      for (const tool of tools) {
        allTools.push({ ...tool, serverName: name });
      }
      this.opts.log(`mcp discovered ${tools.length} tools from ${name}`);
    } catch (err) {
      this.opts.log(`mcp tools/list error for ${name}: ${String(err)}`);
      conn.healthy = false;
    }
  }

  return allTools;
}
```

### Tool Call

```typescript
async callTool(
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<McpToolCallResult> {
  const conn = this.connections.get(serverName);
  if (!conn) {
    throw new Error(`MCP server not connected: ${serverName}`);
  }
  if (!conn.healthy) {
    throw new Error(`MCP server unhealthy: ${serverName}`);
  }

  const response = await conn.transport.send({
    jsonrpc: "2.0",
    id: ++conn.requestId,
    method: "tools/call",
    params: {
      name: toolName,
      arguments: args,
    },
  });

  if (response.error) {
    return {
      content: [{ type: "text", text: response.error.message }],
      isError: true,
    };
  }

  const result = response.result as McpToolCallResult | undefined;
  return result ?? { content: [{ type: "text", text: "(empty result)" }] };
}
```

---

## 3. New File: `src/acp/mcp-tool-bridge.ts`

This module converts MCP tool definitions into OpenClaw `AnyAgentTool` instances that can be injected into the gateway's tool set. Estimated size: 150-200 LOC.

### Key Design Decisions

- **Tool naming**: MCP tools are namespaced with the server name prefix `mcp:<serverName>:<toolName>` to avoid collisions with built-in tools.
- **Schema conversion**: MCP tool input schemas are standard JSON Schema objects. We wrap them with `Type.Unsafe()` from `@sinclair/typebox` since the schemas come from external sources and may not map cleanly to TypeBox constructors.
- **Result conversion**: MCP `tools/call` results use `content[]` with `text` and `image` blocks, which maps directly to `AgentToolResult.content`.

### Implementation

```typescript
// src/acp/mcp-tool-bridge.ts

import { Type } from "@sinclair/typebox";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { AnyAgentTool } from "../agents/tools/common.js";
import type { McpClientManager, McpToolDefinition } from "./mcp-client.js";

/** A discovered MCP tool tagged with its server name. */
export type DiscoveredMcpTool = McpToolDefinition & { serverName: string };

/**
 * Separator used in bridged tool names: "mcp:<server>:<tool>".
 * Using a colon is safe because OpenClaw tool names use underscores internally,
 * and the LLM sees these names as opaque strings.
 */
const MCP_TOOL_PREFIX = "mcp";
const MCP_NAME_SEPARATOR = ":";

/**
 * Build a bridged tool name from server name and MCP tool name.
 *
 * Example: buildBridgedToolName("dev-tools", "analyze_project")
 *   => "mcp:dev-tools:analyze_project"
 */
export function buildBridgedToolName(serverName: string, toolName: string): string {
  return [MCP_TOOL_PREFIX, serverName, toolName].join(MCP_NAME_SEPARATOR);
}

/**
 * Parse a bridged tool name back into server name and tool name.
 * Returns null if the name does not match the expected pattern.
 */
export function parseBridgedToolName(
  bridgedName: string,
): { serverName: string; toolName: string } | null {
  if (!bridgedName.startsWith(MCP_TOOL_PREFIX + MCP_NAME_SEPARATOR)) {
    return null;
  }
  const rest = bridgedName.slice(MCP_TOOL_PREFIX.length + MCP_NAME_SEPARATOR.length);
  const sepIdx = rest.indexOf(MCP_NAME_SEPARATOR);
  if (sepIdx < 0) {
    return null;
  }
  return {
    serverName: rest.slice(0, sepIdx),
    toolName: rest.slice(sepIdx + MCP_NAME_SEPARATOR.length),
  };
}

/**
 * Convert a JSON Schema object from an MCP tool into a TypeBox schema.
 *
 * Since MCP input schemas can be arbitrarily complex JSON Schema, we
 * use Type.Unsafe() to pass them through without structural validation
 * at the TypeBox level. The schema is still sent to the LLM for
 * structured generation, and the MCP server validates inputs itself.
 */
function jsonSchemaToTypebox(schema: Record<string, unknown>) {
  // Type.Unsafe wraps any JSON Schema for TypeBox compatibility.
  // The LLM receives the raw JSON Schema for tool parameter generation.
  return Type.Unsafe(schema);
}

/**
 * Convert MCP tool call result content into AgentToolResult format.
 */
function mcpResultToAgentResult(
  mcpContent: Array<{ type: string; text?: string; data?: string; mimeType?: string }>,
  isError: boolean,
): AgentToolResult<unknown> {
  const content: AgentToolResult<unknown>["content"] = [];

  for (const block of mcpContent) {
    if (block.type === "text" && block.text) {
      content.push({ type: "text", text: block.text });
    } else if (block.type === "image" && block.data && block.mimeType) {
      content.push({
        type: "image",
        data: block.data,
        mimeType: block.mimeType,
      });
    }
  }

  if (content.length === 0) {
    content.push({
      type: "text",
      text: isError ? "(MCP tool returned an error with no details)" : "(empty result)",
    });
  }

  return {
    content,
    details: { source: "mcp", isError },
  };
}

/**
 * Bridge discovered MCP tools into AnyAgentTool instances.
 *
 * Each bridged tool:
 * - Has a namespaced name: "mcp:<serverName>:<toolName>"
 * - Has the MCP tool's description
 * - Has a TypeBox schema wrapping the MCP tool's JSON Schema
 * - Routes execute() calls through the McpClientManager
 */
export function bridgeMcpTools(
  tools: DiscoveredMcpTool[],
  clientManager: McpClientManager,
): AnyAgentTool[] {
  return tools.map((mcpTool) => {
    const bridgedName = buildBridgedToolName(mcpTool.serverName, mcpTool.name);
    const schema = jsonSchemaToTypebox(mcpTool.inputSchema);

    const tool: AnyAgentTool = {
      name: bridgedName,
      label: `MCP: ${mcpTool.serverName}/${mcpTool.name}`,
      description:
        mcpTool.description ?? `MCP tool ${mcpTool.name} from ${mcpTool.serverName}`,
      parameters: schema,
      execute: async (
        _toolCallId: string,
        params: Record<string, unknown>,
      ): Promise<AgentToolResult<unknown>> => {
        try {
          const result = await clientManager.callTool(
            mcpTool.serverName,
            mcpTool.name,
            params,
          );
          return mcpResultToAgentResult(result.content, result.isError ?? false);
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: `MCP tool error (${mcpTool.serverName}/${mcpTool.name}): ${
                  err instanceof Error ? err.message : String(err)
                }`,
              },
            ],
            details: { source: "mcp", isError: true, error: String(err) },
          };
        }
      },
    };

    return tool;
  });
}

/**
 * Check if a tool name is an MCP-bridged tool.
 */
export function isMcpBridgedTool(toolName: string): boolean {
  return toolName.startsWith(MCP_TOOL_PREFIX + MCP_NAME_SEPARATOR);
}
```

---

## 4. Changes to `src/acp/translator.ts`

### Summary of Changes

1. Add a `McpClientManager` field keyed by session ID.
2. Update `initialize()` to advertise MCP capabilities.
3. Update `newSession()` and `loadSession()` to connect MCP servers.
4. Inject bridged tools into the gateway session.
5. Clean up MCP connections on session end/disconnect.

### Detailed Changes

#### 4a. New Imports and Instance Fields

```typescript
// Add to existing imports at top of src/acp/translator.ts
import { McpClientManager, type McpServerConfig } from "./mcp-client.js";
import { bridgeMcpTools, isMcpBridgedTool, parseBridgedToolName } from "./mcp-tool-bridge.js";
import type { AnyAgentTool } from "../agents/tools/common.js";

// Add new fields to AcpGatewayAgent class
export class AcpGatewayAgent implements Agent {
  // ... existing fields ...

  /** Per-session MCP client managers. Keyed by ACP session ID. */
  private mcpManagers = new Map<string, McpClientManager>();

  /** Per-session MCP-bridged tools. Keyed by ACP session ID. */
  private mcpTools = new Map<string, AnyAgentTool[]>();
```

#### 4b. Update `initialize()` to Advertise MCP Support

```typescript
async initialize(_params: InitializeRequest): Promise<InitializeResponse> {
  return {
    protocolVersion: PROTOCOL_VERSION,
    agentCapabilities: {
      loadSession: true,
      promptCapabilities: {
        image: true,
        audio: false,
        embeddedContext: true,
      },
      mcpCapabilities: {
        http: true,   // <-- changed from false
        sse: true,    // <-- changed from false
      },
      sessionCapabilities: {
        list: {},
      },
    },
    agentInfo: ACP_AGENT_INFO,
    authMethods: [],
  };
}
```

#### 4c. Update `newSession()` to Handle MCP Servers

```typescript
async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
  // Remove the old ignore block:
  // - if (params.mcpServers.length > 0) {
  // -   this.log(`ignoring ${params.mcpServers.length} MCP servers`);
  // - }

  const sessionId = randomUUID();
  const meta = parseSessionMeta(params._meta);
  const sessionKey = await resolveSessionKey({
    meta,
    fallbackKey: `acp:${sessionId}`,
    gateway: this.gateway,
    opts: this.opts,
  });
  await resetSessionIfNeeded({
    meta,
    sessionKey,
    gateway: this.gateway,
    opts: this.opts,
  });

  const session = this.sessionStore.createSession({
    sessionId,
    sessionKey,
    cwd: params.cwd,
  });

  // Connect MCP servers if provided
  if (params.mcpServers.length > 0) {
    await this.connectMcpServers(sessionId, params.mcpServers as McpServerConfig[]);
  }

  this.log(`newSession: ${session.sessionId} -> ${session.sessionKey}`);
  await this.sendAvailableCommands(session.sessionId);
  return { sessionId: session.sessionId };
}
```

#### 4d. Update `loadSession()` Similarly

```typescript
async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
  // Remove the old ignore block.

  const meta = parseSessionMeta(params._meta);
  const sessionKey = await resolveSessionKey({
    meta,
    fallbackKey: params.sessionId,
    gateway: this.gateway,
    opts: this.opts,
  });
  await resetSessionIfNeeded({
    meta,
    sessionKey,
    gateway: this.gateway,
    opts: this.opts,
  });

  const session = this.sessionStore.createSession({
    sessionId: params.sessionId,
    sessionKey,
    cwd: params.cwd,
  });

  // Connect MCP servers if provided
  if (params.mcpServers.length > 0) {
    await this.connectMcpServers(params.sessionId, params.mcpServers as McpServerConfig[]);
  }

  this.log(`loadSession: ${session.sessionId} -> ${session.sessionKey}`);
  await this.sendAvailableCommands(session.sessionId);
  return {};
}
```

#### 4e. New Private Method: `connectMcpServers()`

```typescript
private async connectMcpServers(
  sessionId: string,
  mcpServers: McpServerConfig[],
): Promise<void> {
  const manager = new McpClientManager({
    log: this.log,
  });

  try {
    await manager.connect(mcpServers);
    const discoveredTools = await manager.discoverTools();
    const bridgedTools = bridgeMcpTools(discoveredTools, manager);

    this.mcpManagers.set(sessionId, manager);
    this.mcpTools.set(sessionId, bridgedTools);

    this.log(
      `mcp: connected ${manager.serverNames.length} servers, ` +
      `bridged ${bridgedTools.length} tools for session ${sessionId}`,
    );

    // Register the bridged tools with the gateway session.
    // See Section 5 for how this integrates with the gateway.
    const session = this.sessionStore.getSession(sessionId);
    if (session) {
      await this.registerMcpToolsWithGateway(session.sessionKey, bridgedTools);
    }
  } catch (err) {
    this.log(`mcp: failed to connect servers for session ${sessionId}: ${String(err)}`);
    // Clean up on failure. The session still works, just without MCP tools.
    await manager.disconnect();
  }
}
```

#### 4f. Update `handleGatewayDisconnect()` to Clean Up MCP

```typescript
handleGatewayDisconnect(reason: string): void {
  this.log(`gateway disconnected: ${reason}`);
  for (const pending of this.pendingPrompts.values()) {
    pending.reject(new Error(`Gateway disconnected: ${reason}`));
    this.sessionStore.clearActiveRun(pending.sessionId);
  }
  this.pendingPrompts.clear();

  // Clean up all MCP connections
  for (const [sessionId, manager] of this.mcpManagers) {
    void manager.disconnect().catch((err) => {
      this.log(`mcp: disconnect error for session ${sessionId}: ${String(err)}`);
    });
  }
  this.mcpManagers.clear();
  this.mcpTools.clear();
}
```

---

## 5. Changes to Gateway Tool Pipeline

This is the most architecturally significant part of the implementation. The gateway currently assembles tools internally during the `chat.send` flow (via `dispatchInboundMessage` -> agent runner -> `createOpenClawCodingTools`). MCP-bridged tools need to be injected into this pipeline.

### Current Tool Assembly Flow

```
chat.send RPC handler (src/gateway/server-methods/chat.ts)
  -> dispatchInboundMessage (src/auto-reply/dispatch.ts)
    -> dispatchReplyFromConfig (src/auto-reply/reply/dispatch-from-config.ts)
      -> getReplyFromConfig (src/auto-reply/reply.ts)
        -> pi-embedded-runner (src/agents/pi-embedded-runner/run/attempt.ts)
          -> createOpenClawCodingTools (src/agents/pi-tools.ts)
            -> Returns AnyAgentTool[]
```

### Options for Injecting MCP Tools

There are three approaches, listed from simplest to most flexible:

#### Option A: Session-Scoped Extra Tools via Gateway RPC (Recommended)

Add a new gateway RPC method `sessions.setExtraTools` that lets the ACP translator register additional tools for a session key. The agent runner reads these when building the tool set.

**New Gateway RPC: `sessions.setExtraTools`**

```typescript
// In src/gateway/server-methods/chat.ts or a new file
// src/gateway/server-methods/extra-tools.ts

const extraSessionTools = new Map<string, AnyAgentTool[]>();

export function setExtraToolsForSession(
  sessionKey: string,
  tools: AnyAgentTool[],
): void {
  if (tools.length === 0) {
    extraSessionTools.delete(sessionKey);
  } else {
    extraSessionTools.set(sessionKey, tools);
  }
}

export function getExtraToolsForSession(sessionKey: string): AnyAgentTool[] {
  return extraSessionTools.get(sessionKey) ?? [];
}

export function clearExtraToolsForSession(sessionKey: string): void {
  extraSessionTools.delete(sessionKey);
}
```

**Modify `createOpenClawCodingTools` in `src/agents/pi-tools.ts`**

Add an `extraTools` parameter that gets appended to the tool set:

```typescript
// In src/agents/pi-tools.ts, update the options type:
export type CreateOpenClawCodingToolsOptions = {
  // ... existing options ...

  /** Extra tools to include (e.g., MCP-bridged tools). */
  extraTools?: AnyAgentTool[];
};

// In the function body, after assembling the base tools:
export function createOpenClawCodingTools(opts: CreateOpenClawCodingToolsOptions) {
  // ... existing tool assembly ...

  // Append extra tools (MCP-bridged tools, etc.)
  if (opts.extraTools && opts.extraTools.length > 0) {
    tools.push(...opts.extraTools);
  }

  return tools;
}
```

**Wire into agent runner (`src/agents/pi-embedded-runner/run/attempt.ts`)**

When the agent runner builds the tool set for a session, it should check for extra tools:

```typescript
import { getExtraToolsForSession } from "../../gateway/server-methods/extra-tools.js";

// In the tool assembly section:
const extraTools = getExtraToolsForSession(sessionKey);
// Pass extraTools into createOpenClawCodingTools
```

**ACP translator registration**

```typescript
// In src/acp/translator.ts
private async registerMcpToolsWithGateway(
  sessionKey: string,
  tools: AnyAgentTool[],
): Promise<void> {
  // Option 1: Direct in-process registration (if ACP server and gateway share process)
  setExtraToolsForSession(sessionKey, tools);

  // Option 2: Via gateway RPC (if ACP server is a separate process)
  // await this.gateway.request("sessions.setExtraTools", {
  //   sessionKey,
  //   tools: tools.map(t => ({
  //     name: t.name,
  //     description: t.description,
  //     parameters: t.parameters,
  //   })),
  // });
}
```

#### Option B: Inject Tools via `chat.send` Metadata

Pass tool definitions in the `chat.send` RPC call via an additional metadata field. This avoids persistent state but requires sending tool schemas with every message.

```typescript
// In src/acp/translator.ts, modify the prompt() method:
await this.gateway.request("chat.send", {
  sessionKey: session.sessionKey,
  message,
  idempotencyKey: runId,
  // New field:
  mcpTools: this.mcpTools.get(params.sessionId)?.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  })),
});
```

This approach is simpler but adds payload size to every request and requires gateway changes to accept and process the tools from the `chat.send` params.

#### Option C: ACP Translator Runs Its Own Agent Loop

Instead of relying on the gateway's tool pipeline, the ACP translator could run a standalone agent loop (using `pi-agent-core` directly), assembling both built-in and MCP tools itself. This is the most flexible but also the most invasive change.

**Not recommended** for the initial implementation because it duplicates the gateway's agent orchestration logic.

### Recommended Approach: Option A

Option A is recommended because:

1. It uses the existing gateway tool pipeline without duplicating logic.
2. Session-scoped tool storage is clean and predictable.
3. It supports both in-process and RPC-based registration.
4. It requires minimal changes to the agent runner.

**Files to modify:**

| File | Change |
|------|--------|
| `src/agents/pi-tools.ts` | Add `extraTools` parameter to `createOpenClawCodingTools` |
| `src/agents/pi-embedded-runner/run/attempt.ts` | Pass `extraTools` from session store |
| `src/gateway/server-methods/extra-tools.ts` | New file: session-scoped extra tool registry |
| `src/gateway/server-methods-list.ts` | Register new RPC method (if using RPC) |

---

## 6. Session-Scoped MCP Lifecycle

### Lifecycle State Machine

```
Session Created
    |
    v
[mcpServers provided?] --no--> Normal session (no MCP)
    |
    yes
    |
    v
McpClientManager.connect()
    |
    v
McpClientManager.discoverTools()
    |
    v
bridgeMcpTools() -> AnyAgentTool[]
    |
    v
registerMcpToolsWithGateway()
    |
    v
Session Active (tools available)
    |
    +-- tool calls routed through bridge
    |
    v
[session end / disconnect / error]
    |
    v
McpClientManager.disconnect()
    |
    v
clearExtraToolsForSession()
    |
    v
Session Cleaned Up
```

### Session Store Updates

The `AcpSession` type in `src/acp/types.ts` does not need to change. MCP state is tracked separately in the `AcpGatewayAgent` instance fields (`mcpManagers` and `mcpTools` maps, keyed by session ID).

However, the session store should expose a hook for cleanup. Add an optional `onSessionEnd` callback:

```typescript
// src/acp/session.ts - extend AcpSessionStore
export type AcpSessionStore = {
  // ... existing methods ...

  /** Remove a session and trigger cleanup. */
  removeSession: (sessionId: string) => void;
};
```

### Handling MCP Server Crashes Mid-Session

When a stdio MCP server crashes (the child process exits unexpectedly):

1. The `McpClientManager` marks the connection as unhealthy.
2. Subsequent `callTool()` calls to that server return an error result.
3. The agent sees the error in the tool result and can inform the user.
4. The bridged tools remain in the tool set (removing them mid-session could confuse the model).

```typescript
// In McpClientManager, on child process exit:
child.on("exit", (code, signal) => {
  const conn = this.connections.get(config.name);
  if (conn) {
    conn.healthy = false;
    this.opts.log(
      `mcp server ${config.name} crashed (code=${code}, signal=${signal}), ` +
      `marking unhealthy`,
    );
  }
});
```

### Graceful Cleanup

The translator must clean up MCP connections when:

1. **Session ends normally**: The ACP client disconnects or creates a new session.
2. **Gateway disconnects**: Already handled in `handleGatewayDisconnect()`.
3. **Process exit**: Use a process exit handler for safety.

```typescript
// In AcpGatewayAgent constructor or start():
process.on("beforeExit", () => {
  for (const manager of this.mcpManagers.values()) {
    void manager.disconnect();
  }
});
```

---

## 7. Security Considerations

### 7a. Stdio Server Sandboxing

Stdio MCP servers run as child processes with full access to the host system. Security measures:

- **Environment variable sanitization**: Strip sensitive variables (like `OPENCLAW_GATEWAY_TOKEN`) from the child process environment. Only pass through explicitly listed env vars from the ACP config, plus a safe baseline.
- **PATH restriction**: Consider restricting PATH for MCP server processes.
- **Resource limits**: Set `maxBuffer` on child processes to prevent memory exhaustion.

```typescript
function sanitizeEnvForMcpServer(
  configEnv: Array<{ name: string; value: string }>,
): Record<string, string> {
  // Start with a minimal baseline, not the full process.env
  const baseEnv: Record<string, string> = {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    HOME: process.env.HOME ?? "",
    LANG: process.env.LANG ?? "en_US.UTF-8",
    TERM: process.env.TERM ?? "xterm-256color",
  };

  // Add explicitly configured env vars
  for (const entry of configEnv) {
    baseEnv[entry.name] = entry.value;
  }

  return baseEnv;
}
```

### 7b. HTTP/SSE URL Validation

Validate MCP server URLs before connecting:

```typescript
function validateMcpServerUrl(url: string): void {
  const parsed = new URL(url);

  // Block obviously dangerous URLs
  const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"];
  if (blockedHosts.includes(parsed.hostname)) {
    // Allow localhost in development, but log a warning
    // In production, this should be configurable via allowlist
  }

  // Require HTTPS for non-localhost URLs
  if (parsed.protocol !== "https:" && !blockedHosts.includes(parsed.hostname)) {
    throw new Error(`MCP server URL must use HTTPS: ${url}`);
  }
}
```

### 7c. Rate Limiting

Prevent runaway tool calls to MCP servers:

```typescript
// In McpClientManager
private callCounts = new Map<string, { count: number; windowStart: number }>();
private maxCallsPerMinute = 100;

private checkRateLimit(serverName: string): void {
  const now = Date.now();
  const entry = this.callCounts.get(serverName);

  if (!entry || now - entry.windowStart > 60_000) {
    this.callCounts.set(serverName, { count: 1, windowStart: now });
    return;
  }

  entry.count += 1;
  if (entry.count > this.maxCallsPerMinute) {
    throw new Error(
      `Rate limit exceeded for MCP server ${serverName}: ` +
      `${entry.count} calls in ${Math.round((now - entry.windowStart) / 1000)}s`,
    );
  }
}
```

### 7d. Session Isolation

- MCP client managers are per-session. Different ACP sessions never share MCP connections.
- MCP server credentials (headers, env vars) are never exposed to other sessions.
- When a session ends, all MCP connections for that session are terminated.

### 7e. Timeout Handling

All MCP communication should have timeouts:

- **Connection timeout**: 30 seconds for stdio process startup and HTTP/SSE initial connection.
- **Initialization timeout**: 30 seconds for the MCP `initialize` handshake.
- **Tool call timeout**: 120 seconds per individual tool call (configurable).
- **Graceful shutdown timeout**: 5 seconds for stdio process SIGTERM before SIGKILL.

---

## 8. Testing Strategy

### 8a. Unit Tests for `McpClientManager`

File: `src/acp/mcp-client.test.ts`

```typescript
import { describe, expect, it, afterEach, vi } from "vitest";
import { McpClientManager, type McpServerStdioConfig } from "./mcp-client.js";

describe("McpClientManager", () => {
  describe("connect", () => {
    it("spawns stdio process and completes MCP handshake", async () => {
      // Use a mock MCP server script that responds to initialize and tools/list
      const config: McpServerStdioConfig = {
        type: "stdio",
        name: "test-server",
        command: "node",
        args: ["test-fixtures/mock-mcp-server.js"],
        env: [],
      };
      const manager = new McpClientManager();
      await manager.connect([config]);
      expect(manager.hasConnections).toBe(true);
      expect(manager.serverNames).toEqual(["test-server"]);
      await manager.disconnect();
    });

    it("handles connection failure gracefully", async () => {
      const config: McpServerStdioConfig = {
        type: "stdio",
        name: "broken-server",
        command: "nonexistent-binary-xyz",
        args: [],
        env: [],
      };
      const manager = new McpClientManager();
      // Should not throw - failed servers are logged and skipped
      await manager.connect([config]);
      expect(manager.hasConnections).toBe(false);
      await manager.disconnect();
    });
  });

  describe("discoverTools", () => {
    it("returns tools tagged with server name", async () => {
      // ...mock server that returns 2 tools...
      const tools = await manager.discoverTools();
      expect(tools).toHaveLength(2);
      expect(tools[0].serverName).toBe("test-server");
    });
  });

  describe("callTool", () => {
    it("routes tool call to correct server", async () => { /* ... */ });
    it("returns error result for unhealthy server", async () => { /* ... */ });
    it("returns error result when server responds with error", async () => { /* ... */ });
  });

  describe("disconnect", () => {
    it("kills all child processes", async () => { /* ... */ });
    it("is idempotent", async () => { /* ... */ });
  });
});
```

### 8b. Unit Tests for `McpToolBridge`

File: `src/acp/mcp-tool-bridge.test.ts`

```typescript
import { describe, expect, it, vi } from "vitest";
import { bridgeMcpTools, buildBridgedToolName, parseBridgedToolName, isMcpBridgedTool } from "./mcp-tool-bridge.js";
import type { McpClientManager } from "./mcp-client.js";

describe("mcp-tool-bridge", () => {
  describe("buildBridgedToolName", () => {
    it("produces namespaced name", () => {
      expect(buildBridgedToolName("dev-tools", "analyze")).toBe("mcp:dev-tools:analyze");
    });
  });

  describe("parseBridgedToolName", () => {
    it("parses valid bridged names", () => {
      const result = parseBridgedToolName("mcp:my-server:my_tool");
      expect(result).toEqual({ serverName: "my-server", toolName: "my_tool" });
    });
    it("returns null for non-MCP names", () => {
      expect(parseBridgedToolName("read_file")).toBeNull();
    });
  });

  describe("isMcpBridgedTool", () => {
    it("identifies MCP tools", () => {
      expect(isMcpBridgedTool("mcp:server:tool")).toBe(true);
      expect(isMcpBridgedTool("read_file")).toBe(false);
    });
  });

  describe("bridgeMcpTools", () => {
    it("converts MCP tools to AnyAgentTool format", () => {
      const mockManager = {
        callTool: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "result" }],
        }),
      } as unknown as McpClientManager;

      const tools = bridgeMcpTools(
        [
          {
            serverName: "test",
            name: "greet",
            description: "Says hello",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
              required: ["name"],
            },
          },
        ],
        mockManager,
      );

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("mcp:test:greet");
      expect(tools[0].label).toBe("MCP: test/greet");
      expect(tools[0].description).toBe("Says hello");
    });

    it("routes execute() through client manager", async () => {
      const callToolSpy = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "hello world" }],
      });
      const mockManager = { callTool: callToolSpy } as unknown as McpClientManager;

      const [tool] = bridgeMcpTools(
        [{ serverName: "srv", name: "greet", inputSchema: { type: "object" } }],
        mockManager,
      );

      const result = await tool.execute("call-1", { name: "Alice" });
      expect(callToolSpy).toHaveBeenCalledWith("srv", "greet", { name: "Alice" });
      expect(result.content[0]).toEqual({ type: "text", text: "hello world" });
    });

    it("handles execute() errors gracefully", async () => {
      const mockManager = {
        callTool: vi.fn().mockRejectedValue(new Error("connection lost")),
      } as unknown as McpClientManager;

      const [tool] = bridgeMcpTools(
        [{ serverName: "srv", name: "fail", inputSchema: { type: "object" } }],
        mockManager,
      );

      const result = await tool.execute("call-2", {});
      expect(result.content[0].type).toBe("text");
      expect((result.content[0] as { text: string }).text).toContain("connection lost");
      expect(result.details).toEqual(
        expect.objectContaining({ isError: true }),
      );
    });
  });
});
```

### 8c. Integration Test with Mock MCP Server

Create a simple mock MCP server for integration testing.

File: `src/acp/test-fixtures/mock-mcp-server.ts`

```typescript
#!/usr/bin/env node
/**
 * Minimal MCP server for integration tests.
 * Communicates via JSON-RPC 2.0 over stdin/stdout.
 */
import * as readline from "readline";

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line) => {
  try {
    const request = JSON.parse(line);
    const response = handleRequest(request);
    if (response) {
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  } catch {
    // Ignore parse errors
  }
});

function handleRequest(req: { id: number; method: string; params?: unknown }) {
  switch (req.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "mock-mcp-server", version: "1.0.0" },
        },
      };
    case "notifications/initialized":
      return { jsonrpc: "2.0", id: req.id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: {
          tools: [
            {
              name: "echo",
              description: "Echoes the input back",
              inputSchema: {
                type: "object",
                properties: { message: { type: "string" } },
                required: ["message"],
              },
            },
            {
              name: "add",
              description: "Adds two numbers",
              inputSchema: {
                type: "object",
                properties: {
                  a: { type: "number" },
                  b: { type: "number" },
                },
                required: ["a", "b"],
              },
            },
          ],
        },
      };
    case "tools/call": {
      const params = req.params as { name: string; arguments: Record<string, unknown> };
      if (params.name === "echo") {
        return {
          jsonrpc: "2.0",
          id: req.id,
          result: {
            content: [{ type: "text", text: String(params.arguments.message) }],
          },
        };
      }
      if (params.name === "add") {
        const sum = Number(params.arguments.a) + Number(params.arguments.b);
        return {
          jsonrpc: "2.0",
          id: req.id,
          result: {
            content: [{ type: "text", text: String(sum) }],
          },
        };
      }
      return {
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32601, message: `Unknown tool: ${params.name}` },
      };
    }
    default:
      return {
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32601, message: `Unknown method: ${req.method}` },
      };
  }
}
```

File: `src/acp/mcp-integration.test.ts`

```typescript
import { describe, expect, it, afterEach } from "vitest";
import path from "node:path";
import { McpClientManager } from "./mcp-client.js";
import { bridgeMcpTools } from "./mcp-tool-bridge.js";

describe("MCP integration", () => {
  let manager: McpClientManager;

  afterEach(async () => {
    await manager?.disconnect();
  });

  it("connects to mock server, discovers tools, and calls them", async () => {
    manager = new McpClientManager();
    await manager.connect([
      {
        type: "stdio",
        name: "mock",
        command: "bun",
        args: [path.join(__dirname, "test-fixtures/mock-mcp-server.ts")],
        env: [],
      },
    ]);

    const discovered = await manager.discoverTools();
    expect(discovered).toHaveLength(2);
    expect(discovered.map((t) => t.name)).toContain("echo");
    expect(discovered.map((t) => t.name)).toContain("add");

    // Bridge tools
    const tools = bridgeMcpTools(discovered, manager);
    expect(tools).toHaveLength(2);

    // Call echo tool
    const echoTool = tools.find((t) => t.name === "mcp:mock:echo")!;
    const echoResult = await echoTool.execute("tc-1", { message: "hello" });
    expect(echoResult.content[0]).toEqual({ type: "text", text: "hello" });

    // Call add tool
    const addTool = tools.find((t) => t.name === "mcp:mock:add")!;
    const addResult = await addTool.execute("tc-2", { a: 3, b: 4 });
    expect(addResult.content[0]).toEqual({ type: "text", text: "7" });
  });
});
```

### 8d. Translator-Level Tests

File: extend `src/acp/translator.test.ts` (or add `src/acp/translator.mcp.test.ts`)

Test that:

1. `initialize()` returns `mcpCapabilities: { http: true, sse: true }`.
2. `newSession()` with `mcpServers` creates an `McpClientManager` and stores it.
3. `loadSession()` with `mcpServers` does the same.
4. `handleGatewayDisconnect()` calls `disconnect()` on all managers.
5. Tool events for MCP-bridged tools are reported correctly.

### 8e. E2E Test

File: `src/acp/mcp.e2e.test.ts`

Full end-to-end test using the ACP client (`src/acp/client.ts`) with MCP servers:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { createAcpClient, type AcpClientHandle } from "./client.js";

describe("ACP + MCP E2E", () => {
  let handle: AcpClientHandle;

  afterEach(() => {
    handle?.agent.kill();
  });

  it("passes MCP servers during session creation and tools work", async () => {
    // Modify createAcpClient or use client.newSession directly with mcpServers
    // This test requires a running gateway and the mock MCP server
    // Mark as live test with CLAWDBOT_LIVE_TEST=1
  });
});
```

---

## 9. Estimated Effort

### Component Breakdown

| Component | File | Estimated LOC | Effort |
|-----------|------|--------------|--------|
| `McpClientManager` | `src/acp/mcp-client.ts` | 250-350 | 2-3 days |
| `McpToolBridge` | `src/acp/mcp-tool-bridge.ts` | 150-200 | 1 day |
| Translator changes | `src/acp/translator.ts` | 80-120 (delta) | 1 day |
| Gateway extra tools registry | `src/gateway/server-methods/extra-tools.ts` | 40-60 | 0.5 day |
| Agent runner integration | `src/agents/pi-tools.ts`, `pi-embedded-runner/run/attempt.ts` | 20-40 (delta) | 0.5 day |
| Mock MCP server fixture | `src/acp/test-fixtures/mock-mcp-server.ts` | 80-100 | 0.5 day |
| Unit tests | `mcp-client.test.ts`, `mcp-tool-bridge.test.ts` | 200-300 | 1-2 days |
| Integration + E2E tests | `mcp-integration.test.ts`, `mcp.e2e.test.ts` | 100-150 | 1 day |
| **Total** | | **920-1320** | **7-9 days** |

### Dependencies Between Components

```
1. McpClientManager (no dependencies, build first)
       |
2. McpToolBridge (depends on McpClientManager types)
       |
3. Gateway extra tools registry (no code dependencies, can be parallel with 1-2)
       |
4. Agent runner integration (depends on 3)
       |
5. Translator changes (depends on 1, 2, 4)
       |
6. Tests (depends on all above)
```

### Recommended Implementation Order

1. **Phase 1**: `McpClientManager` + its unit tests. Start with stdio transport only.
2. **Phase 2**: `McpToolBridge` + its unit tests.
3. **Phase 3**: Gateway extra tools registry + agent runner integration.
4. **Phase 4**: Translator changes + integration test with mock server.
5. **Phase 5**: HTTP and SSE transport implementations.
6. **Phase 6**: E2E test, security hardening, edge case handling.

---

## 10. Open Questions / Design Decisions

### Q1: Should MCP tools be visible in the agent's system prompt or discovered on-demand?

**Recommendation**: Visible in the system prompt. MCP tools should be part of the agent's tool set from session start. The LLM needs to know about available tools to decide when to use them. On-demand discovery would require a meta-tool ("list_mcp_tools") which adds complexity and reduces the LLM's ability to plan tool use.

**Alternative**: If the number of MCP tools is very large (50+), consider a "tool index" approach where only tool names and one-line descriptions are in the prompt, and full schemas are fetched on demand. This would require changes to how pi-agent-core handles tool schemas.

### Q2: Should we cache tool schemas across sessions with the same MCP server?

**Recommendation**: No, at least not initially. MCP servers can change their tool set between sessions (e.g., after an update). Each session should do a fresh `tools/list` call. The overhead is minimal (one JSON-RPC call per server per session).

**Future optimization**: If session creation latency becomes an issue, implement a short-lived cache (e.g., 5 minutes) keyed by `(command, args)` for stdio or URL for HTTP/SSE. Invalidate on connection failure.

### Q3: How to handle MCP servers that require authentication beyond what's in the ACP config?

The ACP spec provides `headers` for HTTP/SSE and `env` for stdio, which covers most auth patterns:

- **API keys**: Passed as headers (`Authorization: Bearer ...`) or env vars.
- **OAuth tokens**: The ACP client is responsible for token management. The agent receives already-valid tokens.
- **mTLS**: Not currently supported by the ACP MCP server config schema. If needed, this would require an ACP spec extension.

**Recommendation**: Rely on the ACP config as the single source of auth credentials. Document that the ACP client is responsible for refreshing tokens before they expire. If a token expires mid-session, the MCP server will return an error, and the agent will see a tool error result.

### Q4: Should we support MCP resource subscriptions or just tools?

**Recommendation**: Start with tools only. MCP resources and resource subscriptions are a separate concern:

- **Resources** (`resources/list`, `resources/read`): Could be bridged as additional context injected into the system prompt. However, this crosses the boundary between "tools the agent can call" and "context the agent receives", which is a different architectural concern.
- **Resource subscriptions** (`resources/subscribe`): These are push-based and would require an event forwarding mechanism. Too complex for the initial implementation.

**Phase 2 candidates**: Resources (as system prompt context) and prompts (`prompts/list`, `prompts/get`) could be added after the core tool bridging is stable.

### Q5: Should the ACP translator support dynamic tool list changes mid-session?

MCP servers can emit `notifications/tools/list_changed` to signal that their tool set has changed. Handling this mid-session is complex because:

1. The model may have already seen the old tool list in its context.
2. Removing tools mid-session could cause the model to reference tools that no longer exist.
3. Adding tools mid-session requires refreshing the model's tool schema.

**Recommendation**: Ignore `notifications/tools/list_changed` in the initial implementation. Log a warning. The tool set is frozen at session creation time. Revisit after the core implementation is stable.

### Q6: How should MCP tool names be sanitized for LLM compatibility?

Some LLMs have restrictions on tool names (e.g., only alphanumeric + underscores, max length). The `mcp:server:tool` naming convention uses colons, which may not be supported by all providers.

**Options**:
- Use colons: `mcp:server:tool` (clean, but may fail with some providers)
- Use double underscores: `mcp__server__tool` (safe but less readable)
- Use single underscores with prefix: `mcp_server_tool` (risk of collision)

**Recommendation**: Use underscores as separators: `mcp__serverName__toolName`. The double underscore is unlikely to appear in real tool names and is safe across all LLM providers. Update `buildBridgedToolName` and `parseBridgedToolName` accordingly.

### Q7: What happens when multiple MCP servers provide tools with the same name?

The namespace prefix (`mcp__serverName__toolName`) prevents collisions. Two servers can each have a tool called `analyze` -- they become `mcp__server1__analyze` and `mcp__server2__analyze`.

If a single server has duplicate tool names (which would be a bug in the MCP server), use the last one and log a warning.

### Q8: Should there be a configuration limit on the number of MCP servers or tools per session?

**Recommendation**: Yes, enforce sensible defaults:

- **Max MCP servers per session**: 10 (configurable via env var)
- **Max total MCP tools per session**: 100 (prevents context window bloat)
- **Max concurrent stdio processes**: System-level concern, but log warnings above 5

These limits protect against misconfigured clients and runaway resource usage.
