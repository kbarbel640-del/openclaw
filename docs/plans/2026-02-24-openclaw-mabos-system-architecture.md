# OpenClaw-MABOS Platform — System Architecture Document

| Field              | Value                                             |
| ------------------ | ------------------------------------------------- |
| **Document**       | System Architecture — Complete Platform Reference |
| **Version**        | 2026.2.22                                         |
| **Date**           | 2026-02-24                                        |
| **Status**         | Living Document                                   |
| **License**        | MIT                                               |
| **Authors**        | OpenClaw Core Team                                |
| **Classification** | Internal / Technical                              |

---

## Table of Contents

1.  [Executive Summary](#1-executive-summary)
2.  [Design Philosophy and Principles](#2-design-philosophy-and-principles)
3.  [High-Level Architecture](#3-high-level-architecture)
4.  [Repository Layout and Project Structure](#4-repository-layout-and-project-structure)
5.  [Core Platform — `src/`](#5-core-platform--src)
6.  [Gateway Architecture](#6-gateway-architecture)
7.  [Channel Integration Architecture](#7-channel-integration-architecture)
8.  [Plugin System](#8-plugin-system)
9.  [Memory Subsystem](#9-memory-subsystem)
10. [LLM Provider Layer](#10-llm-provider-layer)
11. [Agent Management](#11-agent-management)
12. [MABOS Extension — Multi-Agent Business Operating System](#12-mabos-extension--multi-agent-business-operating-system)
13. [BDI Runtime Service](#13-bdi-runtime-service)
14. [Session and Conversation Management](#14-session-and-conversation-management)
15. [Security Architecture](#15-security-architecture)
16. [Native Companion Applications](#16-native-companion-applications)
17. [Data Flow Diagrams](#17-data-flow-diagrams)
18. [Technology Stack](#18-technology-stack)
19. [Build, Test, and Development Workflow](#19-build-test-and-development-workflow)
20. [Deployment Architecture](#20-deployment-architecture)
21. [Subsystem Deep-Dive References](#21-subsystem-deep-dive-references)
22. [Appendix A — Configuration Reference](#appendix-a--configuration-reference)
23. [Appendix B — Glossary](#appendix-b--glossary)

---

## 1. Executive Summary

**OpenClaw** is a self-hosted, terminal-first AI assistant platform written in TypeScript. It is designed to run across devices and over 40 messaging channels, with a plugin architecture that allows third-party extensions to be discovered, installed, and managed via npm. The platform exposes two primary binaries — `openclaw` (the core gateway and runtime) and `mabos` (the cognitive multi-agent extension entrypoint).

**MABOS** (Multi-Agent Business Operating System) is the flagship bundled extension. It provides a full BDI (Belief-Desire-Intention) cognitive architecture with SBVR (Semantics of Business Vocabulary and Business Rules) ontological grounding. MABOS turns the OpenClaw runtime into a goal-oriented multi-agent system capable of autonomous planning, reasoning, and coordinated task execution.

The platform is built around several core convictions:

- **Terminal-first**: the CLI is the primary interface, not an afterthought.
- **TypeScript for hackability**: a single language across the entire stack makes the system approachable for contributors and extension authors.
- **Self-hosted**: users retain full control of their data, models, and infrastructure.
- **Plugin-everything**: every messaging channel, memory backend, and cognitive module is an extension, making the platform composable.

A reference deployment — **VividWalls MAS** (Multi-Agent System for Premium Wall Art) — demonstrates the full stack: a React 19 + Vite dashboard connected to the MABOS extension, routed through the OpenClaw gateway, with TypeDB as the persistent knowledge graph.

---

## 2. Design Philosophy and Principles

### 2.1 Core Tenets

| Tenet                                  | Implication                                                                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **"The AI that actually does things"** | The system is built for action, not just conversation. Tool use, command execution, and workflow orchestration are first-class concerns. |
| **Security first**                     | Sandboxed execution, approval flows, per-channel isolation, and encrypted memory at rest.                                                |
| **Stability over features**            | The platform favors well-tested, reliable subsystems over rapid feature churn.                                                           |
| **Setup UX matters**                   | First-run experience is a design priority — `npx openclaw` should get a user operational.                                                |
| **Memory is special**                  | Memory is not just another plugin hook; it has a dedicated slot in the architecture because it underpins every interaction.              |

### 2.2 Architectural Constraints

1. **Single-language stack**: TypeScript everywhere — server, CLI, extensions, build tooling, native app shared logic.
2. **No mandatory external services**: The platform must operate with only SQLite and a configured LLM provider. TypeDB, LanceDB, and cloud embedding providers are optional enhancements.
3. **Plugin isolation**: Extensions must not be able to corrupt core state. They interact through well-defined hook contracts and registered tool interfaces.
4. **Channel neutrality**: The gateway treats every messaging channel identically after normalization. Channel-specific behavior lives exclusively in the channel extension.

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT / INTERFACE LAYER                          │
│                                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ Terminal  │  │  Native  │  │  React   │  │  40+     │  │  OpenAI-    │  │
│  │   CLI     │  │   Apps   │  │Dashboard │  │ Channel  │  │  Compat API │  │
│  │          │  │(iOS/Mac/ │  │(Vite+R19)│  │ Webhooks │  │  Consumers  │  │
│  │          │  │ Android) │  │          │  │          │  │             │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘  │
│       │              │              │              │               │         │
└───────┼──────────────┼──────────────┼──────────────┼───────────────┼─────────┘
        │              │              │              │               │
        ▼              ▼              ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     OPENCLAW GATEWAY (Express 5.2 + WS)                    │
│                          Port 18789 (default)                               │
│                                                                             │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────────┐  │
│  │  Auth   │  │ Session  │  │  Channel  │  │  Exec    │  │  Config    │  │
│  │ Module  │  │  Mgmt    │  │  Router   │  │ Approval │  │ Hot-Reload │  │
│  └─────────┘  └──────────┘  └───────────┘  └──────────┘  └────────────┘  │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐                   │
│  │ OpenAI  │  │  Canvas  │  │  Device   │  │  Health  │                   │
│  │ Compat  │  │ Service  │  │  Pairing  │  │ Monitor  │                   │
│  └─────────┘  └──────────┘  └───────────┘  └──────────┘                   │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌──────────────┐   ┌───────────────────┐   ┌──────────────────┐
│  PLUGIN      │   │   MEMORY          │   │   LLM PROVIDER   │
│  SYSTEM      │   │   SUBSYSTEM       │   │   LAYER           │
│              │   │                   │   │                   │
│ Discovery    │   │ SQLite + FTS5     │   │ Anthropic Claude  │
│ Loader       │   │ sqlite-vec        │   │ OpenAI-compat     │
│ Registry     │   │ Hybrid Search     │   │ GitHub Copilot    │
│ Hook Engine  │   │ Embeddings        │   │ Google AI         │
│ Tool Router  │   │ Query Expansion   │   │ Qwen              │
│ HTTP Mount   │   │ Temporal Decay    │   │ MCP (mcporter)    │
└──────┬───────┘   └─────────┬─────────┘   └──────────────────┘
       │                     │
       ▼                     │
┌──────────────────────────────────────────────────────────────────────────┐
│                         EXTENSION LAYER                                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  MABOS — Multi-Agent Business Operating System                     │  │
│  │                                                                    │  │
│  │  99 Tools · 21 Modules · BDI Cognitive Architecture                │  │
│  │  SBVR Ontology · HTN Planning · ACL Messaging · BPMN Workflows    │  │
│  │  SPO Fact Store · Rule Engine · Inference Engine · CBR-BDI         │  │
│  │  TypeDB Integration (optional)                                     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Discord  │ │ Telegram │ │  Slack   │ │ WhatsApp │ │ 36+ more...  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│                                                                          │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────┐                  │
│  │ memory-core  │  │ memory-lancedb │  │ copilot-proxy│                  │
│  └──────────────┘  └────────────────┘  └──────────────┘                  │
└──────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         PERSISTENCE LAYER                                │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                    │
│  │   SQLite      │  │   TypeDB     │  │   LanceDB    │                    │
│  │ (primary)     │  │ (optional)   │  │ (optional)   │                    │
│  │ FTS5 + vec   │  │ Knowledge    │  │ Vector       │                    │
│  │              │  │ Graph        │  │ Store        │                    │
│  └──────────────┘  └──────────────┘  └──────────────┘                    │
└──────────────────────────────────────────────────────────────────────────┘
```

The architecture follows a layered model:

1. **Client Layer** — terminals, native apps, dashboards, messaging platform webhooks, and OpenAI-compatible API consumers.
2. **Gateway Layer** — the central Express 5.2 + WebSocket server that authenticates, routes, and manages sessions.
3. **Core Services** — the plugin system, memory subsystem, and LLM provider abstraction.
4. **Extension Layer** — all channel integrations, MABOS, memory backends, and third-party plugins.
5. **Persistence Layer** — SQLite (mandatory), TypeDB and LanceDB (optional).

---

## 4. Repository Layout and Project Structure

```
openclaw-mabos/
│
├── src/                              # ── Core Platform Source ──────────────
│   ├── index.ts                      # Main entry: CLI (commander), dotenv,
│   │                                 #   logging (pino), global error handlers
│   ├── gateway/                      # HTTP + WebSocket API server (~200 files)
│   │   ├── auth.ts                   # Authentication module
│   │   ├── server.ts                 # Express 5.2 + WS bootstrap
│   │   ├── sessions/                 # Gateway-level session handling
│   │   ├── channels/                 # Channel routing, health monitor
│   │   ├── openai-compat/            # /v1/chat/completions et al.
│   │   ├── exec-approval/            # Remote command execution approval
│   │   ├── canvas/                   # Rich content canvas
│   │   └── device-pairing/           # Device pairing protocol
│   │
│   ├── channels/                     # Channel configuration, dock, allowlists
│   ├── memory/                       # Memory subsystem
│   │   ├── embeddings/               # Embedding providers
│   │   │   ├── openai.ts
│   │   │   ├── gemini.ts
│   │   │   ├── voyage.ts
│   │   │   ├── node-llama.ts
│   │   │   └── remote-client.ts
│   │   ├── search/                   # Hybrid search engine
│   │   │   ├── hybrid.ts             # BM25 + cosine fusion
│   │   │   ├── mmr.ts                # Maximal Marginal Relevance
│   │   │   └── temporal-decay.ts     # Time-weighted scoring
│   │   ├── sqlite/                   # SQLite backend
│   │   │   ├── schema.ts             # FTS5 + sqlite-vec tables
│   │   │   ├── migrations/           # Schema migrations
│   │   │   └── batch.ts              # Batch insert/update
│   │   ├── manager.ts                # Search orchestrator, reindex, watcher
│   │   └── query-expansion.ts        # LLM-assisted query expansion
│   │
│   ├── plugins/                      # Plugin system
│   │   ├── discovery.ts              # npm, local, bundled scanning
│   │   ├── loader.ts                 # Dynamic import, manifest validation
│   │   ├── registry.ts               # Tool/hook/service/route registry
│   │   ├── hooks/                    # Hook categories
│   │   │   ├── tool-call.ts
│   │   │   ├── compaction.ts
│   │   │   ├── gateway.ts
│   │   │   ├── llm.ts
│   │   │   ├── message.ts
│   │   │   ├── session.ts
│   │   │   └── subagent.ts
│   │   ├── services/                 # Background service management
│   │   ├── tools/                    # Tool registration interface
│   │   └── http-routes.ts            # Plugin HTTP route mounting
│   │
│   ├── providers/                    # LLM provider adapters
│   │   ├── github-copilot/           # Copilot auth + proxy
│   │   ├── google/                   # Google AI adapter
│   │   └── qwen/                     # Qwen auth provider
│   │
│   ├── agents/                       # Agent lifecycle management
│   ├── auto-reply/                   # Auto-reply + memory flush on compaction
│   ├── browser/                      # Playwright browser automation
│   ├── cli/                          # CLI commands (commander)
│   ├── config/                       # Configuration loading, validation, hot-reload
│   ├── cron/                         # Scheduled task engine
│   ├── hooks/                        # Core system hooks
│   ├── security/                     # Sandbox, permissions, approval
│   └── sessions/                     # Core session management
│
├── extensions/                       # ── Extension Packages ───────────────
│   ├── mabos/                        # MABOS: BDI + SBVR multi-agent (99 tools)
│   ├── memory-core/                  # Core memory extension
│   ├── memory-lancedb/               # LanceDB vector memory backend
│   ├── discord/                      # Discord channel
│   ├── slack/                        # Slack channel
│   ├── telegram/                     # Telegram channel
│   ├── whatsapp/                     # WhatsApp channel (Baileys)
│   ├── signal/                       # Signal channel
│   ├── matrix/                       # Matrix channel
│   ├── line/                         # LINE channel
│   ├── imessage/                     # iMessage channel
│   ├── irc/                          # IRC channel
│   ├── nostr/                        # Nostr channel
│   ├── copilot-proxy/                # GitHub Copilot proxy
│   ├── voice-call/                   # Voice call handling
│   └── ...                           # 25+ additional extensions
│
├── mabos/                            # ── MABOS Runtime ────────────────────
│   └── bdi-runtime/
│       └── index.ts                  # Heartbeat, cognitive files, pruning
│
├── apps/                             # ── Native Companion Apps ────────────
│   ├── android/                      # Kotlin Android app
│   ├── ios/                          # Swift/SwiftUI iOS app
│   ├── macos/                        # Native macOS app
│   └── shared/                       # Cross-platform shared code
│
├── packages/                         # ── Internal Packages ────────────────
│   ├── clawdbot/                     # ClawdBot shared package
│   └── moltbot/                      # MoltBot shared package
│
├── docker/                           # ── Container Deployment ─────────────
│   ├── Dockerfile                    # Standard image
│   ├── Dockerfile.sandbox            # Sandboxed execution
│   └── Dockerfile.sandbox-browser    # Sandbox + Playwright
│
├── docs/                             # ── Documentation ────────────────────
│   └── plans/
│       ├── 2026-02-24-memory-system-architecture.md
│       └── 2026-02-24-bdi-sbvr-multiagent-framework.md
│
├── package.json                      # Root workspace config
├── pnpm-workspace.yaml               # pnpm workspace definitions
├── tsconfig.json                     # TypeScript configuration
├── tsdown.config.ts                  # Bundle configuration
├── vitest.config.ts                  # Test configuration
├── VISION.md                         # Project vision and principles
└── README.md                         # Project overview
```

### 4.1 Module Count Summary

| Area                  | Approximate File Count | Description                         |
| --------------------- | ---------------------- | ----------------------------------- |
| `src/gateway/`        | ~200                   | API server, auth, sessions, canvas  |
| `src/memory/`         | ~30                    | Search, embeddings, SQLite backend  |
| `src/plugins/`        | ~40                    | Discovery, loading, hooks, tools    |
| `src/` (other)        | ~80                    | CLI, config, agents, security, etc. |
| `extensions/mabos/`   | ~99 tools, 21 modules  | MABOS cognitive system              |
| `extensions/` (other) | ~40 packages           | Channels, memory, features          |
| `apps/`               | ~30                    | Native companion apps               |
| **Total**             | **~500+**              |                                     |

---

## 5. Core Platform — `src/`

### 5.1 Entry Point (`src/index.ts`)

The main entry point bootstraps the entire platform:

```
┌─────────────────────────────────────────────────┐
│              src/index.ts — Bootstrap            │
│                                                  │
│  1. Load environment (.env via dotenv)           │
│  2. Initialize logging (pino)                    │
│  3. Parse CLI arguments (commander)              │
│  4. Register global error handlers               │
│  5. Load configuration                           │
│  6. Initialize plugin system                     │
│  7. Start memory subsystem                       │
│  8. Start gateway server                         │
│  9. Discover and load extensions                 │
│ 10. Begin BDI runtime heartbeat (if MABOS)       │
│ 11. Start cron scheduler                         │
│ 12. Report ready status                          │
└─────────────────────────────────────────────────┘
```

Two distinct binaries are produced by the build:

- **`openclaw`** — the core platform, gateway, and plugin host.
- **`mabos`** — the MABOS-specific entrypoint that boots the BDI runtime directly.

Both binaries share the same core; the `mabos` binary adds the BDI heartbeat loop and cognitive file management as a foreground concern.

### 5.2 Configuration (`src/config/`)

Configuration is loaded from multiple sources with a defined precedence:

1. CLI flags (highest precedence)
2. Environment variables
3. Configuration file (`~/.openclaw/config.yaml` or `$OPENCLAW_CONFIG`)
4. Default values (lowest precedence)

Hot-reload is supported: the config watcher (chokidar 5) detects changes and propagates them through the system without requiring a restart.

### 5.3 CLI (`src/cli/`)

Built on `commander`, the CLI exposes commands for:

- Starting and stopping the gateway
- Managing extensions (install, remove, list, update)
- Running one-shot prompts
- Managing sessions and agents
- Configuration introspection and editing
- Database management (migrate, reindex, vacuum)

### 5.4 Cron Scheduler (`src/cron/`)

A lightweight cron engine for scheduled tasks:

- Memory compaction and consolidation cycles
- Health check sweeps across channels
- BDI maintenance triggers (delegated to the runtime)
- Custom scheduled tasks registered by extensions

### 5.5 Browser Automation (`src/browser/`)

Playwright-core integration for web automation tasks:

- Page navigation, interaction, and data extraction
- Screenshot capture with sharp-based image processing
- Headless and headed modes
- Sandboxed execution via the security module

---

## 6. Gateway Architecture

The gateway is the central nervous system of the OpenClaw platform — an Express 5.2 server augmented with WebSocket support, listening on port **18789** by default.

### 6.1 Server Bootstrap

```
                    ┌─────────────────────────────┐
                    │      Gateway Bootstrap       │
                    │        (server.ts)           │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  Express 5.2 Application      │
                    │                               │
                    │  Middleware Stack:             │
                    │  ├─ helmet (security headers) │
                    │  ├─ cors (cross-origin)       │
                    │  ├─ compression (gzip/br)     │
                    │  ├─ auth middleware            │
                    │  ├─ session middleware         │
                    │  ├─ channel router             │
                    │  └─ plugin HTTP routes         │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  WebSocket Server (ws)        │
                    │                               │
                    │  Upgrade handling on same     │
                    │  HTTP server instance          │
                    │  Real-time streaming           │
                    │  Binary + text frames          │
                    └──────────────────────────────┘
```

### 6.2 Authentication Module (`gateway/auth.ts`)

Four authentication strategies, selectable per deployment:

| Strategy           | Use Case                          | Mechanism                                  |
| ------------------ | --------------------------------- | ------------------------------------------ |
| **Token**          | API consumers, scripts, CI/CD     | Bearer token in `Authorization` header     |
| **Password**       | Human users via CLI or dashboard  | Username/password with session cookie      |
| **Tailscale**      | Zero-config on Tailscale networks | Tailscale identity header verification     |
| **Device Pairing** | Native app onboarding             | QR code or numeric code challenge-response |

Authentication is middleware-based: every request passes through the auth layer before reaching route handlers. WebSocket connections authenticate during the upgrade handshake.

### 6.3 API Surface

**REST Endpoints:**

| Path                       | Method   | Description                         |
| -------------------------- | -------- | ----------------------------------- |
| `/api/chat`                | POST     | Send a message, receive a response  |
| `/api/sessions`            | GET/POST | List or create sessions             |
| `/api/sessions/:id`        | GET/PUT  | Get or update a session             |
| `/api/config`              | GET/PUT  | Read or update configuration        |
| `/api/health`              | GET      | System health check                 |
| `/api/channels`            | GET      | List connected channels             |
| `/api/channels/:id/health` | GET      | Channel-specific health             |
| `/api/plugins`             | GET      | List installed plugins              |
| `/api/exec/approve`        | POST     | Approve a pending command execution |
| `/api/exec/reject`         | POST     | Reject a pending command execution  |

**OpenAI-Compatible Endpoints** (`gateway/openai-compat/`):

| Path                   | Method | Description                       |
| ---------------------- | ------ | --------------------------------- |
| `/v1/chat/completions` | POST   | Chat completion (streaming/batch) |
| `/v1/models`           | GET    | List available models             |
| `/v1/embeddings`       | POST   | Generate embeddings               |

This compatibility layer allows OpenClaw to serve as a drop-in replacement for OpenAI API consumers — any tool or library that speaks the OpenAI protocol can connect directly.

**WebSocket Protocol:**

WebSocket connections on the same port support:

- Real-time message streaming (token-by-token)
- Session state synchronization
- Channel event forwarding
- Exec approval interactive prompts

### 6.4 Channel Router (`gateway/channels/`)

The channel router is responsible for:

1. **Inbound routing** — receiving webhooks from messaging platforms and dispatching them to the correct channel extension.
2. **Outbound routing** — taking LLM responses and directing them back through the originating channel extension.
3. **Health monitoring** — polling channel extensions for connectivity status and triggering reconnection when failures are detected.
4. **Auto-reconnect** — exponential backoff reconnection for channels that lose their upstream connection.

### 6.5 Exec Approval Flow (`gateway/exec-approval/`)

When the LLM requests command execution (shell commands, file operations, etc.), the exec approval module intercepts the request:

```
LLM requests exec  ──►  Approval queue  ──►  User notified (WS/push)
                                                      │
                                              ┌───────▼───────┐
                                              │  User decides  │
                                              │  Approve/Reject│
                                              └───────┬───────┘
                                                      │
                                    ┌─────────────────┼─────────────────┐
                                    │                                   │
                              Approved                            Rejected
                                    │                                   │
                           Execute in sandbox                   Return denial
                                    │                           to LLM
                           Return result to LLM
```

This flow ensures that no command executes without explicit user consent, unless pre-approved by policy rules in the security module.

### 6.6 Canvas Service (`gateway/canvas/`)

The canvas service provides rich content rendering:

- Structured output formatting (tables, charts, diagrams)
- Multi-part response assembly
- Media attachment handling
- Preview generation for shared content

### 6.7 Device Pairing (`gateway/device-pairing/`)

The device pairing protocol connects native companion apps to the gateway:

1. User initiates pairing from the CLI or dashboard.
2. Gateway generates a time-limited pairing code (QR or numeric).
3. Native app scans/enters the code.
4. Challenge-response handshake establishes trust.
5. A persistent device token is issued for future connections.

---

## 7. Channel Integration Architecture

### 7.1 Channel Tiers

OpenClaw supports 40+ messaging channels organized into three tiers based on feature depth:

**Tier 1 — Full-Featured:**

| Channel  | SDK                     | Capabilities                                     |
| -------- | ----------------------- | ------------------------------------------------ |
| WhatsApp | @whiskeysockets/baileys | Text, images, voice, video, documents, reactions |
| Telegram | node-telegram-bot-api   | Text, media, inline keyboards, bot commands      |
| Slack    | @slack/web-api          | Text, blocks, threads, reactions, slash commands |
| Discord  | discord.js              | Text, embeds, threads, reactions, slash commands |
| LINE     | @line/bot-sdk           | Text, stickers, rich menus, flex messages        |
| Matrix   | matrix-js-sdk           | Text, media, E2EE, rooms, threads                |

**Tier 2 — Standard:**

| Channel  | Integration Method           | Capabilities                |
| -------- | ---------------------------- | --------------------------- |
| Signal   | signal-client                | Text, media, E2EE           |
| iMessage | AppleScript/Shortcuts bridge | Text, media (macOS only)    |
| IRC      | Custom IRC client            | Text, channels, DMs         |
| Nostr    | nostr-tools                  | Text, signed events, relays |

**Tier 3 — Specialized:**

| Channel        | Integration Method    | Capabilities                   |
| -------------- | --------------------- | ------------------------------ |
| Voice call     | WebRTC/SIP bridge     | Speech-to-text, text-to-speech |
| Email          | IMAP/SMTP             | Full email with attachments    |
| SMS            | Twilio/carrier bridge | Text messages                  |
| Custom webhook | HTTP POST             | Arbitrary JSON payloads        |

### 7.2 Channel Extension Contract

Every channel extension implements a standard interface:

```typescript
interface ChannelExtension {
  // Identity
  readonly id: string;
  readonly name: string;
  readonly tier: "full" | "standard" | "specialized";

  // Lifecycle
  initialize(config: ChannelConfig): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Messaging
  sendMessage(session: Session, message: NormalizedMessage): Promise<void>;
  registerWebhook(router: Express.Router): void;

  // Health
  getHealth(): ChannelHealth;

  // Normalization
  normalizeInbound(raw: unknown): NormalizedMessage;
  formatOutbound(message: NormalizedMessage): unknown;
}
```

### 7.3 Message Normalization

All platform-specific message formats are normalized to a common internal representation:

```typescript
interface NormalizedMessage {
  id: string;
  channelId: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  content: string;
  contentType: "text" | "image" | "voice" | "video" | "file" | "mixed";
  attachments: Attachment[];
  replyTo?: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}
```

This normalization ensures that the gateway, LLM provider layer, and all downstream processors operate on a single, predictable message schema regardless of originating platform.

### 7.4 Channel Routing Flow

```
  ┌──────────────┐     ┌──────────────┐     ┌───────────────┐
  │  Messaging   │     │   Channel    │     │    Gateway     │
  │  Platform    │────►│  Extension   │────►│   Channel      │
  │  (Webhook)   │     │  normalize() │     │   Router       │
  └──────────────┘     └──────────────┘     └───────┬───────┘
                                                     │
                                         ┌───────────▼──────────┐
                                         │   Session Lookup /    │
                                         │   Creation            │
                                         └───────────┬──────────┘
                                                     │
                                         ┌───────────▼──────────┐
                                         │   Memory Retrieval    │
                                         │   (context loading)   │
                                         └───────────┬──────────┘
                                                     │
                                         ┌───────────▼──────────┐
                                         │   LLM Provider        │
                                         │   (generate response) │
                                         └───────────┬──────────┘
                                                     │
                                         ┌───────────▼──────────┐
                                         │   Tool Execution      │
                                         │   (if tool calls)     │
                                         └───────────┬──────────┘
                                                     │
                                         ┌───────────▼──────────┐
                                         │   Memory Storage      │
                                         │   (persist exchange)  │
                                         └───────────┬──────────┘
                                                     │
  ┌──────────────┐     ┌──────────────┐  ┌───────────▼──────────┐
  │  Messaging   │     │   Channel    │  │    Gateway            │
  │  Platform    │◄────│  Extension   │◄─│   Response Router     │
  │  (API call)  │     │  format()    │  │                       │
  └──────────────┘     └──────────────┘  └──────────────────────┘
```

---

## 8. Plugin System

The plugin system is the primary extensibility mechanism for OpenClaw. Every channel, memory backend, and MABOS itself are plugins.

### 8.1 Plugin Discovery (`plugins/discovery.ts`)

Three discovery sources, scanned in order:

1. **Bundled extensions** (`extensions/` directory) — shipped with the platform, always available.
2. **Local plugins** (`~/.openclaw/plugins/`) — user-installed local packages.
3. **npm packages** — any npm package with the `openclaw-plugin` keyword in its `package.json`.

Discovery produces a manifest list, each entry containing:

```typescript
interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  source: "bundled" | "local" | "npm";
  entryPoint: string;
  provides: {
    tools?: ToolDefinition[];
    hooks?: HookRegistration[];
    services?: ServiceDefinition[];
    routes?: RouteDefinition[];
    memoryProvider?: boolean;
  };
  dependencies: string[];
  permissions: PermissionSet;
}
```

### 8.2 Plugin Loading (`plugins/loader.ts`)

```
Discovery          Validation         Loading           Registration
─────────          ──────────         ───────           ────────────

Scan sources  ──►  Validate     ──►  Dynamic     ──►  Register:
                   manifests         import            ├─ Tools
                   Resolve           Initialize        ├─ Hooks
                   dependencies      plugin            ├─ Services
                   Check                               ├─ Routes
                   permissions                         └─ Memory
                                                          provider
```

Loading is sequential within dependency chains but parallel across independent plugins. The loader:

1. Validates each manifest against the plugin schema.
2. Resolves dependency ordering (topological sort).
3. Dynamically imports the plugin entrypoint.
4. Calls the plugin's `initialize()` method with configuration.
5. Registers all provided tools, hooks, services, and routes.

### 8.3 Plugin Registry (`plugins/registry.ts`)

The registry is the central catalog of all active plugin contributions:

| Registry     | Description                                | Access Pattern                   |
| ------------ | ------------------------------------------ | -------------------------------- |
| **Tools**    | Callable functions exposed to the LLM      | By name, by category, list all   |
| **Hooks**    | Event handlers for system lifecycle events | By category, ordered by priority |
| **Services** | Long-running background processes          | By name, start/stop/status       |
| **Routes**   | HTTP endpoints mounted on the gateway      | By path prefix                   |
| **Memory**   | Active memory provider (single slot)       | Singleton access                 |

### 8.4 Hook System (`plugins/hooks/`)

Seven hook categories cover the full system lifecycle:

| Hook Category | Trigger                                | Example Use                        |
| ------------- | -------------------------------------- | ---------------------------------- |
| `tool-call`   | Before/after a tool is invoked         | Logging, rate limiting, transforms |
| `compaction`  | When conversation context is compacted | Memory flush, summary generation   |
| `gateway`     | HTTP request/response lifecycle        | Request logging, custom auth       |
| `llm`         | Before/after LLM provider calls        | Prompt injection, response filter  |
| `message`     | Message received/sent events           | Content filtering, analytics       |
| `session`     | Session created/updated/destroyed      | Cleanup, persistence, audit        |
| `subagent`    | Sub-agent spawned/completed/failed     | Orchestration, monitoring          |

Hooks are ordered by priority (lower number = earlier execution). A hook can:

- **Pass through** — do nothing, let the next hook run.
- **Modify** — alter the payload before passing it along.
- **Short-circuit** — return a result directly, skipping subsequent hooks and the default handler.

### 8.5 Plugin Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Discover │───►│ Validate │───►│   Load   │───►│ Register │───►│  Ready   │
│          │    │ Manifest │    │          │    │ Tools/   │    │          │
│ Scan     │    │ Resolve  │    │ Dynamic  │    │ Hooks/   │    │ Accept   │
│ sources  │    │ deps     │    │ import   │    │ Services/│    │ requests │
│          │    │ Check    │    │ init()   │    │ Routes   │    │          │
└──────────┘    │ perms    │    └──────────┘    └──────────┘    └──────────┘
                └──────────┘
                     │
                     ▼ (on failure)
               ┌──────────┐
               │  Skip +  │
               │  Log     │
               │  Warning │
               └──────────┘
```

A failed plugin load never crashes the platform — the plugin is skipped and a warning is logged.

---

## 9. Memory Subsystem

Memory in OpenClaw is not a simple key-value store. It is a hybrid search system that combines full-text search with vector similarity to provide contextually relevant recall for every conversation.

### 9.1 Storage Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SQLite Database (better-sqlite3)             │
│                                                                  │
│  ┌─────────────────────────┐  ┌──────────────────────────────┐  │
│  │     FTS5 Virtual Table  │  │   sqlite-vec Virtual Table   │  │
│  │                          │  │                              │  │
│  │  Full-text search index  │  │  Vector similarity index    │  │
│  │  BM25 scoring            │  │  Cosine distance            │  │
│  │  Tokenized content       │  │  Float32 embeddings         │  │
│  └─────────────────────────┘  └──────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Content Table                             │ │
│  │  id | session_id | content | embedding | timestamp | meta   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

SQLite is the only mandatory storage dependency. The FTS5 extension provides full-text search with BM25 relevance scoring, while `sqlite-vec` provides vector similarity search using pre-computed embeddings.

### 9.2 Embedding Providers (`memory/embeddings/`)

| Provider      | Module             | Dimensions | Notes                              |
| ------------- | ------------------ | ---------- | ---------------------------------- |
| OpenAI        | `openai.ts`        | 1536/3072  | text-embedding-3-small/large       |
| Google Gemini | `gemini.ts`        | 768        | Gemini embedding model             |
| Voyage AI     | `voyage.ts`        | 1024       | voyage-2 and variants              |
| Local (llama) | `node-llama.ts`    | varies     | Runs on-device, no API calls       |
| Remote client | `remote-client.ts` | varies     | Proxy to any HTTP embedding server |

The embedding provider is configured globally. Changing the provider triggers an automatic reindex of all stored memories.

### 9.3 Hybrid Search Engine (`memory/search/`)

The search engine fuses two scoring signals:

```
Query: "How do we handle customer refunds?"
         │
         ├──► FTS5 BM25 Search ──────────────► BM25 scores
         │    (keyword matching)                    │
         │                                          │
         ├──► Embedding ──► sqlite-vec ──────► Cosine scores
         │    (semantic matching)                    │
         │                                          │
         └──► Query Expansion (LLM) ─┐              │
              "refund policy"         │              │
              "return process"        │              │
              "money back"            │              │
                    │                 │              │
                    └──► Additional ──┘              │
                         search                     │
                         passes                     │
                                                    │
         ┌──────────────────────────────────────────▼───┐
         │           Score Fusion Layer                   │
         │                                                │
         │  final = α·BM25_norm + β·cosine_norm           │
         │  where α + β = 1, default α=0.3, β=0.7        │
         │                                                │
         │  Apply temporal decay:                         │
         │  score *= decay_factor^(age_in_days)           │
         └────────────────────┬───────────────────────────┘
                              │
         ┌────────────────────▼───────────────────────────┐
         │        MMR Re-ranking                           │
         │  (Maximal Marginal Relevance)                   │
         │                                                 │
         │  Iteratively select results that are:           │
         │  - Highly relevant to the query                 │
         │  - Maximally diverse from already-selected      │
         │                                                 │
         │  λ·sim(doc, query) - (1-λ)·max_sim(doc, selected) │
         └────────────────────┬───────────────────────────┘
                              │
                              ▼
                     Ranked result set
```

**Key parameters:**

| Parameter      | Default | Description                        |
| -------------- | ------- | ---------------------------------- |
| `alpha`        | 0.3     | Weight for BM25 keyword score      |
| `beta`         | 0.7     | Weight for cosine similarity score |
| `decay_factor` | 0.995   | Daily temporal decay rate          |
| `mmr_lambda`   | 0.7     | MMR diversity-relevance tradeoff   |
| `top_k`        | 10      | Number of results to return        |

### 9.4 Memory Manager (`memory/manager.ts`)

The memory manager orchestrates all memory operations:

- **Async search** — non-blocking search with configurable timeout.
- **Atomic reindex** — reindexes all content under a write lock, ensuring consistency.
- **Watcher configuration** — integrates with chokidar 5 for file-based memory source changes.
- **Batch processing** — bulk insert/update operations with transaction batching.

### 9.5 Query Expansion (`memory/query-expansion.ts`)

Before search, the query expansion module can optionally use the LLM to generate related search terms:

```
User query: "refund policy"
     │
     ▼
LLM expansion: ["return process", "money back guarantee",
                 "cancellation terms", "customer reimbursement"]
     │
     ▼
Expanded search: OR("refund policy", "return process",
                    "money back guarantee", ...)
```

This improves recall for queries where the user's phrasing does not match stored content verbatim.

### 9.6 Memory as Plugin Slot

Memory is a "special plugin slot" in the architecture. The platform provides the search/retrieval interface, but the actual storage backend is provided by a memory extension:

- **memory-core** — the default SQLite-based backend (FTS5 + sqlite-vec).
- **memory-lancedb** — an alternative backend using LanceDB for vector storage.

Only one memory provider can be active at a time. Switching providers triggers a data migration.

### 9.7 Planned RLM Enhancements

Five Recursive Learning Memory enhancements are planned:

| ID  | Enhancement                              | Description                                                    |
| --- | ---------------------------------------- | -------------------------------------------------------------- |
| R1  | Recursive Memory Consolidation           | Automatically consolidate related memories into summaries      |
| R2  | Hierarchical Memory Index                | Daily, weekly, monthly, quarterly summary layers               |
| R3  | Context-Aware Pre-Compaction Compression | Create checkpoints before compacting conversation context      |
| R4  | Recursive Memory Search                  | Multi-depth search refinement with iterative query improvement |
| R5  | BDI Cycle as Recursive Reasoning Loop    | Integrate BDI cognitive cycle into memory retrieval            |

For full details on memory architecture, see:
**`docs/plans/2026-02-24-memory-system-architecture.md`**

---

## 10. LLM Provider Layer

The LLM provider layer abstracts model access behind a uniform interface, allowing the platform to work with multiple AI providers simultaneously.

### 10.1 Provider Architecture

```
┌───────────────────────────────────────────────────────┐
│                  LLM Provider Interface                │
│                                                        │
│  chat(messages, options) → AsyncIterable<Token>        │
│  embed(text) → Float32Array                            │
│  listModels() → Model[]                                │
└────────────────────────┬──────────────────────────────┘
                         │
          ┌──────────────┼──────────────┬──────────────┐
          │              │              │              │
    ┌─────▼─────┐  ┌────▼─────┐  ┌────▼─────┐  ┌────▼──────┐
    │ Anthropic  │  │  OpenAI  │  │  Google  │  │   MCP     │
    │ Claude     │  │ -compat  │  │   AI     │  │ (mcporter)│
    │            │  │          │  │          │  │           │
    │ Primary    │  │ Fallback │  │ Provider │  │ Bridge to │
    │ provider   │  │ + proxy  │  │          │  │ external  │
    └────────────┘  └──────────┘  └──────────┘  │ tools     │
                         │                      └───────────┘
                    ┌────▼─────────┐
                    │   Proxied    │
                    │   Providers  │
                    │              │
                    │ ├─ Copilot   │
                    │ ├─ Qwen      │
                    │ └─ Custom    │
                    └──────────────┘
```

### 10.2 Provider Details

| Provider              | SDK/Method             | Role                                    |
| --------------------- | ---------------------- | --------------------------------------- |
| **Anthropic Claude**  | `@anthropic-ai/sdk`    | Primary LLM — reasoning, tool use, chat |
| **OpenAI-compatible** | `@ai-sdk/openai`       | Drop-in for any OpenAI API server       |
| **GitHub Copilot**    | Custom auth + proxy    | Proxied through OpenAI-compat layer     |
| **Google AI**         | Custom adapter         | Gemini models for chat and embedding    |
| **Qwen**              | Custom auth provider   | Alibaba Qwen models                     |
| **MCP (mcporter)**    | Model Context Protocol | Bridge to MCP-compatible tool servers   |

### 10.3 MCP Integration

The **Model Context Protocol** (MCP) is supported via the `mcporter` bridge. This allows OpenClaw to:

- Connect to external MCP servers as tool providers.
- Expose its own tools as an MCP server.
- Bridge between MCP and the native plugin tool system.

### 10.4 Token Management

Token counting and context window management use `tiktoken`:

- Pre-flight token counting before LLM calls.
- Context window budgeting (system prompt + memory + conversation + tools).
- Automatic compaction when approaching the context limit.
- The `compaction` hook fires on context overflow, allowing plugins (including memory) to persist context before it is truncated.

---

## 11. Agent Management

### 11.1 Agent Lifecycle (`src/agents/`)

Agents are persistent identities within the platform. Each agent has:

- A unique identifier and display name.
- A system prompt defining its personality and capabilities.
- A set of allowed tools.
- Session history.
- Memory scope (per-agent or shared).

### 11.2 Sub-Agent Spawning

The platform supports spawning sub-agents for parallel task execution:

```
Primary Agent
     │
     ├──► spawn(ResearchAgent, task)  ──► executes ──► returns results
     │
     ├──► spawn(WritingAgent, task)   ──► executes ──► returns results
     │
     └──► aggregate results ──► respond to user
```

Sub-agent lifecycle events fire the `subagent` hook, allowing extensions to monitor and orchestrate multi-agent workflows.

### 11.3 Auto-Reply System (`src/auto-reply/`)

The auto-reply system handles unattended responses:

- Triggered when no human is actively monitoring a channel.
- Uses the configured agent's personality and tools.
- Integrates with memory: on compaction, flushes the current context to long-term memory before responding.
- Rate-limited and configurable per channel.

---

## 12. MABOS Extension — Multi-Agent Business Operating System

MABOS is the flagship extension — a complete BDI cognitive architecture with SBVR ontological grounding, packaged as an OpenClaw plugin. It transforms the platform from a conversational AI into an autonomous, goal-oriented multi-agent system.

### 12.1 Module Overview

MABOS provides **99 tools** across **21 modules**:

| Module               | Tools | Description                                           |
| -------------------- | ----- | ----------------------------------------------------- |
| BDI Core             | 8     | Belief/Desire/Intention CRUD, cognitive cycle control |
| SBVR Ontology        | 6     | Concept, fact type, and rule management               |
| Knowledge (SPO)      | 7     | Subject-Predicate-Object fact store                   |
| Rule Engine          | 6     | Inference rules, constraints, policies                |
| Inference Engine     | 5     | Forward/backward/abductive reasoning                  |
| Planning (HTN)       | 6     | Hierarchical Task Network decomposition               |
| Plan Library         | 4     | Reusable plan templates                               |
| CBR-BDI              | 5     | Case-Based Reasoning with BDI integration             |
| ACL Messaging        | 5     | Agent Communication Language                          |
| Contract Net         | 4     | Task allocation protocol                              |
| Workforce Management | 5     | Agent pool, roles, capabilities                       |
| Workflow (BPMN)      | 6     | Business process definition and execution             |
| Reasoning Methods    | 5     | Meta-reasoning router across 35 methods               |
| Context Management   | 3     | Shared context and blackboard                         |
| Goal Management      | 4     | Goal hierarchy, decomposition, tracking               |
| Monitoring           | 3     | Agent and system health monitoring                    |
| Analytics            | 3     | Performance metrics and reporting                     |
| TypeDB Integration   | 4     | Knowledge graph read/write                            |
| Memory Bridge        | 3     | MABOS-to-OpenClaw memory interface                    |
| Configuration        | 3     | MABOS-specific configuration                          |
| Utilities            | 2     | Diagnostic and debugging tools                        |

### 12.2 BDI Cognitive Architecture

The BDI model in MABOS implements a 5-phase cognitive cycle:

```
                         ┌─────────────────┐
                         │                 │
              ┌──────────┤   PERCEIVE      │
              │          │                 │
              │          │ Gather beliefs   │
              │          │ from environment │
              │          │ and memory       │
              │          └────────┬────────┘
              │                   │
              │          ┌────────▼────────┐
              │          │                 │
              │          │  DELIBERATE     │
              │          │                 │
              │          │ Evaluate desires │
              │          │ against beliefs  │
              │          │ Select goals     │
              │          └────────┬────────┘
              │                   │
              │          ┌────────▼────────┐
              │          │                 │
              │          │     PLAN        │
              │          │                 │
              │          │ HTN decompose   │
              │          │ CBR adapt       │
              │          │ Generate steps  │
              │          └────────┬────────┘
              │                   │
              │          ┌────────▼────────┐
              │          │                 │
              │          │      ACT        │
              │          │                 │
              │          │ Execute plan    │
              │          │ Use tools       │
              │          │ Send messages   │
              │          └────────┬────────┘
              │                   │
              │          ┌────────▼────────┐
              │          │                 │
              └──────────┤     LEARN       │
                         │                 │
                         │ Update beliefs  │
                         │ Store outcomes  │
                         │ Adapt plans     │
                         └─────────────────┘
```

Each cycle iteration:

1. **Perceive** — gathers new information from the environment, message queues, and memory. Updates the belief base.
2. **Deliberate** — evaluates current desires against the updated belief base. Prioritizes goals. Detects conflicts.
3. **Plan** — decomposes selected goals into executable plans using HTN decomposition. Adapts plans from the case base via CBR-BDI.
4. **Act** — executes the current plan step by invoking tools, sending ACL messages, or triggering workflows.
5. **Learn** — records outcomes, updates the case base, adjusts beliefs, and prunes stale intentions.

### 12.3 SBVR Ontology Layer

MABOS uses 10 domain ontologies encoded in JSON-LD/OWL format:

| Ontology      | Concepts | Fact Types | Domain                           |
| ------------- | -------- | ---------- | -------------------------------- |
| Core Business | 25       | 18         | Organizations, roles, processes  |
| Product       | 20       | 15         | Products, categories, attributes |
| Customer      | 18       | 14         | Customers, segments, preferences |
| Order         | 15       | 12         | Orders, line items, fulfillment  |
| Financial     | 20       | 16         | Accounts, transactions, pricing  |
| Marketing     | 18       | 14         | Campaigns, channels, content     |
| Inventory     | 14       | 10         | Stock, warehouses, logistics     |
| HR            | 15       | 12         | Employees, roles, capabilities   |
| Communication | 12       | 10         | Messages, notifications, events  |
| Analytics     | 13       | 10         | Metrics, KPIs, reports           |
| **Total**     | **170**  | **131**    |                                  |

The SBVR layer provides:

- **Concepts** — named entities in the business domain.
- **Fact types** — relationships between concepts (binary, unary, ternary).
- **Rules** — constraints and derivation rules expressed in structured natural language.

### 12.4 Knowledge Management

**SPO Fact Store:**

A Subject-Predicate-Object triple store for runtime knowledge:

```
┌────────────────────────────────────────────────────┐
│  SPO Fact Store                                     │
│                                                     │
│  (Customer:001, hasPreference, "landscape art")     │
│  (Order:042, hasStatus, "shipped")                  │
│  (Agent:research, isCapableOf, "market analysis")   │
│  (Product:canvas-xl, hasPricePoint, "$149.99")      │
└────────────────────────────────────────────────────┘
```

**Rule Engine:**

Three rule types with distinct execution semantics:

| Rule Type      | Trigger                | Effect                           |
| -------------- | ---------------------- | -------------------------------- |
| **Inference**  | Pattern match on facts | Derive new facts                 |
| **Constraint** | Fact insertion/update  | Validate, reject if violated     |
| **Policy**     | Event or condition     | Trigger actions or notifications |

**Inference Engine:**

Three reasoning modes:

| Mode          | Direction                      | Use Case                                   |
| ------------- | ------------------------------ | ------------------------------------------ |
| **Forward**   | Facts → conclusions            | "Given these facts, what can we conclude?" |
| **Backward**  | Goal → required facts          | "To prove this, what do we need?"          |
| **Abductive** | Observation → best explanation | "Why did this happen?"                     |

### 12.5 Multi-Agent Coordination

**ACL Messaging:**

MABOS agents communicate using an Agent Communication Language with 8 performatives:

| Performative | Semantics                            |
| ------------ | ------------------------------------ |
| `inform`     | Sender asserts a proposition         |
| `request`    | Sender requests an action            |
| `query-if`   | Sender asks if a proposition is true |
| `query-ref`  | Sender asks for a value              |
| `propose`    | Sender proposes an agreement         |
| `accept`     | Sender accepts a proposal            |
| `reject`     | Sender rejects a proposal            |
| `cfp`        | Call for proposals (Contract Net)    |

**Contract Net Protocol:**

Task allocation follows the FIPA Contract Net protocol:

```
  Manager Agent                         Participant Agents
       │                                      │
       │──── CFP (task description) ─────────►│
       │                                      │
       │◄─── Propose (bid) ──────────────────│ (multiple)
       │◄─── Refuse ─────────────────────────│ (some)
       │                                      │
       │──── Accept-proposal ────────────────►│ (winner)
       │──── Reject-proposal ────────────────►│ (losers)
       │                                      │
       │◄─── Inform-done (result) ───────────│
       │     or Failure ──────────────────────│
```

### 12.6 Planning System

**HTN (Hierarchical Task Network) Decomposition:**

Complex goals are decomposed into executable primitive tasks:

```
Goal: "Launch marketing campaign"
  │
  ├─► Task: "Prepare content"
  │     ├─► Subtask: "Research target audience"
  │     ├─► Subtask: "Draft copy"
  │     └─► Subtask: "Design visuals"
  │
  ├─► Task: "Configure channels"
  │     ├─► Subtask: "Set up email campaign"
  │     └─► Subtask: "Schedule social posts"
  │
  └─► Task: "Execute and monitor"
        ├─► Subtask: "Launch campaign"
        └─► Subtask: "Track metrics"
```

**Plan Library:**

Reusable plan templates stored and retrieved by:

- Goal type matching.
- Precondition evaluation.
- Historical success rate.

**CBR-BDI (Case-Based Reasoning with BDI):**

Past problem-solution pairs are stored as cases. When a new goal matches a past case, the stored plan is adapted:

1. **Retrieve** — find similar past cases.
2. **Reuse** — adapt the stored plan to the current situation.
3. **Revise** — execute and adjust based on results.
4. **Retain** — store the new case for future use.

### 12.7 Reasoning Methods

MABOS provides 35 reasoning methods across 6 categories:

| Category       | Methods | Examples                                    |
| -------------- | ------- | ------------------------------------------- |
| Deductive      | 6       | Syllogistic, modus ponens, rule application |
| Inductive      | 5       | Pattern generalization, trend extrapolation |
| Abductive      | 5       | Best explanation, diagnostic reasoning      |
| Analogical     | 5       | Case comparison, metaphor mapping           |
| Probabilistic  | 7       | Bayesian updating, decision trees           |
| Meta-reasoning | 7       | Strategy selection, confidence estimation   |

A **meta-reasoning router** selects the appropriate reasoning method based on:

- The type of question being asked.
- Available evidence quality.
- Time constraints.
- Historical method effectiveness for similar queries.

### 12.8 Workflow Engine (BPMN 2.0)

MABOS includes a BPMN 2.0 workflow engine for structured business processes:

- **Process definition** — BPMN XML or JSON process models.
- **Execution** — step-by-step process execution with state persistence.
- **Gateway support** — exclusive, parallel, and inclusive gateways.
- **Event handling** — timer events, message events, signal events.
- **Persistence** — workflow state stored in TypeDB (when available) or SQLite fallback.

### 12.9 TypeDB Integration

TypeDB provides an optional, strongly-typed knowledge graph:

```
┌──────────────────────────────────────────────────────┐
│                  TypeDB Integration                    │
│                                                       │
│  Write-through pattern:                               │
│                                                       │
│  MABOS SPO Store ───write──► TypeDB Knowledge Graph   │
│       │                           │                   │
│       │◄──── read ────────────────┘                   │
│       │                                               │
│  Local SPO is authoritative; TypeDB is the durable    │
│  persistence layer and advanced query engine.          │
└──────────────────────────────────────────────────────┘
```

TypeDB adds:

- Schema-enforced knowledge representation (entity, relation, attribute types).
- Rule-based inference at the database level.
- Complex graph pattern queries (TypeQL).
- Transaction isolation and ACID guarantees.

For comprehensive MABOS architecture details, see:
**`docs/plans/2026-02-24-bdi-sbvr-multiagent-framework.md`**

---

## 13. BDI Runtime Service

Located at `mabos/bdi-runtime/index.ts`, the BDI runtime is a persistent background service that maintains the cognitive state of every MABOS agent.

### 13.1 Cognitive File System

Each agent maintains 10 cognitive files:

| File              | Purpose                                          |
| ----------------- | ------------------------------------------------ |
| `Beliefs.md`      | Current beliefs about the world                  |
| `Desires.md`      | Goals the agent wants to achieve                 |
| `Intentions.md`   | Active commitments — goals the agent is pursuing |
| `Plans.md`        | Current plan steps for active intentions         |
| `Observations.md` | Raw observations from the environment            |
| `Reflections.md`  | Self-assessment and meta-cognitive notes         |
| `Conflicts.md`    | Detected belief/desire conflicts                 |
| `Capabilities.md` | Agent's available tools and skills               |
| `Context.md`      | Shared context from the blackboard               |
| `Memory-Index.md` | Index into long-term memory summaries            |

These files are Markdown-formatted for human readability and LLM processability. The runtime reads and writes them as the cognitive cycle progresses.

### 13.2 Heartbeat Cycle

The BDI runtime runs a maintenance heartbeat at a configurable interval (default: 60 seconds):

```
┌──────────────────────────────────────────────┐
│           BDI Heartbeat Cycle                 │
│                                               │
│  1. Load cognitive files for all agents       │
│  2. Prune completed intentions                │
│  3. Prune stale intentions (timeout)          │
│  4. Re-prioritize desires based on:           │
│     - Urgency                                 │
│     - Importance                              │
│     - Feasibility (belief-based)              │
│  5. Detect and report belief conflicts        │
│  6. Check for pending ACL messages            │
│  7. Trigger memory hierarchy builds:          │
│     - Weekly summaries (Sundays)              │
│     - Monthly rollups (1st of month)          │
│  8. Write updated cognitive files             │
│  9. Log cycle metrics                         │
│                                               │
│  Interval: configurable (default 60s)         │
└──────────────────────────────────────────────┘
```

### 13.3 Intention Pruning

The runtime prunes intentions based on two criteria:

- **Completion** — the intention's associated plan has fully executed (success or failure recorded).
- **Staleness** — the intention has not progressed within a configurable timeout (default: 24 hours).

Pruned intentions are moved to the agent's memory for future case-based reasoning.

### 13.4 Memory Hierarchy Builds

On a weekly schedule (default: Sundays), the runtime triggers hierarchical memory consolidation:

```
Daily conversation logs
         │
         ▼
Weekly summaries (every Sunday)
         │
         ▼
Monthly rollups (1st of month)
         │
         ▼
Quarterly digests (end of quarter)
```

This tiered summarization ensures that long-term memory remains compact and navigable while preserving key information at appropriate granularity.

---

## 14. Session and Conversation Management

### 14.1 Session Model

Sessions represent ongoing conversations with isolation guarantees:

```typescript
interface Session {
  id: string;
  channelId: string;
  agentId: string;
  userId: string;
  state: "active" | "idle" | "archived";
  context: Message[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  lastActiveAt: Date;
}
```

### 14.2 Per-Channel Isolation

Each messaging channel maintains its own session space. A user chatting on WhatsApp and Telegram simultaneously has two independent sessions with separate:

- Conversation history.
- Context window.
- Memory retrieval scope (configurable: per-session, per-channel, or global).

### 14.3 Context Window Management

```
┌──────────────────────────────────────────────────┐
│              Context Window Budget                │
│                                                   │
│  ┌────────────────────┐                           │
│  │  System Prompt      │  ~500-2000 tokens        │
│  ├────────────────────┤                           │
│  │  Memory Retrieval   │  ~1000-4000 tokens       │
│  ├────────────────────┤                           │
│  │  Tool Definitions   │  ~500-2000 tokens        │
│  ├────────────────────┤                           │
│  │  Conversation       │  Remaining budget         │
│  │  History            │                           │
│  ├────────────────────┤                           │
│  │  Current Message    │  Variable                 │
│  └────────────────────┘                           │
│                                                   │
│  When budget exceeded → compaction hook fires     │
│  → memory flush → context truncation              │
└──────────────────────────────────────────────────┘
```

---

## 15. Security Architecture

### 15.1 Threat Model

The security architecture addresses the following threat categories:

| Threat                        | Mitigation                                   |
| ----------------------------- | -------------------------------------------- |
| Unauthorized API access       | Multi-strategy authentication                |
| Malicious command execution   | Sandboxed execution + approval flow          |
| Cross-channel data leakage    | Per-channel session isolation                |
| Malicious plugin behavior     | Permission model + sandboxing                |
| Memory exfiltration           | Encryption at rest (configurable)            |
| Prompt injection via channels | Input sanitization + content filtering hooks |
| Credential theft              | No credentials in context window             |

### 15.2 Authentication Architecture

```
                    ┌─────────────────────┐
                    │   Incoming Request   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Auth Strategy       │
                    │  Selection           │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
   ┌──────▼──────┐    ┌───────▼──────┐    ┌───────▼──────┐
   │   Token     │    │  Password    │    │  Tailscale   │
   │   Auth      │    │  Auth        │    │  Identity    │
   │             │    │              │    │              │
   │ Bearer      │    │ Session      │    │ Header       │
   │ header      │    │ cookie       │    │ verification │
   └──────┬──────┘    └──────┬───────┘    └──────┬───────┘
          │                  │                    │
          └────────────┬─────┘────────────────────┘
                       │
              ┌────────▼────────┐
              │  Device Pairing │ (for native apps)
              │  Protocol       │
              │                 │
              │  QR/code        │
              │  challenge-     │
              │  response       │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  Authenticated  │
              │  Request        │
              │  + Identity     │
              └─────────────────┘
```

### 15.3 Sandboxed Execution

Command execution occurs in isolated environments:

**Standard sandbox:**

- Process isolation via OS-level mechanisms.
- Filesystem access restricted to allowed paths.
- Network access controlled by policy.
- Resource limits (CPU time, memory, file handles).

**Docker sandbox (`Dockerfile.sandbox`):**

- Full container isolation.
- Read-only filesystem except designated working directories.
- No network access by default (policy-grantable).
- Dropped capabilities (no `CAP_SYS_ADMIN`, no `CAP_NET_RAW`).

**Browser sandbox (`Dockerfile.sandbox-browser`):**

- All Docker sandbox protections.
- Playwright runs in its own isolated browser context.
- No access to host browser profiles or cookies.

### 15.4 Plugin Permission Model

Plugins declare required permissions in their manifest:

```typescript
interface PermissionSet {
  network?: boolean; // Can make HTTP requests
  filesystem?: {
    read: string[]; // Allowed read paths (glob)
    write: string[]; // Allowed write paths (glob)
  };
  exec?: boolean; // Can execute shell commands
  memory?: {
    read: boolean;
    write: boolean;
  };
  tools?: string[]; // Can invoke other tools by name
}
```

The platform enforces these permissions at runtime. A plugin attempting to exceed its declared permissions receives a denial error.

### 15.5 Memory Encryption

Memory encryption at rest is configurable:

- **Off** (default for development) — plain SQLite.
- **AES-256-GCM** — content and embeddings encrypted before storage.
- **Key management** — keys derived from a master passphrase via PBKDF2, stored in the OS keychain where available.

---

## 16. Native Companion Applications

### 16.1 Platform Support

| Platform | Technology        | Status | Features                          |
| -------- | ----------------- | ------ | --------------------------------- |
| iOS      | Swift / SwiftUI   | Active | Chat, notifications, voice, Siri  |
| Android  | Kotlin            | Active | Chat, notifications, voice        |
| macOS    | Native (AppKit)   | Active | Menubar, chat, system integration |
| Shared   | Cross-platform TS | Active | Shared protocol, message types    |

### 16.2 App Architecture

```
┌──────────────────────┐          ┌──────────────────────┐
│    Native App         │          │   OpenClaw Gateway    │
│                       │          │                       │
│  ┌─────────────────┐ │   WS     │  ┌─────────────────┐ │
│  │    UI Layer      │ │◄────────►│  │  WebSocket      │ │
│  │  (SwiftUI/      │ │          │  │  Server          │ │
│  │   Kotlin UI)    │ │          │  └─────────────────┘ │
│  └────────┬────────┘ │          │                       │
│           │          │          │  ┌─────────────────┐ │
│  ┌────────▼────────┐ │  REST    │  │  REST API       │ │
│  │ Shared Protocol │ │◄────────►│  │                 │ │
│  │ (TypeScript)    │ │          │  └─────────────────┘ │
│  └────────┬────────┘ │          │                       │
│           │          │          │  ┌─────────────────┐ │
│  ┌────────▼────────┐ │          │  │  Device Pairing │ │
│  │ Local Storage   │ │          │  │  Protocol       │ │
│  │ (offline cache) │ │          │  └─────────────────┘ │
│  └─────────────────┘ │          │                       │
└──────────────────────┘          └──────────────────────┘
```

Apps connect to the gateway via:

1. **Device pairing** for initial setup.
2. **WebSocket** for real-time message streaming.
3. **REST** for non-streaming operations (configuration, history).

Offline support: apps cache recent conversations locally and sync when the connection is restored.

---

## 17. Data Flow Diagrams

### 17.1 Complete Request Lifecycle

```
User sends message (any channel)
│
▼
[1] Channel Extension receives webhook/event
    ├─ Parse platform-specific format
    └─ normalizeInbound() → NormalizedMessage
│
▼
[2] Gateway Channel Router
    ├─ Identify target session (create if needed)
    ├─ Fire "message.received" hook
    └─ Pass to session handler
│
▼
[3] Session Handler
    ├─ Load session context
    ├─ Count tokens (tiktoken)
    └─ Check context budget
         │
         ├─ Budget OK → continue
         └─ Budget exceeded → fire "compaction" hook
              ├─ Memory flush (persist to long-term storage)
              └─ Truncate oldest context messages
│
▼
[4] Memory Retrieval
    ├─ Query expansion (optional, LLM-assisted)
    ├─ Hybrid search (FTS5 BM25 + sqlite-vec cosine)
    ├─ Temporal decay weighting
    ├─ MMR re-ranking
    └─ Return top-k relevant memories
│
▼
[5] Context Assembly
    ├─ System prompt
    ├─ Retrieved memories
    ├─ Available tool definitions
    ├─ Conversation history (within budget)
    └─ Current user message
│
▼
[6] LLM Provider
    ├─ Fire "llm.before" hook
    ├─ Send assembled context to provider (Claude/OpenAI/etc.)
    ├─ Stream response tokens
    └─ Fire "llm.after" hook
│
▼
[7] Tool Execution (if LLM requests tool calls)
    ├─ Fire "tool-call.before" hook
    ├─ Look up tool in registry
    ├─ Check permissions
    ├─ If exec: route through approval flow
    │     ├─ Notify user
    │     ├─ Wait for approve/reject
    │     └─ Execute in sandbox (if approved)
    ├─ Execute tool
    ├─ Fire "tool-call.after" hook
    └─ Return result to LLM → goto [6] for continuation
│
▼
[8] Response Finalization
    ├─ Fire "message.sending" hook
    ├─ Store exchange in memory
    ├─ Update session context
    └─ Pass response to channel router
│
▼
[9] Channel Extension
    ├─ formatOutbound() → platform-specific format
    └─ Send via platform API
│
▼
User receives response
```

### 17.2 Plugin Lifecycle Flow

```
Platform Boot
│
▼
[1] Discovery Phase
    ├─ Scan bundled extensions (extensions/)
    ├─ Scan local plugins (~/.openclaw/plugins/)
    └─ Scan npm packages (openclaw-plugin keyword)
    │
    ▼ Manifest list
│
▼
[2] Validation Phase
    ├─ For each manifest:
    │   ├─ Validate schema
    │   ├─ Check version compatibility
    │   └─ Verify permission declarations
    ├─ Resolve dependency graph
    └─ Topological sort for load order
    │
    ▼ Validated, ordered manifest list
│
▼
[3] Loading Phase (sequential within dependency chains)
    ├─ Dynamic import(entryPoint)
    ├─ Call plugin.initialize(config)
    └─ Handle errors (skip + warn on failure)
    │
    ▼ Initialized plugin instances
│
▼
[4] Registration Phase
    ├─ Register tools → Tool Registry
    ├─ Register hooks → Hook Engine (ordered by priority)
    ├─ Register services → Service Manager
    ├─ Register HTTP routes → Express router
    └─ Register memory provider → Memory slot (if applicable)
    │
    ▼ Plugin ready
│
▼
[5] Runtime
    ├─ Tools invoked by LLM as needed
    ├─ Hooks fire on matching events
    ├─ Services run in background
    └─ HTTP routes serve requests
│
▼
[6] Shutdown
    ├─ plugin.shutdown() called in reverse load order
    ├─ Services stopped
    ├─ Routes unmounted
    └─ Hooks deregistered
```

### 17.3 Memory Search Flow

```
Search Query
│
▼
[1] Query Analysis
    ├─ Tokenize query
    ├─ Detect intent (keyword vs. semantic vs. hybrid)
    └─ (Optional) LLM query expansion
         └─ Generate 3-5 related search terms
│
▼
[2] Parallel Search Execution
    │
    ├──► FTS5 BM25 Search
    │    ├─ Tokenize query terms
    │    ├─ Match against FTS5 index
    │    ├─ Score with BM25 (term freq × inverse doc freq)
    │    └─ Return top-N with BM25 scores
    │
    └──► Vector Similarity Search
         ├─ Embed query text → float32 vector
         ├─ sqlite-vec cosine distance search
         └─ Return top-N with cosine scores
│
▼
[3] Score Fusion
    ├─ Normalize BM25 scores to [0,1]
    ├─ Normalize cosine scores to [0,1]
    ├─ Fused score = α·BM25 + β·cosine
    └─ Apply temporal decay: score *= decay^(age_days)
│
▼
[4] MMR Re-ranking
    ├─ Initialize selected = {}
    ├─ For i = 1 to k:
    │   ├─ For each candidate c not in selected:
    │   │   └─ mmr(c) = λ·sim(c, query)
    │   │              - (1-λ)·max(sim(c, s) for s in selected)
    │   └─ Add argmax(mmr) to selected
    └─ Return selected set ordered by insertion
│
▼
[5] Result Formatting
    ├─ Extract content snippets
    ├─ Attach metadata (source, timestamp, session)
    └─ Return ranked result list
```

### 17.4 BDI Cognitive Cycle Flow

```
Environment Event / Heartbeat Timer
│
▼
[PERCEIVE]
├─ Poll message queues (ACL inbox)
├─ Read environmental sensors (channel events, system state)
├─ Retrieve relevant memories
├─ Update Beliefs.md
└─ Log to Observations.md
│
▼
[DELIBERATE]
├─ Load current Desires.md
├─ Evaluate each desire against updated beliefs
│   ├─ Is it still achievable? (feasibility check)
│   ├─ Is it still desirable? (utility assessment)
│   └─ Are there conflicts? (log to Conflicts.md)
├─ Score desires: urgency × importance × feasibility
├─ Select top-priority desires as goals
└─ Promote to Intentions.md
│
▼
[PLAN]
├─ For each new intention:
│   ├─ Check Plan Library for matching templates
│   ├─ Check CBR case base for similar past situations
│   ├─ HTN decompose goal into primitive tasks
│   └─ Write plan steps to Plans.md
├─ If no plan found:
│   └─ Meta-reasoning: select reasoning method → generate plan
└─ Assign plan steps to agents (self or delegate via ACL)
│
▼
[ACT]
├─ Execute next plan step:
│   ├─ Tool invocation (via OpenClaw tool registry)
│   ├─ ACL message send (delegate to other agent)
│   ├─ Workflow trigger (BPMN process start)
│   └─ Information query (memory search / TypeDB query)
├─ Record step outcome
└─ Check for plan failure → replan if needed
│
▼
[LEARN]
├─ Update beliefs based on action outcomes
├─ Store case in CBR case base (situation → plan → outcome)
├─ Update plan success/failure metrics
├─ Write to Reflections.md
└─ Prune completed intentions from Intentions.md
│
▼
Return to [PERCEIVE] on next heartbeat
```

---

## 18. Technology Stack

### 18.1 Runtime and Language

| Component   | Technology | Version | Purpose                      |
| ----------- | ---------- | ------- | ---------------------------- |
| Language    | TypeScript | 5.x     | Entire codebase              |
| Runtime     | Node.js    | 20+ LTS | Server execution environment |
| Package Mgr | pnpm       | 9.x     | Workspace management         |

### 18.2 Server and API

| Component   | Package     | Version | Purpose                          |
| ----------- | ----------- | ------- | -------------------------------- |
| HTTP Server | express     | 5.2     | REST API, middleware, routing    |
| WebSocket   | ws          | 8.x     | Real-time streaming              |
| CORS        | cors        | latest  | Cross-origin resource sharing    |
| Compression | compression | latest  | gzip/brotli response compression |
| Security    | helmet      | latest  | HTTP security headers            |

### 18.3 AI and Machine Learning

| Component     | Package           | Purpose                                |
| ------------- | ----------------- | -------------------------------------- |
| Anthropic     | @anthropic-ai/sdk | Claude API (primary LLM)               |
| OpenAI SDK    | @ai-sdk/openai    | OpenAI-compatible provider abstraction |
| Token Counter | tiktoken          | Token counting for context management  |

### 18.4 Messaging Platform SDKs

| Platform | Package                 | Protocol         |
| -------- | ----------------------- | ---------------- |
| Slack    | @slack/web-api          | REST + WebSocket |
| Discord  | discord.js              | Gateway + REST   |
| Telegram | node-telegram-bot-api   | HTTP Long Poll   |
| WhatsApp | @whiskeysockets/baileys | WebSocket (WA)   |
| LINE     | @line/bot-sdk           | Webhook + REST   |
| Matrix   | matrix-js-sdk           | REST + Sync      |
| Signal   | signal-client           | Signal Protocol  |
| Nostr    | nostr-tools             | WebSocket Relays |

### 18.5 Database and Storage

| Component       | Package           | Purpose                         |
| --------------- | ----------------- | ------------------------------- |
| SQLite          | better-sqlite3    | Primary storage (sync, fast)    |
| Vector Search   | sqlite-vec        | Cosine similarity on embeddings |
| Full-Text       | FTS5 (SQLite ext) | BM25 keyword search             |
| Knowledge Graph | typedb-driver     | Optional TypeDB integration     |
| ORM             | drizzle-orm       | Type-safe database queries      |
| Vector DB       | LanceDB           | Optional vector storage backend |

### 18.6 Browser Automation

| Component  | Package         | Purpose                     |
| ---------- | --------------- | --------------------------- |
| Automation | playwright-core | Web page interaction        |
| Image Proc | sharp           | Screenshot/image processing |

### 18.7 Build and Development

| Component     | Package    | Purpose                          |
| ------------- | ---------- | -------------------------------- |
| Bundler       | tsdown     | TypeScript bundling              |
| Type Checker  | typescript | Static type checking             |
| Test Runner   | vitest     | Unit and integration testing     |
| Linter        | eslint     | Code quality                     |
| File Watcher  | chokidar 5 | Config and file change detection |
| Logger        | pino       | Structured JSON logging          |
| CLI Framework | commander  | CLI argument parsing             |
| Env Config    | dotenv     | Environment variable loading     |

### 18.8 Native Applications

| Platform | Technology                | Purpose                    |
| -------- | ------------------------- | -------------------------- |
| iOS      | Swift / SwiftUI           | Native iOS companion app   |
| Android  | Kotlin                    | Native Android app         |
| macOS    | AppKit / SwiftUI          | Native macOS app           |
| Shared   | TypeScript (React Native) | Cross-platform shared code |
| Bridge   | Capacitor / Expo          | Native bridge layer        |

---

## 19. Build, Test, and Development Workflow

### 19.1 Monorepo Structure

The project uses **pnpm workspaces** to manage the monorepo:

```
Workspaces:
  - src/              → openclaw (core platform)
  - extensions/*      → individual extension packages
  - mabos/            → MABOS runtime
  - apps/*            → native companion apps
  - packages/*        → shared internal packages
```

### 19.2 Build Pipeline

```
Source (TypeScript)
│
├──► tsdown (bundling)
│    ├─ Tree-shaking
│    ├─ Code splitting
│    ├─ Source maps
│    └─ Output: dist/
│
├──► tsc (type checking)
│    ├─ Type validation (no emit)
│    └─ Declaration generation (.d.ts)
│
└──► Output
     ├─ dist/openclaw      (core binary)
     ├─ dist/mabos          (MABOS binary)
     └─ dist/extensions/*   (bundled extensions)
```

### 19.3 Testing Strategy

| Test Type   | Tool   | Scope                                         |
| ----------- | ------ | --------------------------------------------- |
| Unit        | vitest | Individual functions, modules                 |
| Integration | vitest | Module interactions, API endpoints            |
| Extension   | vitest | Plugin contract compliance                    |
| E2E         | vitest | Full request lifecycle (with mocked channels) |

Test execution:

```bash
pnpm test              # Run all tests
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests
pnpm test:e2e          # End-to-end tests
pnpm test:coverage     # With coverage reporting
```

### 19.4 Development Workflow

```
1. Clone repository
2. pnpm install                    # Install all dependencies
3. cp .env.example .env            # Configure environment
4. pnpm dev                        # Start in development mode
                                   # (hot-reload via chokidar)
5. pnpm test --watch               # Tests in watch mode
6. pnpm lint                       # Lint check
7. pnpm build                      # Production build
```

### 19.5 CI/CD

The project includes 40+ npm scripts covering:

- Cross-platform builds (Node.js, iOS, Android, macOS).
- Test suites with coverage thresholds.
- Linting and formatting checks.
- Docker image builds for all three deployment modes.
- Extension packaging and publishing.
- Database migration verification.

---

## 20. Deployment Architecture

### 20.1 Deployment Modes

```
┌───────────────────────────────────────────────────────────────────┐
│                     Deployment Options                             │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │   Self-Hosted     │  │   Docker          │  │   Cloud         │  │
│  │                   │  │                   │  │                 │  │
│  │  Node.js direct   │  │  3 image variants │  │  Fly.io         │  │
│  │  systemd / PM2    │  │  Standard         │  │  Render         │  │
│  │                   │  │  Sandbox          │  │  Any Docker     │  │
│  │  Full control     │  │  Sandbox+Browser  │  │  host           │  │
│  └──────────────────┘  └──────────────────┘  └────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### 20.2 Docker Deployment

Three Dockerfiles for different security postures:

**`Dockerfile` — Standard:**

```
FROM node:20-slim
WORKDIR /app
COPY dist/ .
EXPOSE 18789
CMD ["node", "openclaw"]
```

- Minimal image (~150MB).
- No additional isolation beyond container boundaries.
- Suitable for trusted environments.

**`Dockerfile.sandbox` — Sandboxed:**

- Adds OS-level sandboxing (seccomp profiles, AppArmor).
- Read-only root filesystem.
- Dropped capabilities.
- Non-root user execution.
- Suitable for production deployments with untrusted tool execution.

**`Dockerfile.sandbox-browser` — Sandbox + Browser:**

- All sandbox protections.
- Playwright and Chromium installed.
- Browser runs in headless mode within the container.
- Additional network isolation for browser processes.
- Suitable for deployments requiring web automation.

### 20.3 Cloud Deployment

**Fly.io:**

```
┌─────────────────────────┐
│   Fly.io Infrastructure  │
│                          │
│  ┌─────────┐  ┌────────┐│
│  │ OpenClaw│  │ Volume  ││
│  │ Machine │──│ (SQLite)││
│  │         │  │         ││
│  └─────────┘  └────────┘│
│                          │
│  Auto-scaling            │
│  Global edge routing     │
│  Persistent volumes      │
└─────────────────────────┘
```

**Render:**

- Web service deployment with persistent disk.
- Auto-deploy from Git.
- Built-in TLS termination.

### 20.4 Self-Hosted

For direct Node.js deployment:

```bash
# Install
npm install -g openclaw

# Configure
openclaw init

# Run with systemd
sudo systemctl enable openclaw
sudo systemctl start openclaw

# Or with PM2
pm2 start openclaw --name "openclaw-gateway"
pm2 save
pm2 startup
```

### 20.5 Networking

```
Internet
│
├──► Reverse Proxy (nginx/Caddy/Cloudflare Tunnel)
│    ├─ TLS termination
│    ├─ Rate limiting
│    └─ WebSocket upgrade handling
│
├──► OpenClaw Gateway (:18789)
│    ├─ REST API
│    ├─ WebSocket
│    └─ Channel webhooks
│
├──► (Optional) TypeDB (:1729)
│    └─ Knowledge graph queries
│
└──► (Optional) Tailscale mesh
     └─ Zero-config networking between devices
```

### 20.6 Reference Deployment — VividWalls MAS

The VividWalls reference deployment illustrates the full production stack:

```
┌──────────────────────────────────────────────────────────────┐
│                    VividWalls MAS Architecture                 │
│                                                               │
│  ┌──────────────────┐                                         │
│  │  React 19 + Vite │  (Dashboard UI)                         │
│  │  Dashboard        │                                         │
│  └────────┬─────────┘                                         │
│           │ HTTP/WS                                            │
│  ┌────────▼─────────┐                                         │
│  │  MABOS Extension  │  (BDI cognitive agents)                 │
│  │  99 tools          │                                         │
│  │  21 modules        │                                         │
│  └────────┬─────────┘                                         │
│           │ Plugin API                                         │
│  ┌────────▼─────────┐                                         │
│  │  OpenClaw Gateway │  (API server, auth, sessions)           │
│  │  Port 18789       │                                         │
│  └────────┬─────────┘                                         │
│           │ TypeQL                                              │
│  ┌────────▼─────────┐                                         │
│  │  TypeDB           │  (Knowledge graph, persistent facts)    │
│  │  Port 1729        │                                         │
│  └──────────────────┘                                         │
│                                                               │
│  Multi-Agent Roles:                                           │
│  ├─ Market Research Agent                                     │
│  ├─ Product Design Agent                                      │
│  ├─ Customer Service Agent                                    │
│  ├─ Inventory Management Agent                                │
│  └─ Analytics & Reporting Agent                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 21. Subsystem Deep-Dive References

This document provides a platform-wide architectural overview. For detailed subsystem documentation, consult the following companion documents:

### Memory and Knowledge System

**File:** `docs/plans/2026-02-24-memory-system-architecture.md`

Covers in depth:

- Hybrid search algorithm details and tuning parameters.
- Embedding provider benchmarks and selection criteria.
- FTS5 tokenizer configuration.
- sqlite-vec index construction and query optimization.
- RLM (Recursive Learning Memory) enhancement specifications.
- Memory consolidation pipeline design.
- Hierarchical memory index (daily/weekly/monthly/quarterly) format.
- Context-aware pre-compaction compression strategy.
- Memory encryption implementation details.
- Migration paths between memory providers.

### BDI + SBVR Multi-Agent Framework

**File:** `docs/plans/2026-02-24-bdi-sbvr-multiagent-framework.md`

Covers in depth:

- BDI cognitive cycle formal specification.
- SBVR ontology schema (all 10 domains).
- SPO Fact Store data model and query language.
- Rule Engine execution semantics (forward chaining, constraint propagation).
- Inference Engine implementation (forward, backward, abductive).
- HTN planning algorithm and decomposition rules.
- Plan Library format and retrieval mechanism.
- CBR-BDI case representation and similarity metrics.
- ACL message format specification.
- Contract Net Protocol state machine.
- BPMN 2.0 workflow engine internals.
- Reasoning method catalog (all 35 methods).
- Meta-reasoning router decision logic.
- TypeDB schema design and query patterns.
- Agent coordination protocols.

---

## Appendix A — Configuration Reference

### A.1 Core Configuration

| Key                         | Type    | Default         | Description                    |
| --------------------------- | ------- | --------------- | ------------------------------ |
| `gateway.port`              | number  | 18789           | Gateway listen port            |
| `gateway.host`              | string  | "0.0.0.0"       | Gateway bind address           |
| `auth.strategy`             | string  | "token"         | Authentication method          |
| `auth.token`                | string  | (generated)     | Bearer token for API access    |
| `llm.provider`              | string  | "anthropic"     | Primary LLM provider           |
| `llm.model`                 | string  | "claude-sonnet" | Default model                  |
| `memory.provider`           | string  | "memory-core"   | Active memory extension        |
| `memory.embedding.provider` | string  | "openai"        | Embedding provider             |
| `memory.search.alpha`       | number  | 0.3             | BM25 weight in hybrid search   |
| `memory.search.beta`        | number  | 0.7             | Cosine weight in hybrid search |
| `memory.search.top_k`       | number  | 10              | Number of search results       |
| `memory.search.mmr_lambda`  | number  | 0.7             | MMR diversity parameter        |
| `memory.encryption`         | boolean | false           | Encrypt memory at rest         |
| `sandbox.enabled`           | boolean | true            | Enable sandboxed execution     |
| `sandbox.approval`          | boolean | true            | Require approval for exec      |
| `plugins.autoload`          | boolean | true            | Auto-discover and load plugins |
| `cron.enabled`              | boolean | true            | Enable scheduled tasks         |
| `logging.level`             | string  | "info"          | Log level (pino)               |

### A.2 MABOS Configuration

| Key                              | Type     | Default     | Description                       |
| -------------------------------- | -------- | ----------- | --------------------------------- |
| `mabos.enabled`                  | boolean  | true        | Enable MABOS extension            |
| `mabos.heartbeat.interval`       | number   | 60000       | BDI heartbeat interval (ms)       |
| `mabos.intention.timeout`        | number   | 86400000    | Stale intention timeout (ms, 24h) |
| `mabos.typedb.enabled`           | boolean  | false       | Enable TypeDB integration         |
| `mabos.typedb.host`              | string   | "localhost" | TypeDB server host                |
| `mabos.typedb.port`              | number   | 1729        | TypeDB server port                |
| `mabos.ontology.domains`         | string[] | (all 10)    | Active SBVR ontology domains      |
| `mabos.reasoning.default`        | string   | "auto"      | Default reasoning strategy        |
| `mabos.planning.max_depth`       | number   | 5           | Max HTN decomposition depth       |
| `mabos.cbr.similarity_threshold` | number   | 0.7         | Min similarity for case retrieval |
| `mabos.acl.timeout`              | number   | 30000       | ACL message response timeout (ms) |

### A.3 Environment Variables

| Variable              | Description                            |
| --------------------- | -------------------------------------- |
| `OPENCLAW_CONFIG`     | Path to configuration file             |
| `OPENCLAW_PORT`       | Override gateway port                  |
| `OPENCLAW_AUTH_TOKEN` | Override auth token                    |
| `ANTHROPIC_API_KEY`   | Anthropic API key                      |
| `OPENAI_API_KEY`      | OpenAI API key (for embeddings/compat) |
| `GOOGLE_AI_API_KEY`   | Google AI API key                      |
| `VOYAGE_API_KEY`      | Voyage AI API key                      |
| `TYPEDB_URI`          | TypeDB connection URI                  |
| `TAILSCALE_AUTH`      | Tailscale authentication setting       |
| `NODE_ENV`            | Runtime environment (production/dev)   |

---

## Appendix B — Glossary

| Term           | Definition                                                                                |
| -------------- | ----------------------------------------------------------------------------------------- |
| **ACL**        | Agent Communication Language — structured message format for inter-agent communication    |
| **BDI**        | Belief-Desire-Intention — cognitive architecture for rational agents                      |
| **BM25**       | Best Match 25 — probabilistic ranking function for keyword search                         |
| **BPMN**       | Business Process Model and Notation — standard for business process diagrams              |
| **CBR**        | Case-Based Reasoning — solving problems by adapting past solutions                        |
| **CFP**        | Call for Proposals — initial message in the Contract Net Protocol                         |
| **FTS5**       | Full-Text Search version 5 — SQLite full-text search extension                            |
| **HTN**        | Hierarchical Task Network — planning method that decomposes tasks into subtasks           |
| **MABOS**      | Multi-Agent Business Operating System — the cognitive extension for OpenClaw              |
| **MCP**        | Model Context Protocol — standard for connecting AI models to external tools              |
| **MMR**        | Maximal Marginal Relevance — re-ranking method that balances relevance and diversity      |
| **RLM**        | Recursive Learning Memory — planned enhancement suite for the memory subsystem            |
| **SBVR**       | Semantics of Business Vocabulary and Business Rules — OMG standard for business semantics |
| **SPO**        | Subject-Predicate-Object — triple format for knowledge representation                     |
| **TypeDB**     | Strongly-typed knowledge graph database (formerly Grakn)                                  |
| **TypeQL**     | TypeDB's query language                                                                   |
| **sqlite-vec** | SQLite extension for vector similarity search                                             |

---

_This document is maintained alongside the OpenClaw-MABOS codebase. For the latest version, see the repository root. For subsystem-specific details, consult the referenced deep-dive documents in `docs/plans/`._

_Last updated: 2026-02-24 | Platform version: 2026.2.22_
