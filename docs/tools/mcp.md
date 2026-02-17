---
summary: "MCP (Model Context Protocol) client integration — connect external tool servers to OpenClaw agents"
read_when:
  - Configuring MCP servers
  - Adding external tools via MCP
  - Troubleshooting MCP connections
title: "MCP Tools"
---

# MCP (Model Context Protocol) Tools

OpenClaw includes a built-in MCP client that connects to external MCP servers
and exposes their tools to agents as native tools. This lets you extend the
agent's capabilities with any MCP-compatible tool server — filesystem access,
GitHub, databases, APIs, and more.

## Configuration

Add an `mcp` section to your `openclaw.json`:

```json5
{
  mcp: {
    servers: {
      // stdio transport (default) — spawns a local process
      filesystem: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/docs"],
      },

      // SSE transport — connects to a remote HTTP endpoint
      "remote-api": {
        transport: "sse",
        url: "https://mcp.example.com/sse",
        headers: { Authorization: "Bearer ${MCP_API_TOKEN}" },
      },

      // Environment variable injection
      github: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: {
          GITHUB_TOKEN: "${GITHUB_TOKEN}",
        },
      },

      // Disabled server (kept in config but not started)
      experimental: {
        command: "my-experimental-server",
        enabled: false,
      },
    },
  },
}
```

### Server config fields

| Field          | Type       | Default   | Description |
|----------------|------------|-----------|-------------|
| `transport`    | `"stdio"` \| `"sse"` | `"stdio"` | Transport protocol |
| `command`      | `string`   | —         | Command to spawn (stdio only, **required** for stdio) |
| `args`         | `string[]` | `[]`      | Command arguments |
| `env`          | `Record<string, string>` | `{}` | Environment variables (supports `${VAR}` references) |
| `url`          | `string`   | —         | SSE endpoint URL (**required** for SSE) |
| `headers`      | `Record<string, string>` | `{}` | HTTP headers for SSE transport |
| `enabled`      | `boolean`  | `true`    | Enable/disable this server |
| `toolPrefix`   | `string`   | server key | Override tool name prefix |
| `toolTimeoutMs`| `number`   | `30000`   | Timeout for individual tool calls |
| `maxRetries`   | `number`   | `3`       | Connection retry attempts |

### Top-level MCP config

| Field     | Type      | Default | Description |
|-----------|-----------|---------|-------------|
| `enabled` | `boolean` | `true`  | Disable all MCP connections |
| `servers` | `object`  | `{}`    | Server definitions keyed by name |

## Tool naming

MCP tools are automatically prefixed to prevent name collisions:

```
mcp_{serverName}_{toolName}
```

For example, a tool called `list_repos` from a server named `github` becomes `mcp_github_list_repos`.

You can customize the prefix:

```json5
{
  mcp: {
    servers: {
      "my-github-server": {
        command: "github-mcp",
        toolPrefix: "gh",  // tools will be mcp_gh_*
      },
      "direct-tools": {
        command: "my-server",
        toolPrefix: "",     // no prefix — tools keep their original names
      },
    },
  },
}
```

## Tool policy

MCP tools integrate with the standard [tool policy](/tools#tool-groups-shorthands) system.

Use `group:mcp` to allow or deny all MCP tools:

```json5
{
  tools: {
    // Allow MCP tools alongside coding tools
    profile: "coding",
    alsoAllow: ["group:mcp"],
  },
}
```

Deny specific MCP tools by name:

```json5
{
  tools: {
    deny: ["mcp_github_delete_repo"],
  },
}
```

With the `full` profile (default), all MCP tools are available. With `coding` or `messaging`,
MCP tools must be explicitly allowed via `alsoAllow: ["group:mcp"]` or individual tool names.

## CLI commands

```bash
# Show status of MCP server connections
openclaw mcp status
openclaw mcp status --json

# List all tools from connected servers
openclaw mcp list-tools
openclaw mcp list-tools --json

# Validate MCP config without connecting
openclaw mcp validate
```

## Lifecycle

MCP servers are started when the gateway starts and disconnected on shutdown:

1. **Startup**: Servers are spawned/connected in parallel during gateway initialization
2. **Tool discovery**: Each server's tools are listed via the MCP `tools/list` method
3. **Runtime**: Tool calls are proxied to the appropriate MCP server
4. **Shutdown**: All servers are gracefully disconnected (SIGTERM → SIGKILL after 3s for stdio)

Config changes to MCP servers currently require a gateway restart.

## Troubleshooting

### Debug logging

Set `OPENCLAW_MCP_DEBUG=1` to enable verbose MCP logging:

```bash
OPENCLAW_MCP_DEBUG=1 openclaw gateway run
```

### Common issues

- **Server not found**: Ensure the command exists in your PATH. Use absolute paths if needed.
- **Timeout on initialize**: The server may be slow to start. Increase `toolTimeoutMs`.
- **Environment variables**: Use `${VAR}` syntax in `env` — values are resolved from the parent process environment.
- **SSE connection refused**: Check the URL and ensure the MCP server is running and accessible.

### Server status

A server can be in one of these states:

| Status       | Description |
|--------------|-------------|
| `connecting` | Handshake in progress |
| `connected`  | Ready — tools are available |
| `error`      | Failed to connect (check logs) |
| `closed`     | Disconnected |

## Supported MCP features

| Feature | Supported |
|---------|-----------|
| `tools/list` | ✓ |
| `tools/call` | ✓ |
| Tool text content | ✓ |
| Tool image content | ✓ |
| Tool resource content | ✓ (as text) |
| Stdio transport | ✓ |
| SSE transport | ✓ |
| `resources/*` | ✗ (planned) |
| `prompts/*` | ✗ (planned) |
| `sampling/*` | ✗ (planned) |
