---
summary: "Complete guide to using OpenClaw with GitHub Copilot SDK integration"
read_when:
  - You're new to OpenClaw with Copilot SDK
  - You want to understand the complete workflow
  - You need examples for common use cases
---
# Complete Usage Guide: OpenClaw with GitHub Copilot SDK

This comprehensive guide covers everything you need to use OpenClaw with GitHub Copilot SDK integration, from installation to advanced workflows.

## Table of Contents

1. [Initial Setup](#initial-setup)
2. [Basic Usage](#basic-usage)
3. [Model Management](#model-management)
4. [Configuration](#configuration)
5. [Integration with Messaging Platforms](#integration-with-messaging-platforms)
6. [Advanced Workflows](#advanced-workflows)
7. [Troubleshooting](#troubleshooting)

## Initial Setup

### Prerequisites

- Node.js 22+ installed
- GitHub account with Copilot subscription
- GitHub CLI (`gh`) installed

### Step 1: Install OpenClaw

```bash
npm install -g openclaw
```

Or using the install script:
```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

### Step 2: Install GitHub Copilot CLI

```bash
npm install -g @github/copilot
```

Verify installation:
```bash
gh copilot version
```

### Step 3: Authenticate with GitHub

```bash
# Authenticate GitHub CLI
gh auth login

# Authenticate Copilot CLI
gh copilot auth login
```

### Step 4: Run OpenClaw Onboarding

```bash
openclaw onboard
```

When prompted:
1. Choose **GitHub Copilot** as your provider
2. Select **enable SDK model discovery** when asked
3. Complete the device flow authentication

The onboarding will:
- Create your workspace directory (`~/.openclaw/`)
- Configure auth profiles
- Set up the gateway
- Enable SDK model discovery

### Step 5: Verify Setup

```bash
# Check status
openclaw status

# List available models
openclaw models list | grep github-copilot

# Test the agent
openclaw agent --message "Hello! Can you tell me what you can do?"
```

## Basic Usage

### CLI Agent Mode

**One-off commands**:
```bash
openclaw agent --message "Explain what a closure is in JavaScript"
```

**Interactive mode**:
```bash
openclaw agent --interactive
```

In interactive mode, type your messages and press Enter. Type `exit` to quit.

**With specific model**:
```bash
openclaw agent --model github-copilot/gpt-4o --message "Your question here"
```

**With verbose output** (see what's happening):
```bash
openclaw agent --message "test" --verbose
```

### Gateway Mode (Persistent Service)

Start the gateway to enable persistent sessions and messaging integrations:

```bash
openclaw gateway run
```

The gateway:
- Keeps sessions in memory (faster responses)
- Enables WebChat UI (http://localhost:18789)
- Supports messaging platform integrations
- Handles concurrent requests

**Development mode** (with logging):
```bash
openclaw gateway run --dev
```

**Bind to specific interface**:
```bash
# Localhost only (default)
openclaw gateway run --bind loopback

# LAN access
openclaw gateway run --bind lan

# Custom port
openclaw gateway run --port 8080
```

### WebChat Interface

After starting the gateway:
1. Open http://localhost:18789 in your browser
2. Click "Start Chat"
3. Type your messages in the chat interface

The WebChat UI features:
- Streaming responses
- Code syntax highlighting
- File upload support
- Session history

## Model Management

### Listing Available Models

```bash
# List all models
openclaw models list

# Show Copilot models only
openclaw models list | grep github-copilot

# JSON output
openclaw models list --json
```

### Setting Default Model

```bash
# Set globally
openclaw models set github-copilot/gpt-4o

# Set for specific agent
openclaw models set github-copilot/o1 --agent myagent
```

### Model Status

```bash
# Check current default model
openclaw status

# Show auth status
openclaw status --deep
```

### Switching Models Mid-Conversation

In gateway mode, send a message like:
```
@model github-copilot/gpt-4.1
```

Or in CLI:
```bash
openclaw agent --model github-copilot/gpt-4.1 --message "Your question"
```

### Understanding Model Capabilities

Check what each model can do:

```bash
openclaw models list --json | jq '.[] | select(.id | contains("github-copilot")) | {id, contextWindow, input, reasoning}'
```

Example output:
```json
{
  "id": "github-copilot/gpt-4o",
  "contextWindow": 128000,
  "input": ["text", "image"],
  "reasoning": false
}
{
  "id": "github-copilot/o1",
  "contextWindow": 200000,
  "input": ["text"],
  "reasoning": true
}
```

**Key model types**:

- **GPT-4o**: Best for general tasks, vision support, fast responses
- **GPT-4.1**: Similar to 4o, may have different availability
- **o1**: Advanced reasoning, best for complex problems, math, coding
- **o1-mini**: Faster reasoning model, good for simpler logic tasks
- **Claude Sonnet 4.5**: Available in Business/Enterprise, excellent for writing

## Configuration

### Config File Location

Main config: `~/.openclaw/config.json` or `~/.openclaw/openclaw.json`

For multiple agents: `~/.openclaw/agents/<agent-name>/config.json`

### Basic Configuration

```json5
{
  // Default model
  "agents": {
    "defaults": {
      "model": {
        "primary": "github-copilot/gpt-4o"
      }
    }
  },

  // Enable SDK discovery
  "models": {
    "copilotSdk": {
      "enableModelDiscovery": true
    }
  },

  // Gateway settings
  "gateway": {
    "port": 18789,
    "bind": "loopback",
    "auth": "token"
  }
}
```

### Advanced Configuration

**Multiple Copilot profiles**:
```json5
{
  "agents": {
    "defaults": {
      "authProfiles": {
        "order": ["github-copilot:work", "github-copilot:personal"]
      }
    }
  }
}
```

**Custom model aliases**:
```json5
{
  "agents": {
    "defaults": {
      "models": {
        "github-copilot/gpt-4o": {
          "alias": "smart",
          "enabled": true
        },
        "github-copilot/o1": {
          "alias": "genius",
          "enabled": true
        }
      }
    }
  }
}
```

Now you can use: `@model genius` in messages.

**Rate limiting**:
```json5
{
  "agents": {
    "defaults": {
      "rateLimit": {
        "maxRequestsPerMinute": 10,
        "maxTokensPerMinute": 50000
      }
    }
  }
}
```

### Environment Variables

Set in `~/.profile`, `~/.bashrc`, or your shell config:

```bash
# GitHub token for Copilot
export GITHUB_TOKEN="ghp_..."
export COPILOT_GITHUB_TOKEN="ghp_..."

# Gateway settings
export OPENCLAW_GATEWAY_PORT=8080
export OPENCLAW_GATEWAY_TOKEN="your-secret-token"
```

## Integration with Messaging Platforms

OpenClaw can integrate with various messaging platforms. When combined with Copilot SDK, your agents use your subscription models across all platforms.

### WhatsApp Integration

```bash
# Enable WhatsApp
openclaw channels enable whatsapp

# Scan QR code to link device
openclaw gateway run
```

Once linked, send messages to your WhatsApp number:
- Agent responds using your Copilot models
- Supports images (vision models only)
- Commands: `/help`, `/status`, `/model`

### Telegram Integration

1. Create a bot with @BotFather
2. Get the bot token
3. Configure OpenClaw:

```bash
export TELEGRAM_BOT_TOKEN="your-bot-token"
openclaw channels enable telegram
openclaw gateway run
```

Now your Telegram bot uses Copilot models from your subscription.

### Discord Integration

```bash
# Set up Discord bot
export DISCORD_BOT_TOKEN="your-discord-token"
openclaw channels enable discord
openclaw gateway run
```

Configure bot mentions and channels in config:
```json5
{
  "discord": {
    "mentionPatterns": ["@bot"],
    "channels": ["general", "ai-help"]
  }
}
```

### Slack Integration

```bash
openclaw channels enable slack
# Follow prompts for OAuth setup
```

## Advanced Workflows

### Multi-Agent Setup

Create specialized agents with different models:

```bash
# Create agents
openclaw agents create coder --model github-copilot/o1
openclaw agents create writer --model github-copilot/claude-sonnet-4.5
openclaw agents create helper --model github-copilot/gpt-4o

# Use specific agent
openclaw agent --agent coder --message "Review this code"
openclaw agent --agent writer --message "Write a blog post"
```

### Session Management

**Save and resume sessions**:
```bash
# Start a session
openclaw agent --interactive --session-id research-project

# Later, resume
openclaw agent --interactive --session-id research-project --resume
```

**List sessions**:
```bash
openclaw sessions list
```

**Clear session**:
```bash
openclaw sessions clear research-project
```

### Working with Files

**Attach files to requests**:
```bash
openclaw agent --message "Analyze this" --file document.pdf
```

**Vision models with images**:
```bash
openclaw agent --model github-copilot/gpt-4o --message "What's in this image?" --file photo.jpg
```

**Multiple files**:
```bash
openclaw agent --message "Compare these" --file file1.txt --file file2.txt
```

### Custom Skills Integration

Add custom capabilities (see [Extending with Skills](#extending-with-skills)):

```bash
# Install a skill
clawhub install weather-api

# Use it
openclaw agent --message "What's the weather in San Francisco?"
```

### Memory and Context

OpenClaw maintains conversation context:

```bash
# Enable memory search
{
  "memory": {
    "enabled": true,
    "provider": "local"
  }
}
```

Now the agent can recall previous conversations:
```bash
openclaw agent --message "Remember when we discussed closures?"
```

### Automated Workflows

**Cron jobs with agents**:
```json5
{
  "cron": {
    "jobs": [
      {
        "name": "daily-summary",
        "schedule": "0 9 * * *",
        "agent": "helper",
        "message": "Summarize my tasks for today",
        "deliver": "telegram"
      }
    ]
  }
}
```

## Troubleshooting

### Models Not Discovered

**Check SDK is enabled**:
```bash
grep -A2 copilotSdk ~/.openclaw/config.json
```

Should show:
```json
"copilotSdk": {
  "enableModelDiscovery": true
}
```

**Regenerate models**:
```bash
rm ~/.openclaw/models.json
openclaw gateway run --dev
```

Look for: `Discovered N models from GitHub Copilot subscription`

### Authentication Issues

**Re-authenticate**:
```bash
# GitHub
gh auth login

# Copilot
gh copilot auth logout
gh copilot auth login

# OpenClaw
openclaw models auth login-github-copilot
```

**Verify tokens**:
```bash
gh auth status
openclaw status --deep
```

### Rate Limiting

If you hit rate limits:

1. **Check your plan limits**:
   ```bash
   gh api /user/copilot | jq '.plan'
   ```

2. **Reduce request rate**:
   - Add delays between requests
   - Configure rate limits in config
   - Use o1-mini instead of o1 (faster, lighter)

3. **Check usage**:
   Visit https://github.com/settings/copilot → Usage tab

### Model Not Available

If a model fails:

1. **Verify subscription access**:
   ```bash
   gh copilot explain "test" --model <model-id>
   ```

2. **Check discovered models**:
   ```bash
   openclaw models list | grep <model-id>
   ```

3. **Use fallback model**:
   ```bash
   openclaw models set github-copilot/gpt-4o
   ```

### Performance Issues

**Slow responses**:
- Use gateway mode (keeps sessions warm)
- Prefer GPT-4o over o1 for simple tasks
- Enable caching in config
- Check network latency to GitHub

**High memory usage**:
- Clear old sessions: `openclaw sessions clear --all`
- Reduce context window in config
- Restart gateway: `openclaw gateway restart`

## Best Practices

### Model Selection Strategy

- **General chat**: `github-copilot/gpt-4o` (fast, capable, vision)
- **Complex reasoning**: `github-copilot/o1` (slower but smarter)
- **Quick tasks**: `github-copilot/gpt-4.1` or `o1-mini`
- **Writing**: `github-copilot/claude-sonnet-4.5` (if available)
- **Vision tasks**: Models with `"input": ["text", "image"]`

### Security

- Keep tokens in environment variables, not config files
- Use gateway authentication: `gateway.auth: "token"`
- Review skills before installing
- Run untrusted code in sandboxed mode
- Regularly rotate GitHub tokens

### Cost Management

GitHub Copilot subscription is flat-rate, but:
- Be mindful of API rate limits
- Use appropriate models for task complexity
- Cache responses when possible
- Monitor usage dashboard

## Getting Help

**Documentation**:
- Full docs: https://docs.openclaw.ai
- SDK integration: https://docs.openclaw.ai/providers/github-copilot
- Skills: https://docs.openclaw.ai/tools/skills

**Commands**:
```bash
openclaw help
openclaw <command> --help
openclaw doctor  # diagnose issues
```

**Community**:
- GitHub Issues: https://github.com/openclaw/openclaw/issues
- ClawHub: https://clawhub.com

## Quick Reference

| Task | Command |
|------|---------|
| Start gateway | `openclaw gateway run` |
| Send message | `openclaw agent --message "text"` |
| List models | `openclaw models list` |
| Set default model | `openclaw models set <model>` |
| Check status | `openclaw status` |
| Enable channel | `openclaw channels enable <channel>` |
| Install skill | `clawhub install <skill>` |
| Regenerate models | `rm ~/.openclaw/models.json && openclaw gateway run` |
| Check logs | `openclaw logs` or `~/.openclaw/logs/` |

## Next Steps

Now that you understand the basics:

1. [Extend with Skills](./github-copilot-sdk-skills-guide.md) - Add custom capabilities
2. [Advanced Configuration](https://docs.openclaw.ai/configuration) - Fine-tune behavior
3. [Channel Integrations](https://docs.openclaw.ai/channels) - Connect more platforms
4. [API Usage](https://docs.openclaw.ai/api) - Use OpenClaw programmatically
