# OpenClaw Configuration Guide

## Configuration File Format

OpenClaw uses YAML for configuration. All configuration options support environment variable substitution using `${VAR_NAME}` syntax.

## Top-Level Sections

### Gateway

HTTP and WebSocket server configuration.

```yaml
gateway:
  enabled: true                    # Enable/disable Gateway server
  host: "127.0.0.1"               # Bind host (use 0.0.0.0 for all interfaces)
  http_port: 8080                 # HTTP API port
  ws_port: 8081                   # WebSocket port
  bearer_token: "${GATEWAY_TOKEN}" # Bearer token for authentication
  password: "secret"              # Alternative password authentication
```

**Authentication Priority**: `bearer_token` > `password` > local (127.0.0.1)

### Models

AI model provider configurations.

```yaml
models:
  providers:
    # Anthropic (Claude)
    anthropic:
      api_key: "${ANTHROPIC_API_KEY}"
      base_url: "https://api.anthropic.com"  # Optional

    # OpenAI (GPT)
    openai:
      api_key: "${OPENAI_API_KEY}"
      base_url: "https://api.openai.com/v1"  # Optional

    # LiteLLM (other providers)
    litellm:
      enabled: true
      providers:
        - name: "ollama"
          base_url: "http://localhost:11434"
```

**Supported Models**:
- Claude: `claude-3-5-sonnet-20241022`, `claude-3-opus-4-20250514`, etc.
- OpenAI: `gpt-4`, `gpt-3.5-turbo`, etc.
- LiteLLM: Any model supported by LiteLLM

### Agents

Agent configurations define AI assistants.

```yaml
agents:
  - id: "default"                           # Unique agent ID (lowercase, alphanumeric)
    default: true                           # Mark as default agent
    name: "My Assistant"                    # Display name
    model: "claude-3-5-sonnet-20241022"    # Model to use
    workspace: "~/openclaw/workspace"       # Optional workspace directory
    dm_scope: "main"                        # DM session scope (see below)
    skills: []                              # Optional skills list
```

**DM Scope Options**:
- `main`: Single session for all DMs
- `per-peer`: Separate session per user
- `per-channel-peer`: Separate session per platform + user
- `per-account-channel-peer`: Separate session per bot + platform + user

### Bindings

Route messages to specific agents based on rules.

```yaml
bindings:
  # Bind by channel
  - agent_id: "helper"
    match:
      channel: "telegram"

  # Bind by account
  - agent_id: "support"
    match:
      channel: "telegram"
      account_id: "support_bot"

  # Bind by peer (user)
  - agent_id: "specialist"
    match:
      channel: "telegram"
      peer:
        kind: "user"    # or "group", "channel"
        id: "123456789"

  # Bind by guild (Discord)
  - agent_id: "community"
    match:
      channel: "discord"
      guild_id: "987654321"

  # Bind by team (Slack)
  - agent_id: "workspace"
    match:
      channel: "slack"
      team_id: "T123456"
```

**Matching Priority** (highest to lowest):
1. Peer (specific user/group/channel)
2. Parent peer (for threads)
3. Guild (Discord servers)
4. Team (Slack workspaces)
5. Account (specific bot)
6. Channel (platform)
7. Default agent

### Telegram

Telegram bot configuration.

#### Single Account

```yaml
telegram:
  enabled: true
  token: "${TELEGRAM_BOT_TOKEN}"
  webhook_enabled: false
  webhook_url: "https://your-domain.com/telegram/webhook"
  webhook_secret: "your-secret"
  allowed_updates: ["message", "edited_message", "callback_query"]
```

#### Multiple Accounts

```yaml
telegram:
  enabled: true
  accounts:
    - id: "main_bot"
      token: "${TELEGRAM_MAIN_TOKEN}"
      webhook_enabled: false

    - id: "support_bot"
      token: "${TELEGRAM_SUPPORT_TOKEN}"
      webhook_enabled: true
      webhook_url: "https://your-domain.com/telegram/support/webhook"
```

**Webhook vs Polling**:
- Polling (default): Bot actively checks for updates
- Webhook: Telegram sends updates to your server (requires HTTPS)

### Logging

Logging configuration.

```yaml
logging:
  console_level: "info"              # debug, info, warn, error, silent
  file_enabled: true                 # Enable file logging
  file_path: "~/.openclaw/logs/openclaw.log"
  file_level: "debug"               # File log level
  rotation: "100 MB"                # Log rotation size
  retention: "1 week"               # Log retention period
```

## Environment Variables

OpenClaw supports environment variable substitution in config files:

```yaml
# In config file
telegram:
  token: "${TELEGRAM_BOT_TOKEN}"

# In shell
export TELEGRAM_BOT_TOKEN="123456789:ABCdefGHI..."
```

**Common Environment Variables**:
- `ANTHROPIC_API_KEY`: Anthropic API key
- `OPENAI_API_KEY`: OpenAI API key
- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `GATEWAY_TOKEN`: Gateway bearer token

## Configuration Validation

Validate your configuration:

```bash
# Show current config
openclaw config show

# Validate config
openclaw health

# Check for errors
openclaw health --verbose
```

## Best Practices

### Security

1. **Never commit secrets** to version control
2. **Use environment variables** for sensitive data
3. **Set file permissions**: `chmod 600 ~/.openclaw/config.yaml`
4. **Use bearer tokens** for Gateway authentication

### Performance

1. **Use appropriate dm_scope**: `per-peer` for personalization, `main` for shared context
2. **Enable file logging** for production
3. **Use webhook mode** for Telegram in production (lower latency)

### Organization

1. **Use multiple agents** for different purposes
2. **Use bindings** to route messages intelligently
3. **Group related settings** in separate config files (via includes)

## Advanced Configuration

### Identity Linking

Link user identities across platforms:

```yaml
identity_links:
  - canonical_id: "user@example.com"
    identities:
      - channel: "telegram"
        peer_id: "123456789"
      - channel: "discord"
        peer_id: "987654321"
```

### Custom Workspace

Configure agent workspace:

```yaml
agents:
  - id: "developer"
    workspace: "/path/to/project"
    # Agent will have access to files in this directory
```

### Skills

Enable custom skills:

```yaml
agents:
  - id: "helper"
    skills:
      - "bash"
      - "file_operations"
      - "web_search"
```

## Example Configurations

See the `examples/` directory for complete examples:
- `openclaw.example.yaml`: Full configuration with all options
- `telegram-single.yaml`: Single Telegram bot setup
- `telegram-multi.yaml`: Multiple Telegram bots with routing
