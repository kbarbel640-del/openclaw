# Clawdbot Initial Exploration

This document summarizes the technical exploration of the Clawdbot codebase conducted on January 26, 2026. The goal is to help team members quickly understand the repository architecture and key design decisions.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Entry Points & CLI](#2-entry-points--cli)
3. [Agent Loop Architecture](#3-agent-loop-architecture)
4. [System Prompt Structure](#4-system-prompt-structure)
5. [Messages Array & LLM API Calls](#5-messages-array--llm-api-calls)
6. [Context Management](#6-context-management)
7. [Memory & Persistence](#7-memory--persistence)
8. [Channel Integrations](#8-channel-integrations)
   - [8.1 WhatsApp (Native Channel)](#81-whatsapp-native-channel---deep-dive)
   - [8.2 Channel Architecture](#82-channel-architecture-general)
9. [Gmail & Google Workspace](#9-gmail--google-workspace-external-tool-pattern)
   - [9.1 How Gmail/Calendar Access Works](#91-how-gmailcalendar-access-works)
   - [9.2 gog Skill](#92-gog-skill-google-workspace-cli)
   - [9.3 Gmail Hooks](#93-gmail-hooks-optional-push-notifications)
   - [9.4 WhatsApp vs Gmail Comparison](#94-comparison-whatsapp-vs-gmail)
10. [Configuration](#10-configuration)
11. [External Dependencies](#11-external-dependencies)
12. [Porting Considerations](#12-porting-considerations)

---

## 1. Project Overview

**Clawdbot** is a multi-channel AI agent gateway that connects LLM-powered agents to messaging platforms (WhatsApp, Telegram, Discord, Slack, Signal, etc.).

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| CLI | `src/cli/`, `src/commands/` | Command-line interface |
| Agent Runner | `src/agents/` | Agent loop, tools, session management |
| Gateway | `src/gateway/` | HTTP server, channel management |
| Channels | `src/telegram/`, `src/discord/`, `extensions/*` | Messaging platform integrations |
| Config | `src/config/` | Configuration schema and loading |

### Tech Stack

- **Language**: TypeScript (ESM)
- **Runtime**: Node.js 22+
- **Package Manager**: pnpm (Bun also supported)
- **Agent Libraries**: `@mariozechner/pi-agent-core`, `pi-coding-agent`, `pi-ai`
- **CLI Framework**: Commander.js

---

## 2. Entry Points & CLI

### Main Entry Point

```
src/entry.ts → src/cli/run-main.ts → src/cli/program.ts
```

The CLI binary is defined in `package.json`:
```json
{
  "bin": {
    "clawdbot": "dist/entry.js"
  }
}
```

### Entry Flow

1. `src/entry.ts` - Sets process title, handles respawning for experimental warnings
2. `src/cli/run-main.ts` - Loads dotenv, normalizes env, builds the CLI program
3. `src/cli/program/build-program.ts` - Constructs Commander.js program with subcommands

### Key Commands

```bash
clawdbot gateway run      # Start the gateway server
clawdbot agent            # Run agent directly
clawdbot config get       # View configuration
clawdbot status           # Show status
```

---

## 3. Agent Loop Architecture

### Is it a ReAct Agent?

**Conceptually yes, mechanically no.** Clawdbot follows the same observe-reason-act loop as ReAct, but uses **native API primitives** rather than text parsing.

| Aspect | ReAct (2022 Paper) | Clawdbot (Modern Implementation) |
|--------|-------------------|----------------------------------|
| Format | Text parsing: `Thought:`, `Action:`, `Observation:` | Structured JSON tool calls from API |
| Reasoning | Explicit `Thought:` blocks in output | Extended thinking tokens (Anthropic) or `<think>` tags |
| Tool Calls | Parsed from `Action:` text | Native API `tool_use` / `function_call` response |
| Reliability | Fragile text parsing | Native API support, more reliable |

**Key insight:** ReAct (Yao et al. 2022) pioneered the reason-act-observe loop before LLM APIs had native tool calling. Modern agents like Clawdbot implement the same pattern using formalized API features:
- **Native tool calling** replaces text-parsed `Action:` blocks
- **Extended thinking tokens** (`thinkLevel`: off/minimal/low/medium/high) replace `Thought:` blocks
- The fundamental loop remains identical

### The Agent Loop

```
User Message
    │
    ▼
session.prompt(userMessage)
    │
    ▼
┌─────────────────────────────────┐
│        LLM API Call             │
│   (streaming via pi-ai)         │
└─────────────┬───────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
Text Only          Tool Calls
(Done!)                 │
                        ▼
              Execute Tools (bash, read, edit, etc.)
                        │
                        ▼
              Feed Results to LLM
                        │
                        ▼
              Loop until no tool calls
```

### Key Files

| File | Purpose |
|------|---------|
| `src/agents/pi-embedded-runner/run.ts` | Main entry for agent runs |
| `src/agents/pi-embedded-runner/run/attempt.ts` | Single attempt execution |
| `src/agents/pi-embedded-subscribe.ts` | Event subscription for streaming |

### Code Flow

```typescript
// src/agents/pi-embedded-runner/run/attempt.ts (line 778-780)
await activeSession.prompt(effectivePrompt, { images });
```

The `session.prompt()` call is delegated to `@mariozechner/pi-coding-agent`, which uses `pi-ai`'s `streamSimple` for actual LLM API calls.

---

## 4. System Prompt Structure

The system prompt is **Clawdbot-owned** and rebuilt for each agent run.

### Structure

```
You are a personal assistant running inside Clawdbot.

## Tooling
- read: Read file contents
- write: Create or overwrite files
- edit: Make precise edits to files
- exec: Run shell commands
...

## Skills (if available)
<available_skills>
  <skill>
    <name>gog</name>
    <description>Google Workspace CLI</description>
    <location>~/.clawdbot/skills/gog/SKILL.md</location>
  </skill>
</available_skills>

## Workspace
Your working directory is: /path/to/workspace

## Current Date & Time
Time zone: America/New_York

# Project Context

## AGENTS.md
[contents of your AGENTS.md file]

## SOUL.md
[contents - persona/tone]

## Runtime
Runtime: host=MacBook | os=Darwin | model=anthropic/claude-sonnet | thinking=off
```

### Injected Bootstrap Files

These files are auto-loaded from the workspace:

- `AGENTS.md` / `CLAUDE.md` - Project instructions
- `SOUL.md` - Persona/tone
- `TOOLS.md` - Custom tool guidance
- `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`

Large files are truncated at `agents.defaults.bootstrapMaxChars` (default: 20,000 chars).

### Key File

`src/agents/system-prompt.ts` - Builds the system prompt with all sections.

---

## 5. Messages Array & LLM API Calls

### Separation of Concerns

The system prompt and messages array are **passed separately** to the LLM API:

```typescript
{
  // System prompt - SEPARATE field
  system: "You are a personal assistant...",
  
  // Messages array - SEPARATE field  
  messages: [
    { role: "user", content: "Fix the bug" },
    { role: "assistant", tool_calls: [...] },
    { role: "tool", content: "file contents" },
    { role: "assistant", content: "Done!" }
  ],
  
  // Tools - SEPARATE field
  tools: [
    { name: "read", parameters: {...} },
    { name: "edit", parameters: {...} }
  ]
}
```

### Provider-Specific Formats

| Provider | System Prompt Field | Messages Field |
|----------|---------------------|----------------|
| Anthropic | `system` | `messages` |
| OpenAI | First message with `role: "system"` | `messages` |
| Google | `systemInstruction` | `contents` |

### Call Chain

```
Clawdbot
    │
    ▼
session.prompt()  (@mariozechner/pi-coding-agent)
    │
    ▼
agent.run()  (@mariozechner/pi-agent-core)
    │
    ▼
streamSimple()  (@mariozechner/pi-ai)
    │
    ▼
HTTP Request to LLM Provider API
```

---

## 6. Context Management

When the messages array grows too large, Clawdbot has multiple mechanisms to manage context.

### 6.1 Manual Compaction (`/compact`)

User-triggered summarization:

```bash
/compact                    # Summarize old messages
/compact keep recent work   # Custom instructions
```

**How it works:**
1. Takes older conversation history
2. Asks LLM to summarize into a compact entry
3. Keeps recent messages intact
4. Persists summary to session transcript

**File:** `src/agents/pi-embedded-runner/compact.ts`

### 6.2 Auto-Compaction on Context Overflow

When context window fills mid-run:

```typescript
if (isContextOverflowError(errorText)) {
  const compactResult = await compactEmbeddedPiSessionDirect({...});
  if (compactResult.compacted) {
    continue;  // Retry with compacted history
  }
}
```

### 6.3 History Turn Limiting (DM Sessions)

Limits history to last N user turns:

```typescript
// src/agents/pi-embedded-runner/history.ts
function limitHistoryTurns(messages, limit) {
  // Keeps last N user turns + associated assistant responses
}
```

Configuration:
```yaml
channels:
  telegram:
    dmHistoryLimit: 20
    dms:
      "123456789":
        historyLimit: 50  # Per-user override
```

### 6.4 Context Pruning (In-Memory Only)

Removes old tool results **without** rewriting the transcript:

```typescript
// src/agents/pi-extensions/context-pruning.ts
// Only affects in-memory context for current request
```

### User Commands

| Command | Purpose |
|---------|---------|
| `/status` | Shows context usage |
| `/context list` | Detailed breakdown |
| `/compact` | Manual compaction |

---

## 7. Memory & Persistence

Clawdbot has **three distinct memory mechanisms** for different persistence needs.

### 7.1 Session Transcripts (Conversation History)

**Storage:** JSONL files at `~/.clawdbot/agents/<agentId>/sessions/<SessionId>.jsonl`

Each message (user, assistant, tool calls, tool results) is appended as a JSON line:

```jsonl
{"type":"session","id":"abc123","cwd":"/path/to/workspace"}
{"type":"message","message":{"role":"user","content":"Fix the bug"}}
{"type":"message","message":{"role":"assistant","content":[...],"tool_calls":[...]}}
{"type":"message","message":{"role":"toolResult","id":"call_xyz","content":"..."}}
```

On each agent run:
1. Session file is loaded into memory
2. Messages are sanitized, validated, and limited (via `dmHistoryLimit`)
3. Full history is passed to the LLM in the `messages` array

**Key files:**
- `src/agents/pi-embedded-runner/session-manager-init.ts` - Session initialization
- `src/agents/session-tool-result-guard.ts` - Persistence guards

### 7.2 Bootstrap Files (Injected System Context)

**Location:** Workspace directory (e.g., `~/clawd/`)

| File | Purpose | Injected Into |
|------|---------|---------------|
| `AGENTS.md` | Operating instructions + "memory" | System prompt |
| `SOUL.md` | Persona, boundaries, tone | System prompt |
| `TOOLS.md` | User-maintained tool notes | System prompt |
| `IDENTITY.md` | Agent name/vibe/emoji | System prompt |
| `USER.md` | User profile + preferred address | System prompt |

These are **injected into the system prompt** on each turn. The agent can read/write these files with tools, so they serve as **persistent, mutable long-term memory** that survives across sessions.

**Key insight:** The workspace *is* the artifact store. There's no separate database—the agent uses filesystem tools to persist anything it needs.

### 7.3 Vector Memory Search (Optional)

**Storage:** SQLite + vector embeddings at `~/.clawdbot/memory/<agentId>.sqlite`

**Sources indexed:**
- `MEMORY.md` (workspace root)
- `memory/*.md` (workspace subdirectory)
- Optionally: session transcripts

**How it works:**

```
Agent needs past context
    │
    ▼
Calls memory_search("project X deadline")
    │
    ▼
Vector + BM25 hybrid search in SQLite
    │
    ▼
Returns top snippets with path + line numbers
    │
    ▼
Calls memory_get(path, from, lines) for full context
```

**Configuration:**
```json5
{
  agents: {
    defaults: {
      memorySearch: {
        enabled: true,
        sources: ["memory", "sessions"],  // Include session transcripts
        provider: "openai",               // or "gemini", "local", "auto"
        model: "text-embedding-3-small",
        store: {
          driver: "sqlite",
          vector: { enabled: true }
        },
        query: {
          maxResults: 10,
          minScore: 0.3,
          hybrid: { enabled: true }
        }
      }
    }
  }
}
```

**Key files:**
- `src/memory/manager.ts` - Main memory manager (~2000 LOC)
- `src/memory/sync-memory-files.ts` - File indexing
- `src/memory/sync-session-files.ts` - Session transcript indexing
- `src/agents/tools/memory-tool.ts` - `memory_search` and `memory_get` tools

### Memory Architecture Summary

| Type | Storage | Query Method | Persistence |
|------|---------|--------------|-------------|
| Session history | JSONL files | Loaded directly into messages array | Per-session |
| Bootstrap files | Markdown files | Injected into system prompt | Cross-session |
| Vector memory | SQLite + embeddings | `memory_search` tool | Cross-session |
| Workspace files | Any file format | `read`/`write`/`edit` tools | Permanent |

---

## 8. Channel Integrations

Channels are loaded as **plugins** from `extensions/`. There are two fundamentally different integration patterns:

1. **Native Channels** (WhatsApp, Telegram, etc.) - Bidirectional, gateway-owned
2. **External Tools via Skills** (Gmail, Calendar) - Agent invokes CLI tools

### 8.1 WhatsApp (Native Channel - Deep Dive)

WhatsApp uses **Baileys** (unofficial WhatsApp Web API). The gateway acts as a **linked device** on your WhatsApp account.

**Architecture:**
```
Your Phone (WhatsApp)
    │
    ▼ (Linked Device)
Baileys Socket (src/web/session.ts)
    │
    ▼
Access Control Filter (src/web/inbound/access-control.ts)
    │
    ├── DMs: dmPolicy (pairing/allowlist/open)
    │   └── allowFrom: ["+15551234567"]
    │
    └── Groups: groupPolicy (open/allowlist/disabled)
        └── requireMention (default: true)
    │
    ▼
Agent (processes filtered messages only)
```

**Capabilities:**

| Action | How | Control |
|--------|-----|---------|
| Receive DMs | Gateway socket | `dmPolicy` + `allowFrom` |
| Receive groups | Gateway socket | `groupPolicy` + `groups` allowlist |
| Send messages | `message` tool | `actions.sendMessage` |
| Send media | `message` tool | Images, audio, video, docs |
| React to messages | `whatsapp react` action | `actions.reactions` |
| Send polls | Channel plugin | `actions.polls` |

**Security model:**
- Gateway *receives* all messages (it's a linked device)
- Agent only *processes* messages passing access control
- `allowFrom` controls who can trigger the agent
- Agent *can* send to any contact/group via `message` tool

**Key files:**
- `extensions/whatsapp/src/channel.ts` - Channel plugin
- `src/web/session.ts` - Baileys socket creation
- `src/web/inbound/access-control.ts` - DM/group filtering
- `src/agents/tools/message-tool.ts` - Agent send capability

### 8.2 Channel Architecture (General)

```
Gateway Server (src/gateway/)
    │
    ▼
Channel Manager (src/gateway/server-channels.ts)
    │
    ├── WhatsApp (extensions/whatsapp/)
    ├── Telegram (extensions/telegram/)
    ├── Discord (src/discord/)
    ├── Slack (src/slack/)
    ├── Signal (src/signal/)
    └── ... more channels
```

### Plugin Structure

```typescript
// extensions/telegram/index.ts
const plugin = {
  id: "telegram",
  name: "Telegram",
  register(api: ClawdbotPluginApi) {
    api.registerChannel({ plugin: telegramPlugin });
  },
};
```

### Channel Manager Responsibilities

1. **Starts** each channel plugin when gateway boots
2. **Routes** incoming messages to the agent
3. **Sends** agent responses back through the channel

---

## 9. Gmail & Google Workspace (External Tool Pattern)

**Important:** Gmail/Calendar are NOT native channels. The agent uses an **external CLI tool** (`gog`) via the `exec` tool.

### 9.1 How Gmail/Calendar Access Works

```
Agent needs to read email or calendar
    │
    ▼
Agent calls exec tool
    │
    ▼
exec("gog gmail search 'newer_than:1d'")
    │
    ▼
gog CLI (external binary)
    │
    ▼ (OAuth tokens stored by gog in ~/.gog/)
Gmail/Calendar API
    │
    ▼
Results returned to agent
```

**Key insight:** The agent must *actively query* Gmail/Calendar. There's no automatic push of messages.

### 9.2 gog Skill (Google Workspace CLI)

`gog` is an external CLI by Peter Steinberger for Google Workspace:

```bash
# Install
brew install steipete/tap/gogcli

# Setup (one-time)
gog auth credentials /path/to/client_secret.json
gog auth add you@gmail.com --services gmail,calendar,drive,contacts,docs,sheets
```

**Gmail commands:**
```bash
gog gmail search 'newer_than:7d' --max 10
gog gmail send --to a@b.com --subject "Hi" --body "Hello"
gog gmail drafts create --to a@b.com --subject "Hi" --body-file ./msg.txt
gog gmail send --reply-to-message-id <msgId> --to a@b.com --subject "Re: Hi" --body "Reply"
```

**Calendar commands:**
```bash
gog calendar events <calendarId> --from 2026-01-01 --to 2026-01-31
gog calendar create <calendarId> --summary "Meeting" --from <iso> --to <iso>
gog calendar update <calendarId> <eventId> --summary "New Title"
```

**Other services:** Drive, Contacts, Sheets, Docs also supported.

**Key files:**
- `skills/gog/SKILL.md` - Skill documentation (injected into system prompt)
- Credentials: `~/.gog/` (managed by gog, NOT by Clawdbot)

### 9.3 Gmail Hooks (Optional Push Notifications)

For automatic email notifications, Clawdbot supports **Gmail Pub/Sub webhooks**:

```
Gmail API
    │
    ▼
Google Cloud Pub/Sub
    │
    ▼
gog gmail watch serve
    │
    ▼
HTTP POST to /hooks/gmail
    │
    ▼
Clawdbot Hook Handler
    │
    ▼
Agent (one-way trigger, no auto-reply)
```

**Configuration:**
```json5
{
  hooks: {
    enabled: true,
    token: "CLAWDBOT_HOOK_TOKEN",
    presets: ["gmail"],
    gmail: {
      account: "you@gmail.com",
      topic: "projects/your-project/topics/gmail-watch"
    }
  }
}
```

**Key files:**
- `src/hooks/gmail-watcher.ts` - Gmail watch service
- `src/gateway/hooks-mapping.ts` - Hook routing

### 9.4 Comparison: WhatsApp vs Gmail

| Aspect | WhatsApp (Native Channel) | Gmail (External Tool) |
|--------|--------------------------|----------------------|
| Integration type | Native SDK (Baileys) | CLI tool (gog) |
| Connection | Persistent socket | On-demand API calls |
| Receives messages | Automatic (gateway) | Manual query or webhook |
| Sends messages | `message` tool | `exec("gog gmail send ...")` |
| Bidirectional chat | ✅ Yes | ❌ No |
| Credential storage | `~/.clawdbot/credentials/` | `~/.gog/` (gog-managed) |
| Access control | `allowFrom`, `groupPolicy` | OAuth scopes |
| Auto-reply | ✅ Yes | ❌ No |
| Can read all messages | ✅ Yes (filtered by policy) | ✅ Yes (via gog queries) |
| Can send as you | ✅ Yes (`message` tool) | ✅ Yes (`gog gmail send`) |

**Bottom line:**
- **WhatsApp** = Native integration, bidirectional chat, gateway manages connection
- **Gmail** = External tool, agent queries on-demand, no automatic chat loop

---

## 10. Configuration

### Location

```
~/.clawdbot/clawdbot.json
```

JSON5 format (comments and trailing commas allowed).

### Example Configuration

```json5
{
  agents: {
    defaults: {
      workspace: "~/clawd",
      bootstrapMaxChars: 20000,
      userTimezone: "America/New_York",
      contextPruning: { mode: "off" }
    }
  },
  
  channels: {
    telegram: {
      token: "BOT_TOKEN",
      allowFrom: ["+15555550123"],
      dmHistoryLimit: 20
    }
  },
  
  hooks: {
    enabled: true,
    gmail: {
      account: "you@gmail.com",
      topic: "projects/your-project/topics/gmail-watch"
    }
  }
}
```

### CLI Commands

```bash
clawdbot config get                           # View config
clawdbot config set agents.defaults.workspace ~/projects  # Set value
clawdbot doctor --fix                         # Diagnose/repair
```

### Validation

Clawdbot **strictly validates** config on startup. Invalid configs prevent the gateway from starting.

---

## 11. External Dependencies

### Pi-Agent Libraries (Mario Zechner)

| Package | Purpose |
|---------|---------|
| `@mariozechner/pi-ai` | Unified LLM API, streaming, multi-provider |
| `@mariozechner/pi-agent-core` | Agent loop, tool execution |
| `@mariozechner/pi-coding-agent` | Session management, compaction |
| `@mariozechner/pi-tui` | Terminal UI |

**Note:** These are **TypeScript/Node.js only** - no Python version exists.

### Pi-Agent Philosophy

From Mario Zechner's blog:

> "If I don't need it, it won't be built."

Key design choices:
- **Minimal system prompt** (~1000 tokens)
- **4 core tools**: read, write, edit, bash
- **No MCP support** - "use CLI tools with READMEs instead"
- **No sub-agents** - "spawn yourself via bash"
- **No plan mode** - "write to a PLAN.md file"
- **YOLO by default** - no permission prompts

---

## 12. Porting Considerations

### Porting to Python/LangGraph

**Core agent loop difficulty: Easy**

The loop is simple and could be implemented in ~40 lines with LangGraph:

```python
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

graph = StateGraph(AgentState)
graph.add_node("agent", call_model)
graph.add_node("tools", ToolNode(tools))
graph.add_conditional_edges("agent", should_continue)
graph.add_edge("tools", "agent")
agent = graph.compile()
```

### Difficulty Breakdown

| Component | Difficulty | Notes |
|-----------|------------|-------|
| Basic loop | Easy | LangGraph has this built-in |
| Streaming | Easy | LangGraph supports streaming |
| Session persistence | Medium | Custom branching model |
| Multi-provider failover | Medium | Auth rotation, rate limits |
| Context compaction | Medium | Summarization logic |
| WhatsApp integration | Hard | Baileys is Node.js only |
| Channel integrations | Hard | Multiple platforms |
| Multi-account support | Hard | Per-channel complexity |

### Python Alternatives to Pi-Agent

| Framework | Notes |
|-----------|-------|
| LangGraph | Graph-based, more abstraction |
| PydanticAI | Lightweight, type-safe |
| Anthropic SDK | Direct API with tool support |
| Roll your own | ~200 lines for basics |

### Key Insight

> The value in Clawdbot is the **integrations and production infrastructure**, not the agent loop itself. The loop is trivial; everything around it is complex.

---

## Summary

Clawdbot is a well-architected multi-channel AI gateway with:

1. **Clean separation**: CLI → Gateway → Channels → Agent
2. **Plugin system**: Channels loaded as extensions
3. **Delegated LLM calls**: Via pi-ai library
4. **Flexible context management**: Compaction, pruning, history limits
5. **Webhook hooks**: For non-chat integrations (Gmail)
6. **User-controlled config**: JSON5 at `~/.clawdbot/clawdbot.json`

The core agent loop is simple (tool-calling loop), but the production value comes from the channel integrations, session management, and operational features.

---

*Document created: January 26, 2026*
*Based on exploration of clawdbot repository*
