# Luna System — Technical Reference

> Last updated: 2026-02-26
> Version: openclaw 2026.2.3
> Node: 22.12.0+ · pnpm 10.23.0 · ESM

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Structure](#2-repository-structure)
3. [Gateway Architecture](#3-gateway-architecture)
4. [Agent System](#4-agent-system)
5. [Channels](#5-channels)
6. [Auto-Reply Pipeline](#6-auto-reply-pipeline)
7. [Luna Dashboard](#7-luna-dashboard)
8. [Configuration System](#8-configuration-system)
9. [Memory System](#9-memory-system)
10. [Plugin & Extension System](#10-plugin--extension-system)
11. [Infrastructure Layer](#11-infrastructure-layer)
12. [End-to-End Message Flow](#12-end-to-end-message-flow)
13. [Key Files Reference](#13-key-files-reference)
14. [Recent Changes](#14-recent-changes)

---

## 1. System Overview

**Luna** is the primary orchestrator agent in the OpenClaw multi-agent system. It receives messages from users across various channels (Telegram, Discord, Slack, webchat, etc.), routes them through the agent runtime, and delivers streaming responses back.

### Core Components at a Glance

```
User (Telegram / Discord / Slack / WebChat)
        │
        ▼
  ┌─────────────────────────────────────┐
  │     OpenClaw Gateway (:18789)       │  ← WebSocket + HTTP server
  │   src/gateway/server.impl.ts        │
  └───────────┬─────────────────────────┘
              │
    ┌─────────▼──────────┐
    │   Agent Runtime    │  ← pi-embedded-runner, model selection, tools
    │  src/agents/       │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │  Channel Adapters  │  ← Telegram, Discord, Slack, Signal, iMessage...
    │  src/channels/     │
    └────────────────────┘
              │
    ┌─────────▼──────────┐
    │   Luna Dashboard   │  ← Next.js UI on :4000
    │  luna-dashboard/   │
    └────────────────────┘
```

### Agent Registry

| Agent  | Session Key       | Role                                    |
| ------ | ----------------- | --------------------------------------- |
| Luna   | `agent:main:main` | Main orchestrator, default chat handler |
| Vulcan | `agent:vulcan`    | System engineering, TypeScript/Python   |
| Aegis  | `agent:aegis`     | Security audits, auth, permissions      |
| Mars   | `agent:mars`      | Market intelligence (Shopee/Lazada)     |
| John   | `agent:john`      | Deep web research, fact-checking        |
| Muse   | `agent:muse`      | UI/UX design, asset generation          |
| Freya  | `agent:freya`     | E-commerce operations (Lazada)          |
| Kairos | `agent:kairos`    | TikTok/social media strategy            |

---

## 2. Repository Structure

```
openclaw/
├── src/                        # All TypeScript source
│   ├── agents/                 # Agent runtime (311 files)
│   ├── gateway/                # WebSocket gateway server (131 files)
│   ├── auto-reply/             # Reply routing and processing (73 files)
│   ├── channels/               # Channel core logic
│   ├── config/                 # Config loading and validation
│   ├── infra/                  # Infrastructure utilities (152 files)
│   ├── memory/                 # Vector DB / memory system
│   ├── routing/                # Message routing
│   ├── commands/               # CLI commands
│   ├── telegram/               # Telegram channel (85 files)
│   ├── discord/                # Discord channel (44 files)
│   ├── slack/                  # Slack channel (36 files)
│   ├── signal/                 # Signal channel (24 files)
│   ├── imessage/               # iMessage channel (16 files)
│   ├── line/                   # LINE channel (36 files)
│   ├── feishu/                 # Feishu/Lark channel (19 files)
│   ├── cli/                    # CLI entry and progress
│   ├── media/                  # Media pipeline
│   └── plugin-sdk/             # Plugin type definitions
├── luna-dashboard/             # Next.js dashboard (port 4000)
│   ├── app/                    # App Router pages
│   ├── components/             # React components (36 files)
│   ├── hooks/                  # React hooks
│   └── lib/                    # Client libraries (32 files)
├── extensions/                 # 32 channel/feature plugins
├── apps/                       # Mobile & desktop apps
│   ├── ios/
│   ├── android/
│   └── macos/
├── scripts/                    # Build and automation scripts
├── skills/                     # Bundled agent skills
├── docs/                       # Documentation
├── dist/                       # Compiled output
└── package.json                # Version 2026.2.3
```

---

## 3. Gateway Architecture

The gateway is the central hub — a WebSocket + HTTP server that every client connects to.

### Entry Point

| File                         | Size | Purpose                                |
| ---------------------------- | ---- | -------------------------------------- |
| `src/gateway/server.impl.ts` | 21KB | Main server init, loads all subsystems |
| `src/gateway/server.ts`      | 229B | Exports `startGatewayServer()`         |

**Server startup sequence:**

1. Load config (`src/config/config.ts`)
2. Initialize memory/vector DB
3. Start HTTP server (`server-http.ts`) — Hono framework
4. Start WebSocket server (`server-ws-runtime.ts`)
5. Load channel plugins (`server-channels.ts`)
6. Start heartbeat (`auto-reply/heartbeat.ts`)
7. Start cron jobs (`server-cron.ts`)
8. Start Bonjour discovery (`server-discovery.ts`)

### WebSocket Protocol

**Connection URL:** `ws://127.0.0.1:18789/?token={gatewayToken}`

**Auth:** Token passed as URL query param or in WebSocket headers. Without token → 1008 Unauthorized disconnect.

**Connection file:** `src/gateway/server/ws-connection.ts`

**Message types:**

- `chat` — Assistant messages (delta streaming + final)
- `agent` — Agent lifecycle events, tool calls, thinking notes
- `ping/pong` — Keepalive (every 30s from client)

### Chat Handling — `src/gateway/server-chat.ts`

This is the core broadcast logic connecting agent runs to WebSocket clients.

```typescript
// Key types
type ChatRunEntry = { sessionKey: string; clientRunId: string };
type ChatRunState = {
  registry: ChatRunRegistry; // pending run queue per session
  buffers: Map<string, string>; // streaming text buffers per run
  deltaSentAt: Map<string, number>; // throttle: 150ms min between deltas
  abortedRuns: Map<string, number>;
};
```

**Event flow:**

1. Agent emits `assistant` stream event with `data.text`
2. `emitChatDelta()` → sanitizes text, merges into buffer, broadcasts `{ state: "delta" }`
3. Agent emits `lifecycle` event with `phase: "end"` or `"error"`
4. `emitChatFinal()` → broadcasts `{ state: "final" }` with full accumulated text

**Tool event handling (verbose off):**

- Normally tool events are suppressed when `verboseDefault` is not set
- Minimal summary (name + phase + toolCallId) is still broadcast for thinking notes in webchat
- Full tool events only sent to specific `toolEventRecipients` (connections that subscribed)

**Heartbeat suppression:**

- Heartbeat runs check `resolveHeartbeatVisibility({ cfg, channel: "webchat" })`
- If `showOk: false`, heartbeat results are not broadcast to webchat

### Text Sanitization — `src/gateway/chat-response-text.ts`

```typescript
// Removes <final>...</final> wrapper tags (used by kimi-k2.5 and similar models)
// Handles partial streaming tags: </final (without closing >) also stripped
export function sanitizeAssistantText(raw: string): string {
  let text = raw.replace(/<\/?final>?/g, ""); // >? makes > optional
  while (LOOP_DONE_SENTINEL_REGEX.test(text)) {
    text = text.replace(LOOP_DONE_SENTINEL_REGEX, "");
  }
  return text;
}

// Merges streaming buffer chunks intelligently
// Handles: snapshot providers, delta providers, corrected tokens, overlap dedup
export function mergeAssistantTextBuffer(previous: string, incoming: string): string;
```

**Why `>?` in the regex:** During streaming, partial closing tags like `</final` (missing `>`) arrive mid-chunk. Making `>` optional strips both complete and partial tags.

### Session Management

| File                              | Size   | Purpose                              |
| --------------------------------- | ------ | ------------------------------------ |
| `src/gateway/session-utils.ts`    | 21.9KB | Session file I/O, validation, repair |
| `src/gateway/session-utils.fs.ts` | 12.3KB | File system operations               |
| `src/gateway/sessions-patch.ts`   | 10.6KB | JSON patch operations                |

- Sessions stored as `.jsonl` files in `~/.openclaw/sessions/`
- One JSON object per line = one conversation turn
- Session key format: `agent:{agentId}:{sessionId}`

### Other Gateway Components

| File                       | Purpose                                |
| -------------------------- | -------------------------------------- |
| `server-channels.ts`       | Creates channel manager, loads plugins |
| `server-cron.ts`           | Cron job scheduling                    |
| `server-discovery.ts`      | Bonjour/mDNS local network discovery   |
| `server-tailscale.ts`      | Tailscale VPN remote access            |
| `server-browser.ts`        | Browser automation service             |
| `config-reload.ts`         | Hot config reload without restart      |
| `server-runtime-config.ts` | Runtime config resolution              |
| `server-startup-log.ts`    | Startup diagnostic logging             |

---

## 4. Agent System

Located in `src/agents/` (311 files).

### Execution Engine

**Core runner:** `src/agents/pi-embedded-runner.ts`

Built on top of `@mariozechner/pi-agent-core` v0.51.3. Manages the actual LLM calls, tool execution loop, and event publishing.

**Run lifecycle:**

```
run() → attempt.ts → pi-embedded-runner
  └─ Load system prompt (system-prompt.ts)
  └─ Select model (model-selection.ts)
  └─ Auth profile (model-auth.ts)
  └─ Execute LLM call (streaming)
  └─ Parse tool calls → execute tools (pi-tools.ts)
  └─ Re-submit with tool results
  └─ Loop until done or timeout
  └─ Publish events via pi-embedded-subscribe.ts
```

### Model Selection & Fallback

| File                         | Size   | Purpose                             |
| ---------------------------- | ------ | ----------------------------------- |
| `model-selection.ts`         | 11.7KB | Smart model routing based on config |
| `model-fallback.ts`          | 11.4KB | Fallback strategy when model fails  |
| `model-auth.ts`              | 11.5KB | Auth profile rotation on 429/5xx    |
| `model-scan.ts`              | 14.3KB | Scans available models              |
| `models-config.providers.ts` | 17.8KB | Provider configs                    |

**Fallback chain (configured in `~/.openclaw/openclaw.json`):**

```json
"agents": {
  "defaults": {
    "model": {
      "id": "ollama/kimi-k2.5:cloud",
      "fallbacks": ["ollama/gemini-3-flash-preview:cloud", "ollama/glm-5:cloud"]
    }
  }
}
```

**Current primary model:** `ollama/kimi-k2.5:cloud`
**Fallbacks:** `gemini-3-flash-preview:cloud` → `glm-5:cloud`

### System Prompt Builder

**File:** `src/agents/system-prompt.ts` (27.3KB)

Builds the full system prompt dynamically per run, incorporating:

- Agent identity (name, role, description)
- Current date/time
- Session context
- Memory search results
- Tool list
- Custom directives from config

### Tools System

| File                             | Purpose                         |
| -------------------------------- | ------------------------------- |
| `pi-tools.ts` (19KB)             | Main tool registry and dispatch |
| `pi-tools.policy.ts` (10KB)      | Execution approval policies     |
| `pi-tools.read.ts` (9.8KB)       | File read tool                  |
| `pi-tools.schema.ts` (5.9KB)     | Tool JSON schema definitions    |
| `bash-tools.exec.ts` (54.7KB)    | Shell execution engine          |
| `bash-tools.process.ts` (21.1KB) | Background process management   |

**Tool approval:** `src/infra/exec-approvals.ts` — some tools require user confirmation before execution.

### Multi-Agent System

| File                             | Size   | Purpose                       |
| -------------------------------- | ------ | ----------------------------- |
| `subagent-registry.ts`           | 17.6KB | Tracks all running subagents  |
| `subagent-announce.ts`           | 20KB   | Announces new agent sessions  |
| `subagent-mission.ts`            | 45.1KB | Cross-agent task coordination |
| `subagent-transcript-summary.ts` | 4.6KB  | Transcript summarization      |

**Communication:** Agents communicate via `sessions_send` (send to running session) or `sessions_spawn` (create new session). Each agent runs its own event loop.

### Task List System

| File                         | Purpose                       |
| ---------------------------- | ----------------------------- |
| `task-list.ts` (10.3KB)      | Create and track planned work |
| `task-list.store.ts` (2.2KB) | Persist task lists to disk    |

On startup: `[task-list] restored 64 task lists from disk`

### Context Window Management

| File                              | Purpose                             |
| --------------------------------- | ----------------------------------- |
| `compaction.ts` (10.4KB)          | Compress history when context fills |
| `context-window-guard.ts` (2.4KB) | Pre-flight overflow detection       |
| `pi-embedded-helpers/` (11 files) | Context helpers, image validation   |

### Auth Profiles & Rotation

Located in `src/agents/auth-profiles/` (17 files).

- Tracks API key usage, 429 rate limits, failures
- Rotates between multiple API keys automatically
- Cooldown periods after failures

---

## 5. Channels

### Built-in Channels

| Channel  | Files | Notes                      |
| -------- | ----- | -------------------------- |
| Telegram | 85    | Bot API polling or webhook |
| Discord  | 44    | discord.js, slash commands |
| Slack    | 36    | Bolt framework             |
| Signal   | 24    | Signal private messenger   |
| iMessage | 16    | BlueBubbles bridge         |
| LINE     | 36    | LINE Messaging API         |
| Feishu   | 19    | Feishu/Lark enterprise     |

### Plugin Channels (via extensions/)

msteams, matrix, mattermost, googlechat, tlon, twitch, nostr, zalo, zalouser, bluebubbles, nextcloud-talk, signal, whatsapp, and more.

### Channel Architecture Core Files

| File                                    | Purpose                          |
| --------------------------------------- | -------------------------------- |
| `src/channels/registry.ts` (5.6KB)      | Channel registry and dispatcher  |
| `src/channels/dock.ts` (15.2KB)         | Channel config and routing       |
| `src/channels/channel-config.ts` (5KB)  | Config schema validation         |
| `src/channels/allowlist-match.ts`       | User allowlist checking          |
| `src/channels/ack-reactions.ts` (6.5KB) | Message acknowledgment reactions |
| `src/channels/command-gating.ts`        | Command access control           |
| `src/channels/mention-gating.ts`        | @mention requirements            |
| `src/channels/typing.ts`                | Typing indicators                |

### Channel Message Flow

```
External platform → Channel adapter → src/routing/ → auto-reply/reply.ts
                                                              │
                                                    Agent execution
                                                              │
                                                    Response chunks
                                                              │
                                             Channel adapter → Platform
```

**Important:** Never send streaming/partial replies to external messaging surfaces (WhatsApp, Telegram). Only final replies are delivered externally. Streaming events go to internal UIs only.

---

## 6. Auto-Reply Pipeline

Located in `src/auto-reply/` (73 files).

### Reply Entry Point

`auto-reply/reply.ts` → `reply/` subdirectory (134 files)

### Pipeline Stages

1. **Command detection** (`command-detection.ts`) — parse inline directives like `!claude-3-5-sonnet`
2. **Gating** — allowlist check, mention requirement, command gating
3. **Model selection** — resolve which model/agent handles this message
4. **Thinking level** (`thinking.ts`) — `low | medium | high | xhigh`
5. **System prompt** — build with `system-prompt.ts`
6. **Execute** — agent runtime runs the LLM loop
7. **Chunk** (`chunk.ts`, 15.2KB) — split long responses for channel limits
8. **Envelope** (`envelope.ts`, 8.2KB) — wrap with metadata
9. **Deliver** — send back through channel adapter

### Heartbeat System

`heartbeat.ts` (5.1KB) — sends periodic health check messages.

Config controls visibility per channel:

```json
"heartbeat": {
  "webchat": { "showOk": false }  // suppress OK heartbeats from webchat
}
```

### Verbose/Thinking Levels

```typescript
// src/auto-reply/thinking.ts
type VerboseLevel = "off" | "minimal" | "compact" | "full";
type ThinkingLevel = "low" | "medium" | "high" | "xhigh";
```

Resolved from:

1. Run context (`runContext.verboseLevel`)
2. Session config (`entry.verboseLevel`)
3. Global default (`cfg.agents.defaults.verboseDefault`)
4. Falls back to `"off"` if none set

---

## 7. Luna Dashboard

**Location:** `luna-dashboard/`
**Framework:** Next.js 16.1.6 (Turbopack)
**Port:** 4000
**Auth:** Password from `.env.development.local` (`DASHBOARD_PASSWORD`)

### Starting the Dev Server

```bash
cd /Users/joechoa/openclaw/luna-dashboard
nohup npx next dev -p 4000 > /tmp/luna-dashboard.log 2>&1 &
```

### Pages

| Route                      | Purpose                        |
| -------------------------- | ------------------------------ |
| `/login`                   | Authentication                 |
| `/dashboard/overview`      | Main dashboard, gateway status |
| `/dashboard/channels`      | Channel management             |
| `/dashboard/agents`        | Agent list and status          |
| `/dashboard/sessions`      | Session browser                |
| `/dashboard/performance`   | Performance metrics            |
| `/dashboard/effectiveness` | Agent effectiveness scoring    |
| `/dashboard/health`        | System health monitoring       |
| `/dashboard/settings`      | Configuration UI               |
| `/dashboard/oms`           | Operations Management System   |
| `/dashboard/reports`       | Reporting                      |

### Key Hook — `hooks/useGateway.ts`

The primary React hook connecting the dashboard to the gateway WebSocket.

```typescript
interface UseGatewayReturn {
  connected: boolean;
  connectionState: "connecting" | "connected" | "disconnected" | "reconnecting";
  messages: ChatMessage[];
  isStreaming: boolean;
  isWaitingForReply: boolean;
  reconnectAttempts: number;
  thinkingSteps: ThinkingStep[]; // Tool call thinking notes
  currentAgentId: string | null;
  sendMessage(message: string, attachments: Attachment[]): Promise<void>;
  abortMessage(): void;
  loadHistory(): Promise<void>;
  ping(): Promise<{ latency: number }>;
}

interface ThinkingStep {
  id: string;
  type: "tool" | "lifecycle";
  label: string;
  status: "running" | "done" | "error";
  startedAt: number;
}
```

**Text sanitization (client-side):**

```typescript
// Also strips <final> tags and LOOP_DONE (mirrors server-side sanitization)
const stripAgentTags = (raw: string) =>
  raw
    .replace(/<\/?final>?/g, "") // handles partial tags like </final
    .replace(/(?:^|\n)\s*LOOP_DONE\s*$/gi, "")
    .trim();
```

### WebSocket Client — `lib/gatewayClient.ts`

```
WebSocket URL: ws://127.0.0.1:18789
Session ID:    agent:main:dashboard (default)
Auth:          ?token={gatewayToken} in URL
Heartbeat:     ping every 30s
Reconnect:     exponential backoff, max 20 attempts
```

**Events emitted:**

- `connected` — WS handshake complete
- `disconnected` — WS closed
- `reconnecting` — attempting reconnect
- `error` — connection/message error
- `message` — chat event (delta/final)
- `agent_event` — agent lifecycle/tool events

### Chat Storage — `lib/chatStorage.ts`

Messages persisted in `localStorage`, keyed by session ID. Merges new messages on reconnect to avoid duplicates.

### Key Library Files

| File                   | Purpose                                |
| ---------------------- | -------------------------------------- |
| `lib/gatewayClient.ts` | WebSocket client, reconnection, events |
| `lib/agents.ts`        | Agent management API calls             |
| `lib/channelData.ts`   | Channel state queries                  |
| `lib/brainClient.ts`   | Memory/Brain MCP integration           |
| `lib/omsClient.ts`     | OMS data queries                       |
| `lib/judgeClient.ts`   | Judge/scoring queries (PostgreSQL)     |
| `lib/ocrService.ts`    | OCR for image attachments              |
| `lib/chatStorage.ts`   | localStorage message persistence       |

### Database — `lib/judgeClient.ts`

Connects to PostgreSQL. Key queries:

```sql
-- getKnowledgeGrowth() — lesson growth over time
WITH daily AS (
  SELECT created_at::date AS day, COUNT(*)::int AS new_lessons
  FROM oms.lessons
  WHERE is_active = true AND source_agent != 'judge'
    AND created_at::date >= CURRENT_DATE - $1::int
  GROUP BY created_at::date
),
...
```

**Known issue fixed (2026-02-26):** Missing `WITH` keyword caused `syntax error at or near "daily"` (Digest: 2407806251). Fixed in `lib/judgeClient.ts:353`.

---

## 8. Configuration System

### Main Config File

**Location:** `~/.openclaw/openclaw.json`
**Format:** JSON5 (comments and trailing commas allowed)
**Loaded by:** `src/config/config.ts` → validated with Zod schema

### Key Config Sections

```json5
{
  // Agent configuration
  "agents": {
    "defaults": {
      "model": {
        "id": "ollama/kimi-k2.5:cloud",
        "fallbacks": ["ollama/gemini-3-flash-preview:cloud", "ollama/glm-5:cloud"]
      },
      "verboseDefault": "off"   // tool event verbosity: off | minimal | compact | full
    },
    "list": [...]               // per-agent overrides
  },

  // Channel configs
  "channels": {
    "telegram": { "accounts": { "default": { "botToken": "..." } } },
    "discord":  { "accounts": { "default": { "token": "..." } } }
  },

  // Gateway server
  "gateway": {
    "mode": "local",
    "bind": "loopback",
    "port": 18789,
    "auth": {
      "mode": "token",
      "token": "7f450a6e7918c20347d9923fec1ba8d26903f67e3bead37b"
    }
  },

  // Heartbeat visibility per channel
  "heartbeat": {
    "webchat": { "showOk": false }
  },

  // Memory/vector DB
  "memory": {
    "backend": "sqlite-vec"
  },

  // Plugin configuration
  "plugins": {
    "entries": {
      "voice-call": { "enabled": false }
    }
  }
}
```

### Config Validation Warnings

The following custom keys are not in the official Zod schema but are tolerated at runtime:

- `agents.list[*].brainWorkspaceId` — Brain MCP workspace ID per agent
- `agents.list[*].taskDirective` — Custom task directive
- `agents.list[*].maxRetries` — Override retry count
- `browser.chromeExtensionRelay` — Chrome extension relay config
- `memory.brainTiered` — Brain tiered memory config

### Config Hot Reload

`src/gateway/config-reload.ts` (11KB) — monitors config file for changes and reloads without gateway restart. Gateway logs `Config reloaded` on change.

### Gateway Token

The gateway auth token is stored at `gateway.auth.token` in the config. Get tokenized dashboard URL:

```bash
pnpm openclaw dashboard --no-open
# Output: Dashboard URL: http://127.0.0.1:18789/?token=<token>
```

---

## 9. Memory System

Located in `src/memory/`.

### Components

| File                      | Size   | Purpose                                  |
| ------------------------- | ------ | ---------------------------------------- |
| `manager.ts`              | 75.4KB | Main memory manager, batch ops, indexing |
| `brain-mcp-client.ts`     | —      | Brain MCP server client                  |
| `brain-tiered-manager.ts` | 17.6KB | Hot/cold storage tiers                   |
| `qmd-manager.ts`          | 25.1KB | Quantum metadata search                  |
| `search-manager.ts`       | 9.7KB  | Unified search interface                 |
| `embeddings.ts`           | 8KB    | Vector generation                        |
| `session-files.ts`        | 3.5KB  | Session persistence                      |

### Backend Options

- `sqlite-vec` — SQLite with vector extension (default local)
- Brain MCP server — external vector database via MCP protocol

### Memory Search in Agent Runs

`src/agents/memory-search.ts` (10KB) — called before each agent run to inject relevant memories into system prompt.

---

## 10. Plugin & Extension System

### Extension Directory Structure

```
extensions/
├── bluebubbles/           # iMessage via BlueBubbles desktop app
├── copilot-proxy/         # GitHub Copilot auth proxy
├── diagnostics-otel/      # OpenTelemetry diagnostics
├── discord/               # Discord as plugin
├── feishu/                # Feishu/Lark
├── google-antigravity-auth/
├── google-gemini-cli-auth/
├── googlechat/
├── imessage/
├── line/
├── llm-task/              # LLM task delegation
├── lobster/               # Lobster UI integration
├── matrix/                # Matrix/Element
├── mattermost/
├── memory-core/           # Core memory plugin
├── memory-lancedb/        # LanceDB vector storage
├── minimax-portal-auth/   # Minimax API
├── msteams/               # Microsoft Teams
├── nextcloud-talk/
├── nostr/
├── open-prose/
├── qwen-portal-auth/      # Qwen API
├── signal/
├── slack/
├── telegram/
├── tlon/                  # Urbit/Tlon
├── twitch/
├── voice-call/            # Voice call (disabled)
├── whatsapp/
├── zalo/
└── zalouser/
```

### Plugin Architecture

**SDK:** `src/plugin-sdk/` — type definitions and API surface for plugins

**Loading:** `src/plugins/runtime/` — discovers and loads plugin packages at startup

**Important notes:**

- Plugin runtime deps must be in `dependencies`, not `devDependencies`
- Do not use `workspace:*` in plugin `dependencies` (breaks npm install)
- Plugin dir install: `npm install --omit=dev`

---

## 11. Infrastructure Layer

Located in `src/infra/` (152 files).

### Key Systems

**Agent Events** — `agent-events.ts`

```typescript
// Get context for a running agent
getAgentRunContext(runId: string): AgentRunContext | undefined
// Context contains: isHeartbeat, verboseLevel, sessionKey, etc.
```

**Device Pairing** — `device-pairing.ts` (15.6KB)
Mobile device pairing with tokenized auth.

**Control UI Assets** — `control-ui-assets.ts` (6.4KB)
Manages the built Control UI (served from `~/.openclaw/control-ui/`).

**Discovery** — `bonjour-discovery.ts` (16.8KB)
Publishes gateway on local network via mDNS so mobile apps can auto-discover.

**Skills** — `skills-remote.ts`
Remote skill registry and caching.

**Backoff** — `backoff.ts`
Exponential backoff used by reconnection logic.

---

## 12. End-to-End Message Flow

### Webchat (Luna Dashboard) → Gateway → Agent → Response

```
1. User types message in luna-dashboard/components/Chat/
2. useGateway.ts hook → sendMessage(text, attachments)
3. GatewayClient sends WS message: { type: "chat.send", session, message }

4. Gateway (server-chat.ts) receives:
   - Creates ChatRunEntry in registry
   - Assigns clientRunId and sessionKey

5. Agent runtime (pi-embedded-runner.ts):
   - Builds system prompt (system-prompt.ts)
   - Memory search injects context (memory-search.ts)
   - Selects model (model-selection.ts) → kimi-k2.5:cloud
   - If kimi fails → fallback to gemini-3-flash-preview:cloud

6. LLM streams response tokens back to runner

7. Runner publishes events via pi-embedded-subscribe.ts:
   - stream="assistant", data.text="Hello, ..." → chat delta
   - stream="tool", data.phase="start/end" → thinking notes
   - stream="lifecycle", data.phase="end" → chat final

8. server-chat.ts createAgentEventHandler():
   - assistant event → emitChatDelta()
     → sanitizeAssistantText() strips <final> tags
     → mergeAssistantTextBuffer() accumulates text
     → broadcast("chat", { state: "delta", message })
   - tool event (verbose=off) → broadcast minimal summary (name+phase only)
   - lifecycle "end" → emitChatFinal()
     → broadcast("chat", { state: "final", message })

9. Dashboard useGateway.ts receives:
   - "delta" → update streaming message in state
   - "final" → replace with final message, clear streaming
   - "agent" tool events → update thinkingSteps[]

10. React components re-render:
    - ChatBubble shows streaming text
    - ThinkingNotes shows tool execution steps
```

### Telegram Message Flow

```
Telegram user → Bot API (polling) → src/telegram/monitor.ts
→ src/channels/registry.ts → src/routing/
→ src/auto-reply/reply.ts → Agent runtime
→ Response chunks → src/telegram/ → Bot.sendMessage()
```

**Note:** External channels (Telegram, Discord, etc.) only receive **final** responses, never streaming deltas.

---

## 13. Key Files Reference

### Gateway

| File                                | Lines | Purpose                           |
| ----------------------------------- | ----- | --------------------------------- |
| `src/gateway/server.impl.ts`        | ~600  | Gateway server initialization     |
| `src/gateway/server-chat.ts`        | 444   | Chat run registry + event handler |
| `src/gateway/chat-response-text.ts` | 51    | Text sanitization + buffer merge  |
| `src/gateway/session-utils.ts`      | ~700  | Session file I/O                  |
| `src/gateway/config-reload.ts`      | ~400  | Hot config reload                 |

### Agents

| File                               | Lines   | Purpose                  |
| ---------------------------------- | ------- | ------------------------ |
| `src/agents/system-prompt.ts`      | ~900    | System prompt builder    |
| `src/agents/pi-embedded-runner.ts` | Complex | Core agent execution     |
| `src/agents/model-selection.ts`    | ~400    | Model routing            |
| `src/agents/model-fallback.ts`     | ~400    | Fallback on errors       |
| `src/agents/subagent-mission.ts`   | ~1500   | Multi-agent coordination |
| `src/agents/bash-tools.exec.ts`    | ~1800   | Shell execution          |

### Dashboard

| File                                  | Lines | Purpose                  |
| ------------------------------------- | ----- | ------------------------ |
| `luna-dashboard/hooks/useGateway.ts`  | ~500  | Gateway React hook       |
| `luna-dashboard/lib/gatewayClient.ts` | ~600  | WebSocket client         |
| `luna-dashboard/lib/judgeClient.ts`   | ~400  | PostgreSQL queries       |
| `luna-dashboard/lib/chatStorage.ts`   | ~200  | localStorage persistence |

### Config

| File                        | Purpose                  |
| --------------------------- | ------------------------ |
| `src/config/config.ts`      | Config loading entry     |
| `src/config/zod-schema.ts`  | Validation schema        |
| `src/infra/agent-events.ts` | Agent run context events |

---

## 14. Recent Changes

### 2026-02-26

**1. Partial `<final>` tag stripping fix**

Problem: During streaming, models like kimi-k2.5 wrap responses in `<final>...</final>`. Partial streaming chunks like `</final` (missing closing `>`) were visible in chat.

Fix applied in two places:

- `src/gateway/chat-response-text.ts` line 8: `/<\/?final>/g` → `/<\/?final>?/g`
- `luna-dashboard/hooks/useGateway.ts` `stripAgentTags`: same regex fix

**2. Tool events broadcast for thinking notes**

Problem: `verboseDefault` not configured → defaults to `"off"` → all tool events dropped → thinking notes panel always empty in webchat.

Fix in `src/gateway/server-chat.ts` lines 342–365:

- Even when verbose is `"off"`, broadcast a minimal summary payload containing `{ phase, name, toolCallId }` for `start/end/error` phases
- Full tool results still suppressed for performance

**3. Model fallbacks added**

Problem: `agents.defaults.model.fallbacks` was `[]` → when kimi-k2.5:cloud returned empty responses, webchat had no fallback.

Fix in `~/.openclaw/openclaw.json`:

```json
"fallbacks": ["ollama/gemini-3-flash-preview:cloud", "ollama/glm-5:cloud"]
```

**4. Dashboard SQL fix**

Problem: `getKnowledgeGrowth()` in `luna-dashboard/lib/judgeClient.ts` line 354 missing `WITH` keyword → `syntax error at or near "daily"` crash on `/dashboard/overview`.

Fix: Added `WITH` before the first CTE.

**5. Luna Dashboard process management**

Dashboard dev server must be manually started (not supervised):

```bash
nohup npx next dev -p 4000 > /tmp/luna-dashboard.log 2>&1 &
```

**6. Gateway LaunchAgent reinstalled**

Gateway was running via ad-hoc `nohup` process. Reinstalled as proper launchd service:

```bash
pnpm openclaw gateway stop
pnpm openclaw gateway install
pnpm openclaw gateway start
```

Gateway now runs as LaunchAgent `ai.openclaw.gateway`, logs to `~/.openclaw/logs/gateway.log`.

---

## Quick Reference

### Start Everything

```bash
# Gateway (supervised, auto-starts on login)
pnpm openclaw gateway start

# Luna Dashboard (manual)
cd /Users/joechoa/openclaw/luna-dashboard
nohup npx next dev -p 4000 > /tmp/luna-dashboard.log 2>&1 &

# Get dashboard URL with auth token
pnpm openclaw gateway health
pnpm openclaw dashboard --no-open
```

### Check Status

```bash
pnpm openclaw channels status --probe
pnpm openclaw gateway health
lsof -nP -iTCP:18789 -sTCP:LISTEN
tail -f /Users/joechoa/.openclaw/logs/gateway.log
```

### Restart Gateway

```bash
pnpm openclaw gateway stop
sleep 2
pnpm openclaw gateway start
```

### Build & Test

```bash
pnpm build          # type-check + compile
pnpm check          # lint + format
pnpm test           # vitest
pnpm test:coverage  # vitest with coverage
```

### Gateway Auth Token

**Current token:** `7f450a6e7918c20347d9923fec1ba8d26903f67e3bead37b`
**Location in config:** `gateway.auth.token` in `~/.openclaw/openclaw.json`
**Dashboard URL:** `http://127.0.0.1:18789/?token=7f450a6e7918c20347d9923fec1ba8d26903f67e3bead37b`

---

_This document is maintained in `/Users/joechoa/openclaw/claudedocs/LUNA-SYSTEM-TECHNICAL.md`_
