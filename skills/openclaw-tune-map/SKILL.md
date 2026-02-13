---
name: openclaw-tune-map
description: "Navigate and modify OpenClaw configuration via the tune CLI. Full config tree reference and common recipes."
---

# OpenClaw Tune Map

The `openclaw tune` command is a schema-driven config navigator. It walks the Zod schema directly — zero hardcoded paths, every config change auto-propagated.

## Quick Start

```bash
openclaw tune                          # Show all config namespaces
openclaw tune <namespace>              # Drill into a namespace
openclaw tune <path...>                # Show leaf value + type + options
openclaw tune <path...> <value>        # Set a value (validates, atomic write)
openclaw tune --json <path...>         # Machine-readable JSON output
openclaw tune <path...> <value> --restart  # Set + restart gateway
```

## Config Tree (depth 2)

```
├── agents                    Agent definitions and defaults
│   ├── defaults              Default settings for all agents
│   └── list                  Array of agent definitions
├── approvals                 Approval workflow settings
│   └── exec                  Exec approval settings
├── audio                     Audio processing settings
│   └── transcription         Audio transcription settings
├── auth                      Authentication profiles
│   ├── profiles              Auth provider profiles
│   ├── order                 Provider priority order
│   └── cooldowns             Rate limiting and backoff
├── bindings                  Agent-channel bindings (array)
├── broadcast                 Broadcast messaging
├── browser                   Browser control settings
│   ├── profiles              Browser profile definitions
│   └── snapshotDefaults      Snapshot behavior
├── canvasHost                Canvas presentation server
├── channels                  Channel provider settings
│   ├── defaults              Default channel settings
│   ├── whatsapp              WhatsApp settings
│   ├── telegram              Telegram settings
│   ├── discord               Discord settings
│   ├── signal                Signal settings
│   ├── slack                 Slack settings
│   ├── irc                   IRC settings
│   ├── googlechat            Google Chat settings
│   ├── imessage              iMessage settings
│   ├── bluebubbles           BlueBubbles settings
│   └── msteams               MS Teams settings
├── commands                  Command handling
├── cron                      Scheduled task settings
├── diagnostics               Observability settings
│   ├── otel                  OpenTelemetry config
│   └── cacheTrace            Cache trace logging
├── discovery                 Service discovery
│   ├── wideArea              Wide area discovery
│   └── mdns                  mDNS settings
├── env                       Environment variables
│   ├── shellEnv              Shell environment
│   └── vars                  Static variables
├── gateway                   Gateway server settings
│   ├── port                  Listen port (default: 18789)
│   ├── bind                  Network binding
│   ├── mode                  local/remote
│   ├── auth                  Authentication
│   ├── reload                Hot-reload settings
│   ├── tls                   TLS configuration
│   ├── http                  HTTP endpoint settings
│   ├── nodes                 Node management
│   ├── controlUi             Control UI settings
│   ├── tailscale             Tailscale integration
│   └── remote                Remote gateway
├── hooks                     Webhook settings
│   ├── mappings              URL mappings
│   ├── gmail                 Gmail integration
│   └── internal              Internal hooks
├── logging                   Logging configuration
├── media                     Media handling
├── memory                    Memory backend settings
│   └── qmd                   QMD memory config
├── messages                  Message handling
│   ├── queue                 Queue mode and debounce
│   ├── tts                   Text-to-speech
│   ├── inbound               Inbound handling
│   └── groupChat             Group chat settings
├── meta                      Config metadata
├── models                    AI model providers
│   ├── providers             Provider definitions
│   └── bedrockDiscovery      AWS Bedrock auto-discovery
├── nodeHost                  Node host settings
├── plugins                   Plugin management
│   ├── entries               Plugin configs
│   ├── installs              Installed plugins
│   └── slots                 Plugin slots
├── session                   Session management
│   ├── reset                 Reset configuration
│   ├── sendPolicy            Send policy rules
│   └── maintenance           Session maintenance
├── skills                    Skills configuration
│   ├── entries               Skill configs
│   ├── load                  Skill loading
│   └── install               Install preferences
├── talk                      Voice call settings
├── tools                     Global tool config
│   ├── web                   Web tools (search, fetch)
│   ├── media                 Media understanding
│   ├── links                 Link processing
│   ├── exec                  Exec settings
│   ├── agentToAgent          A2A messaging
│   ├── elevated              Elevated permissions
│   └── message               Message tool
├── ui                        UI settings
│   └── assistant             Assistant identity
├── update                    Auto-update settings
├── web                       WebSocket client
│   └── reconnect             Reconnection settings
└── wizard                    Setup wizard state
```

## Common Recipes

### 1. Swap the default model

```bash
openclaw tune agents defaults model primary "juice/claude-opus-4-6"
```

### 2. Add a model fallback

```bash
openclaw tune agents defaults model fallbacks '["juice/claude-sonnet-4-5","juice/gpt-5.3-codex"]'
```

### 3. Change gateway port

```bash
openclaw tune gateway port 47777 --restart
```

### 4. Set logging level

```bash
openclaw tune logging level debug
openclaw tune logging consoleStyle compact
```

### 5. Enable/disable A2A messaging

```bash
openclaw tune tools agentToAgent enabled true
openclaw tune tools agentToAgent allow '["eva","guga","omni"]'
```

### 6. Change heartbeat interval

```bash
openclaw tune agents defaults heartbeat every "30m"
```

### 7. Set thinking default

```bash
openclaw tune agents defaults thinkingDefault medium
```

### 8. Enable web search

```bash
openclaw tune tools web search enabled true
openclaw tune tools web search provider brave
```

### 9. Change message queue mode

```bash
openclaw tune messages queue mode steer
```

### 10. Set gateway bind address

```bash
openclaw tune gateway bind lan
# Options: auto | lan | loopback | custom | tailnet
```

### 11. Configure exec tool security

```bash
openclaw tune tools exec security full
# Options: deny | allowlist | full
```

### 12. Enable cron scheduler

```bash
openclaw tune cron enabled true
openclaw tune cron maxConcurrentRuns 3
```

## Tips

- **Hot vs Restart:** Changes to `agents.*`, `models.*`, `tools.*`, `messages.*` are usually hot-reloadable. Changes to `gateway.*` (port, bind, TLS) usually need restart.
- **Use `--json`** for machine-readable output that agents can parse.
- **Piped output** automatically strips ANSI colors.
- **Unknown paths** show suggestions — you never need to memorize paths.
- **Schema-driven:** When OpenClaw adds new config options, `tune` picks them up automatically.
- **Atomic writes:** Every `tune set` creates a `.bak` backup before writing.
- **Works offline:** `tune` reads the Zod schema directly, no gateway connection needed.
