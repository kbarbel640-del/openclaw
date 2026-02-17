---
summary: "MCP tool diagnostic events, OpenTelemetry integration, and health monitoring"
read_when:
  - Monitoring MCP tool performance and errors
  - Setting up OTEL traces for MCP tool calls
  - Debugging slow or failing MCP tool invocations
  - Configuring MCP server health checks and auto-reconnect
title: "MCP Diagnostics"
---

# MCP diagnostics

MCP tool calls emit diagnostic events through the OpenClaw event bus. These events are
picked up by the [diagnostics-otel](/diagnostics/flags) extension to produce
OpenTelemetry metrics and traces.

## Diagnostic events

Two event types are emitted for every MCP tool call:

### `mcp.tool.call`

Emitted **before** a tool executes.

| Field        | Type              | Description                  |
| ------------ | ----------------- | ---------------------------- |
| `type`       | `"mcp.tool.call"` | Event discriminant           |
| `serverName` | `string`          | MCP server name (config key) |
| `toolName`   | `string`          | Tool name on the MCP server  |
| `sessionKey` | `string?`         | Session key (when available) |
| `sessionId`  | `string?`         | Session ID (when available)  |

### `mcp.tool.result`

Emitted **after** a tool completes (success or failure).

| Field        | Type                | Description                         |
| ------------ | ------------------- | ----------------------------------- |
| `type`       | `"mcp.tool.result"` | Event discriminant                  |
| `serverName` | `string`            | MCP server name                     |
| `toolName`   | `string`            | Tool name on the MCP server         |
| `durationMs` | `number`            | Execution time in milliseconds      |
| `isError`    | `boolean`           | Whether the call failed             |
| `error`      | `string?`           | Error message (when `isError=true`) |
| `sessionKey` | `string?`           | Session key (when available)        |
| `sessionId`  | `string?`           | Session ID (when available)         |

## OTEL metrics

When the `diagnostics-otel` extension is enabled, MCP events produce:

| Metric                          | Type      | Attributes                                                         |
| ------------------------------- | --------- | ------------------------------------------------------------------ |
| `openclaw.mcp.tool.call`        | Counter   | `openclaw.mcp.server`, `openclaw.mcp.tool`                         |
| `openclaw.mcp.tool.result`      | Counter   | `openclaw.mcp.server`, `openclaw.mcp.tool`, `openclaw.mcp.isError` |
| `openclaw.mcp.tool.duration_ms` | Histogram | `openclaw.mcp.server`, `openclaw.mcp.tool`, `openclaw.mcp.isError` |

## OTEL traces

When traces are enabled (`diagnostics.otel.traces=true`), each `mcp.tool.result` event creates
a span:

- **Span name**: `openclaw.mcp.tool.result`
- **Duration**: Matches `durationMs` from the event
- **Status**: `ERROR` when `isError=true`, with the error message
- **Attributes**: Server name, tool name, error flag

## Configuration

MCP diagnostics require no additional configuration beyond enabling diagnostics:

```json5
{
  diagnostics: {
    enabled: true,
    otel: {
      traces: true, // Enable trace spans for MCP calls
      metrics: true, // Enable counters and histograms
      // endpoint: "http://localhost:4318"  // OTLP endpoint
    },
  },
}
```

## Debugging MCP performance

Use the metrics to identify:

- **Slow tools**: High `openclaw.mcp.tool.duration_ms` values
- **Failing tools**: High `openclaw.mcp.tool.result` count with `isError=1`
- **Hot tools**: High `openclaw.mcp.tool.call` count — tools called frequently

Example Grafana query for error rate by server:

```
sum(rate(openclaw_mcp_tool_result_total{openclaw_mcp_isError="1"}[5m])) by (openclaw_mcp_server)
/
sum(rate(openclaw_mcp_tool_result_total[5m])) by (openclaw_mcp_server)
```

## Health checks & auto-reconnect

MCP servers can become unresponsive without cleanly disconnecting (e.g., the process hangs,
a network partition occurs). Health monitoring detects these failures and reconnects
automatically.

### Enabling health checks

Set `healthCheckIntervalMs` on any MCP server config:

```json5
{
  mcp: {
    servers: {
      "my-server": {
        command: "npx",
        args: ["-y", "my-mcp-server"],
        healthCheckIntervalMs: 30000, // Ping every 30 seconds
      },
    },
  },
}
```

Set to `0` or omit to disable health checks for that server (the default).

### How it works

1. A periodic timer sends a JSON-RPC `ping` to the server.
2. If the ping succeeds, the failure counter resets.
3. After **3 consecutive failed pings**, the monitor triggers a reconnect.
4. Reconnect tears down the old transport and performs a full re-handshake
   (initialize → tools/list), refreshing the connection in-place.
5. If reconnection fails, the server status moves to `"error"` and the next
   health-check cycle will try again.

### Choosing an interval

| Use case                          | Recommended interval     |
| --------------------------------- | ------------------------ |
| Local stdio server                | `30000`–`60000` (30–60s) |
| Remote SSE server over network    | `15000`–`30000` (15–30s) |
| High-availability critical server | `5000`–`10000` (5–10s)   |
| Low-priority / rarely used        | `120000`+ or disabled    |

Shorter intervals detect failures faster but produce more network/IPC traffic.
The timer uses `unref()` so it won't prevent Node.js from exiting.

### CLI health check

You can manually check health via the CLI:

```bash
openclaw mcp status          # Shows connection status for all servers
openclaw mcp call-tool <server> <tool> --params '{}'  # Quick smoke test
```
