# OpenClaw Architecture

## Session Types

OpenClaw manages three types of session contexts:

### 1. Agent Sessions (`agent`)
- Standard agent sessions running in the main process
- Can be triggered by messaging channels, web UI, or CLI
- Have access to full tool suite based on configuration
- Example: Direct messages via Signal, Telegram, Discord

### 2. Isolated Sessions (`isolated`)
- Sub-agent sessions spawned via `sessions_spawn`
- Run independently with their own context
- Can use different models or tool configurations
- Results are announced back to the parent session
- Cleanup configurable (delete or keep)

### 3. Embedded Sessions (`embedded`)
- One agent calling another within the same turn
- Shared or inherited context depending on configuration
- Used for delegation without spawning background tasks

## Agent Configuration

Agents are defined in `agents.list[]` with:

- **`id`**: Unique identifier (e.g., "main", "researcher", "helper")
- **`default`**: Boolean marking the default agent
- **`name`**: Human-readable name
- **`model`**: Primary model configuration with optional fallbacks
- **`workspace`**: Working directory for file operations
- **`tools`**: Tool policy (profile, allow/deny lists)
- **`sandbox`**: Sandbox configuration (Docker isolation)
- **`subagents`**: Allowlist of agent IDs this agent can spawn

## Runtime String Components

The runtime line in the system prompt shows:

```
agent={agentId} | host={hostname} | repo={repoPath} | os={os} | node={nodeVersion} | model={model} | channel={channel} | capabilities={caps}
```

### Key Fields:
- **`agent`**: Agent ID from config (not session type)
- **`host`**: Hostname of the machine running the gateway
- **`repo`**: Workspace or repository root
- **`os`**: Operating system (Linux/macOS/Windows + version)
- **`node`**: Node.js version
- **`model`**: Active model (provider/model format)
- **`channel`**: Active messaging channel (signal, telegram, discord, etc.)
- **`capabilities`**: Channel-specific features available

## Session Scoping

Configured via `session.scope` and `session.dmScope`:

### Global Scope (`session.scope: "global"`)
- Single session shared across all contexts
- Continuous conversation regardless of source

### Per-Sender Scope (`session.scope: "per-sender"`)
- Separate sessions per user
- Maintains individual conversation history

### DM Scope Options (`session.dmScope`)
- **`main`**: All DMs share one session (continuity across peers)
- **`per-peer`**: Separate session per peer
- **`per-channel-peer`**: Isolated by channel + peer
- **`per-account-channel-peer`**: Isolated by account + channel + peer

## Tool Policy

Tools are controlled by:

1. **Global policy** (`tools.profile`, `tools.allow/deny`)
2. **Per-agent overrides** (`agents.list[].tools`)
3. **Per-provider overrides** (`tools.byProvider`)
4. **Sandbox restrictions** (`agents.list[].sandbox.tools`)

### Tool Profiles:
- **`minimal`**: Read-only tools (read, web_fetch, memory_search)
- **`coding`**: File operations + exec (no messaging)
- **`messaging`**: Communication tools (message, cron, nodes)
- **`full`**: All tools enabled

### Policy Resolution:
1. Start with profile allowlist
2. Add `alsoAllow` entries
3. Remove `deny` entries
4. Apply provider-specific overrides
5. Apply sandbox restrictions (if active)

## Memory Architecture

Memory search (`memorySearch`) provides semantic search over:

- `MEMORY.md` (curated long-term memory)
- `memory/*.md` (daily/topic-specific notes)
- `memory/YYYY-MM-DD.md` (daily logs)
- Optional: session transcripts (experimental)

### Providers:
- **OpenAI**: `text-embedding-3-small` or `text-embedding-3-large`
- **Gemini**: `text-embedding-004`
- **Local**: GGUF models via node-llama-cpp

### Storage:
- SQLite index (per-agent by default)
- Optional `sqlite-vec` extension for vector search
- Hybrid BM25 + vector search for best results

### Sync Strategies:
- **On session start**: Index before first turn
- **On search**: Lazy indexing when search is called
- **Watch mode**: Auto-reindex on file changes (chokidar)
- **Batch processing**: Use provider batch APIs for efficiency

## Sandbox Isolation

When `agents.list[].sandbox.mode` is enabled:

- Docker container per session (or per agent)
- Read-only root filesystem with tmpfs mounts
- Network isolation configurable
- Workspace access: none / ro / rw
- Tool restrictions enforced at container boundary

### Browser Sandboxing:
- Separate container with CDP + optional VNC
- Isolated profile per session
- Auto-pruning based on idle time / max age

## Channel Bindings

Map agents to specific channels via `bindings[]`:

```json
{
  "agentId": "support",
  "match": {
    "channel": "telegram",
    "peer": {
      "kind": "group",
      "id": "-1001234567890"
    }
  }
}
```

### Match Criteria:
- **`channel`**: Channel ID (telegram, signal, discord, etc.)
- **`accountId`**: Multi-account channel support
- **`peer.kind`**: dm / group / channel
- **`peer.id`**: Peer identifier (varies by channel)
- **`guildId`**: Discord guild (server) ID
- **`teamId`**: Slack team/workspace ID

## Message Queue Modes

Control how rapid messages are batched:

- **`steer`**: Last message steers (older messages discarded)
- **`followup`**: Process as follow-up turns
- **`collect`**: Batch all messages in one turn
- **`steer-backlog`**: Steer + mention skipped count
- **`queue`**: FIFO queue (all processed eventually)
- **`interrupt`**: Cancel current turn, process new message

Configured globally (`messages.queue.mode`) or per-channel (`messages.queue.byChannel`).

## Heartbeat System

Periodic agent polling configured via `agents.defaults.heartbeat`:

- **`every`**: Duration string (e.g., "5m", "1h")
- **`activeHours`**: Optional time window restriction
- **`prompt`**: Custom heartbeat prompt (default: read HEARTBEAT.md)
- **`target`**: Delivery target ("last", channel ID, or "none")
- **`session`**: Optional session key override
- **`model`**: Optional model override for heartbeats

### Special Responses:
- **`HEARTBEAT_OK`**: Acknowledge, no action needed
- **Alerts**: Any other response is delivered to target

## Cron Jobs

Scheduled tasks via `cron` tool:

### Schedule Types:
- **`at`**: One-shot at specific timestamp
- **`every`**: Recurring interval with optional anchor
- **`cron`**: Traditional cron expressions with timezone

### Payload Types:
- **`systemEvent`**: Inject text into main session
- **`agentTurn`**: Spawn isolated agent run with message

### Critical Constraints:
- `sessionTarget: "main"` requires `payload.kind: "systemEvent"`
- `sessionTarget: "isolated"` requires `payload.kind: "agentTurn"`

## Gateway Modes

### Local Mode (`gateway.mode: "local"`)
- Gateway runs on same machine as CLI
- WebSocket server on configurable port
- Optional TLS with auto-generated certs

### Remote Mode (`gateway.mode: "remote"`)
- Connect to remote gateway via WebSocket
- SSH tunneling supported (`gateway.remote.sshTarget`)
- TLS fingerprint pinning for security

### Tailscale Integration
- **Serve**: Expose on tailnet (authenticated users only)
- **Funnel**: Public internet access (requires password auth)
- Auto-reset on exit (configurable)

## Node Architecture

Paired devices (phones, tablets, servers) that extend capabilities:

### Node Claims:
- **Browser control**: Remote CDP access
- **Camera**: Photo/video capture
- **Screen recording**: Device screen capture
- **Location**: GPS coordinates
- **Command execution**: Remote shell access

### Discovery:
- mDNS for local network
- Wide-area DNS for internet
- Manual pairing via tokens

### Security:
- Gateway-mediated communication
- Command allowlists/denylists
- Optional approval flows

## Skills System

User-provided tools loaded from:
- `~/.openclaw/workspace/skills/` (default)
- Additional directories via `skills.load.extraDirs`

### Skill Structure:
```
skills/
  skill-name/
    SKILL.md          # Agent instructions
    skill.json        # Metadata + tool definitions
    scripts/          # Executable scripts
    assets/           # Data files, prompts, etc.
```

### Skill Metadata:
- **`id`**: Unique identifier
- **`name`**: Human-readable name
- **`description`**: What the skill does
- **`tools`**: Tool definitions (function schemas)
- **`userInvocable`**: Expose as chat command
- **`env`**: Environment variable requirements

## Plugin System

Plugins extend OpenClaw with:
- New messaging channels
- Auth providers
- Memory backends
- Tool capabilities

### Plugin Lifecycle:
1. Load from `~/.openclaw/extensions/` or `plugins.load.paths`
2. Filter by `plugins.allow` / `plugins.deny`
3. Initialize with `plugins.entries.{id}.config`
4. Hook into lifecycle events (onLoad, onReady, onShutdown)

### Built-in Slots:
- **`memory`**: Long-term memory provider (exclusive)
- Future: TTS, STT, embedding providers

## Configuration Hot Reload

Configured via `gateway.reload.mode`:

- **`off`**: No automatic reload
- **`restart`**: Full process restart
- **`hot`**: In-place config reload (limited scope)
- **`hybrid`**: Hot reload when safe, restart otherwise

Debounce window prevents rapid rewrites from triggering multiple reloads.

---

**Last Updated:** 2026-02-02
**OpenClaw Version:** 2026.1.30
