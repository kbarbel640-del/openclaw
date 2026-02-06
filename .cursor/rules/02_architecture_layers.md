# Architecture Layers

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTS                                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │   TUI   │  │ Mac App │  │  Nodes  │  │ Messaging       │ │
│  │         │  │         │  │ iOS/And │  │ WhatsApp/TG/etc │ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └───────┬─────────┘ │
└───────┼────────────┼────────────┼───────────────┼───────────┘
        │            │            │               │
        └────────────┴────────────┴───────────────┘
                           │
                    WebSocket / HTTP
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      GATEWAY                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Auth/Pairing │  │   Protocol   │  │ Startup          │   │
│  │              │  │   Handler    │  │ Validation       │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Channels   │  │   Sessions   │  │ Config Loader    │   │
│  │   Manager    │  │   Store      │  │                  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AGENT RUNTIME                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Model        │  │ Auth Profile │  │ Tool             │   │
│  │ Selection    │  │ Resolution   │  │ Execution        │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Session      │  │ Compaction   │  │ Bootstrap        │   │
│  │ Management   │  │ Engine       │  │ Files            │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   MODEL PROVIDERS                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Ollama       │  │ LM Studio    │  │ Anthropic        │   │
│  │ (local)      │  │ (local)      │  │ (hosted)         │   │
│  │ auth: none   │  │ auth: none   │  │ auth: api-key    │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ OpenAI       │  │ Moonshot     │  │ Bedrock          │   │
│  │ (hosted)     │  │ (Kimi)       │  │ (AWS)            │   │
│  │ auth: api-key│  │ auth: api-key│  │ auth: aws-sdk    │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Layer Contracts

### 1. Clients Layer

**Responsibilities:**
- Connect to Gateway over WebSocket
- Send requests (chat, agent, health)
- Receive events (streaming, presence, tick)
- Display results to users

**What it knows:**
- Gateway URL and auth token
- Current session key
- User input

**What it must NOT know:**
- How models are selected
- Provider credentials
- Other users' sessions

### 2. Gateway Layer

**Responsibilities:**
- Accept WebSocket connections
- Validate auth (token or password)
- Route requests to Agent Runtime
- Manage channel connections (WhatsApp, etc.)
- Persist sessions and config

**Inputs:**
- WebSocket frames (JSON)
- HTTP requests (tools invoke, health)
- Channel messages (WhatsApp, Telegram, etc.)

**Outputs:**
- WebSocket responses and events
- HTTP responses
- Channel replies

**What it knows:**
- All connected clients
- All channel credentials
- Current configuration
- Session state

**What it must NOT know:**
- Model inference internals
- Provider-specific auth flows
- Tool implementation details

**Invariants:**
- Exactly one Gateway per host
- Must validate startup before accepting connections
- Must fail-fast if agent cannot respond

### 3. Agent Runtime Layer

**Responsibilities:**
- Resolve model from configuration
- Resolve auth for provider
- Execute inference loop
- Manage context window
- Execute tools

**Inputs:**
- Message + session context
- Resolved model ref
- Agent configuration

**Outputs:**
- Response text
- Tool calls
- Usage metrics

**What it knows:**
- Current model and provider
- Auth credentials (resolved)
- Session transcript
- Available tools

**What it must NOT know:**
- How messages arrive (channel agnostic)
- Client identity
- Gateway topology

**Invariants:**
- Context window must be >= 16000 tokens
- Auth must be resolved before inference
- Tool calls must be validated against policy

### 4. Model Providers Layer

**Responsibilities:**
- Accept inference requests
- Return completions
- Report capabilities (context window, tools support)

**Inputs:**
- Messages array
- Model parameters
- API credentials (if required)

**Outputs:**
- Completion text
- Tool calls (if supported)
- Usage data

**What it knows:**
- Its own capabilities
- Its own auth requirements

**What it must NOT know:**
- Why it was selected
- What other providers exist
- Session history beyond current request

**Auth Modes:**
- `none`: Local provider, no credentials needed
- `api-key`: Bearer token in header
- `aws-sdk`: IAM credentials from environment
- `oauth`: Token from auth profile store
- `token`: Setup token (Anthropic)

## Data Flow: Message to Response

```
User Message (WhatsApp)
        │
        ▼
Gateway (validates, routes)
        │
        ▼
Agent Runtime (resolves model, auth)
        │
        ▼
Provider (inference)
        │
        ▼
Agent Runtime (tool calls if needed)
        │
        ▼
Gateway (formats response)
        │
        ▼
User (WhatsApp reply)
```

## Future: Spine Layer (Phase 3+)

Not yet implemented. Will sit between Gateway and Agent Runtime to provide:
- Persistent memory
- Cross-session context
- Entity extraction storage
- Workflow state
