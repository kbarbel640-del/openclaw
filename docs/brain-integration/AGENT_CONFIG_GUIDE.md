# Brain MCP 4-Tier Memory - Agent Configuration Guide

## Overview

This guide explains how to configure an OpenClaw agent to use the Brain MCP 4-tier memory system.

## Prerequisites

1. **Brain MCP Server Running**: Ensure Brain MCP is accessible

   ```bash
   # Verify Brain MCP is running
   curl http://localhost:8765/health
   ```

2. **Brain Workspace Created**: Each agent needs its own workspace
   ```bash
   # Use Brain MCP tools to create workspace
   # Or use existing workspace ID
   ```

## Configuration

### Step 1: Get Your Agent's Brain Workspace ID

Each agent should have a dedicated Brain workspace. You can:

**Option A**: Use existing workspace

- Check your current workspaces in Brain MCP
- Use the workspace UUID

**Option B**: Create new workspace

- Create a new workspace in Brain MCP for this agent
- Note the returned workspace UUID

### Step 2: Update Agent Config

Add the `brain-tiered` memory configuration to your agent's config:

```json
{
  "memory": {
    "backend": "brain-tiered",
    "brainTiered": {
      "workspaceId": "YOUR-WORKSPACE-UUID-HERE",
      "memoryMdPath": "./memory.md",
      "dailyNotesPath": "./memory/",
      "brainMcpUrl": "http://localhost:8765",
      "tiers": {
        "escalationThreshold": 0.8,
        "minTier0Results": 3,
        "maxTier": 3,
        "timeoutMs": 5000
      }
    }
  }
}
```

### Configuration Options

| Option                      | Required | Default                 | Description                         |
| --------------------------- | -------- | ----------------------- | ----------------------------------- |
| `workspaceId`               | Yes      | -                       | Brain MCP workspace UUID            |
| `memoryMdPath`              | No       | `./memory.md`           | Path to local memory.md             |
| `dailyNotesPath`            | No       | `./memory/`             | Path to daily notes directory       |
| `brainMcpUrl`               | No       | `http://localhost:8765` | Brain MCP server URL                |
| `tiers.escalationThreshold` | No       | `0.8`                   | Score threshold to skip Brain tiers |
| `tiers.minTier0Results`     | No       | `3`                     | Minimum Tier 0 results needed       |
| `tiers.maxTier`             | No       | `3`                     | Maximum tier to escalate to (1-3)   |
| `tiers.timeoutMs`           | No       | `5000`                  | Brain MCP request timeout           |

### Step 3: Create Local Memory Files

The agent needs local memory files for Tier 0:

```bash
# In your agent's workspace directory
touch memory.md
mkdir -p memory/

# Add initial content
echo "# Agent Memory" > memory.md
echo "" >> memory.md
echo "## Notes" >> memory.md
```

### Step 4: Verify Configuration

Test that the configuration works:

```bash
# Start your agent and check logs for:
# - "brain-tiered" backend initialization
# - Tier 0 search results
# - Brain MCP connectivity (or graceful fallback)
```

## Multi-Agent Setup

For 8 agents, each needs:

| Agent   | Workspace ID | memory.md Path              |
| ------- | ------------ | --------------------------- |
| Agent 1 | `uuid-1`     | `./agents/agent1/memory.md` |
| Agent 2 | `uuid-2`     | `./agents/agent2/memory.md` |
| Agent 3 | `uuid-3`     | `./agents/agent3/memory.md` |
| ...     | ...          | ...                         |

### Example Multi-Agent Config Structure

```
workspace/
├── agents/
│   ├── researcher/
│   │   ├── config.json      # Has brainTiered config with workspace-id-1
│   │   ├── memory.md
│   │   └── memory/
│   │       └── 2025-02-06.md
│   ├── writer/
│   │   ├── config.json      # Has brainTiered config with workspace-id-2
│   │   ├── memory.md
│   │   └── memory/
│   └── ...
```

## Tier Behavior

### Tier 0 (Local)

- **Always searched first** (enforced by code)
- Searches `memory.md` and `memory/*.md`
- Latency: <1ms

### Tier 1 (Brain quick_search)

- Triggered when Tier 0 insufficient
- Fast semantic search
- Latency: <100ms

### Tier 2 (Brain unified_search semantic)

- Triggered when Tier 1 insufficient
- Deeper semantic search
- Latency: <500ms

### Tier 3 (Brain unified_search full)

- Triggered when Tier 2 insufficient
- Comprehensive search with relationships
- Latency: <3000ms

## Graceful Degradation

If Brain MCP is unavailable:

- Agent continues working with Tier 0 only
- No crashes or errors
- Logs indicate Brain MCP unavailability

## Troubleshooting

### "brainTiered.workspaceId is required"

- Add `workspaceId` to your config

### "Brain MCP not available"

- Check Brain MCP server is running
- Verify URL in config
- Check network connectivity

### No results from Brain tiers

- Verify workspace has memories
- Check workspace ID is correct
- Ensure Brain MCP has searchable content

## Migration from Existing Backends

### From "builtin"

```json
// Before
{ "memory": { "backend": "builtin" } }

// After
{
  "memory": {
    "backend": "brain-tiered",
    "brainTiered": {
      "workspaceId": "your-workspace-uuid"
    }
  }
}
```

### From "qmd"

```json
// Before
{ "memory": { "backend": "qmd", "qmd": { ... } } }

// After
{
  "memory": {
    "backend": "brain-tiered",
    "brainTiered": {
      "workspaceId": "your-workspace-uuid",
      "memoryMdPath": "./memory.md"  // Use same path as qmd
    }
  }
}
```

## Rollback

To revert to previous backend:

```json
// Change back to builtin
{ "memory": { "backend": "builtin" } }

// Or qmd
{ "memory": { "backend": "qmd", "qmd": { ... } } }
```

No data loss - local files remain intact.
