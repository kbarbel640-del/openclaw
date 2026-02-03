# Install ldraney-openclaw

## Prerequisites

- **Node.js 22+** (`node --version` to check)
- **pnpm** (optional but recommended): `npm install -g pnpm`

## 1. Set Environment Variables

Add to `~/.zshrc` (or `~/.bashrc`):

```bash
# Required
export ANTHROPIC_API_KEY="your-anthropic-key-here"

# Optional - Telegram bot (get from @BotFather on Telegram)
export TELEGRAM_BOT_TOKEN="your-telegram-bot-token"

# Optional - Notion integration (https://www.notion.so/profile/integrations)
export NOTION_API_KEY="your-notion-key"

# Optional - OpenRouter
export OPENROUTER_API_KEY="your-openrouter-key"
```

Then reload your shell:

```bash
source ~/.zshrc
```

## 2. Install & Run

```bash
# Install globally
npm install -g ldraney-openclaw

# Run onboard wizard
openclaw onboard --non-interactive --accept-risk \
  --auth-choice apiKey \
  --anthropic-api-key "$ANTHROPIC_API_KEY" \
  --install-daemon \
  --skip-channels --skip-skills --skip-ui
```

## 3. Add Telegram (Optional)

```bash
openclaw plugins enable telegram
openclaw channels add --channel telegram --token "$TELEGRAM_BOT_TOKEN"
```

Restart the gateway to apply:

```bash
# macOS
launchctl stop ai.openclaw.gateway && launchctl start ai.openclaw.gateway

# Linux (systemd)
systemctl --user restart openclaw-gateway
```

## 4. Verify

```bash
openclaw doctor
openclaw channels status
```

## 5. Use It

```bash
# Terminal UI
openclaw tui

# One-off message
openclaw agent --message "Hello"

# Send via channel
openclaw message send --to "+1234567890" --message "Hello from OpenClaw"
```

## Troubleshooting

### Check gateway logs

```bash
tail -50 ~/.openclaw/logs/gateway.log
```

### Restart gateway

```bash
# macOS
launchctl stop ai.openclaw.gateway && launchctl start ai.openclaw.gateway

# Linux
systemctl --user restart openclaw-gateway
```

### Reset and start fresh

```bash
openclaw reset
openclaw onboard --install-daemon
```

## From Source (Development)

```bash
git clone https://github.com/ldraney/openclaw.git
cd openclaw
pnpm install && pnpm build
pnpm openclaw onboard --install-daemon
```
