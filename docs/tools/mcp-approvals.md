---
summary: "Approval workflows for MCP tool execution"
read_when:
  - Configuring approval requirements for MCP tools
  - Setting up allowlists for trusted MCP tools
  - Understanding MCP approval modes (none, always, allowlist)
title: "MCP Approvals"
---

# MCP approvals

MCP approvals add a human-in-the-loop gate before MCP tools execute. This is useful when
connecting to untrusted or powerful MCP servers — you can require explicit approval before
any tool runs, or approve only specific tools via an allowlist.

This mirrors the [exec approvals](/tools/exec-approvals) pattern used for shell commands.

## Configuration

Approval settings are per-server in the `mcp.servers` config:

```json5
{
  mcp: {
    servers: {
      // Trusted server — no approval needed
      "file-reader": {
        command: "npx",
        args: ["-y", "@safe/mcp-reader"],
        approval: "none"   // default
      },

      // Dangerous server — always require approval
      "admin-tools": {
        command: "npx",
        args: ["-y", "@admin/mcp-tools"],
        approval: "always"
      },

      // Mixed server — approve only unlisted tools
      "dev-tools": {
        command: "npx",
        args: ["-y", "@dev/mcp-tools"],
        approval: "allowlist",
        approvedTools: ["read_file", "list_dir", "search"]
      }
    }
  }
}
```

## Approval modes

| Mode | Behavior |
|------|----------|
| `none` | Execute without approval (default) |
| `always` | Every tool call requires approval before execution |
| `allowlist` | Tools in `approvedTools` run freely; others require approval |

## Config reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `approval` | `"none" \| "always" \| "allowlist"` | `"none"` | Approval mode for this server's tools |
| `approvedTools` | `string[]` | `[]` | Tool names that skip approval when mode is `"allowlist"` |

## How approval works

When a tool call requires approval:

1. An approval request is registered with the `McpApprovalManager`.
2. The tool execution **blocks** waiting for a decision.
3. A decision of `"allow"`, `"deny"`, or `"timeout"` resolves the request.
4. On `allow` → tool executes normally.
5. On `deny` → tool returns an error result to the agent.
6. On `timeout` (default: 60 seconds) → tool returns a timeout error to the agent.

## Allowlist examples

### Read-only tools approved, write tools gated

```json5
{
  mcp: {
    servers: {
      "database": {
        command: "npx",
        args: ["-y", "@db/mcp-server"],
        approval: "allowlist",
        approvedTools: [
          "query",        // SELECT queries — safe
          "list_tables",  // Schema inspection — safe
          "describe"      // Column info — safe
          // "insert", "update", "delete" — require approval
        ]
      }
    }
  }
}
```

### Per-server trust levels

```json5
{
  mcp: {
    servers: {
      // Internal tools — fully trusted
      "internal-api": {
        command: "node",
        args: ["./mcp-internal.js"],
        approval: "none"
      },
      // Third-party tools — gate everything
      "third-party": {
        url: "https://external.example.com/mcp",
        transport: "sse",
        approval: "always"
      }
    }
  }
}
```

## Combining with tool policy

MCP approvals work independently of [tool policy](/tools#tool-groups-shorthands). A tool must
pass **both** checks:

1. **Tool policy** (`tools.allow` / `tools.deny`) determines if a tool is available to the agent.
2. **MCP approval** determines if an available tool requires human approval before execution.

You can use `group:mcp` in tool policy to allow/deny all MCP tools, and then use per-server
`approval` settings for fine-grained control over which tools need human approval.

```json5
{
  tools: {
    allow: ["group:mcp"]  // Make all MCP tools available
  },
  mcp: {
    servers: {
      "risky-server": {
        command: "npx",
        args: ["-y", "@risky/tools"],
        approval: "always"  // But require approval for this server
      }
    }
  }
}
```
