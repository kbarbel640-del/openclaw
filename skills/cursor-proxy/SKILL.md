---
name: cursor-proxy
description: OpenAI-compatible API proxy for Cursor IDE. Start a local proxy that translates OpenAI API calls to Cursor's internal API, enabling use of Cursor subscription models (GPT-4o, Claude 4 Sonnet, Claude 4.5 Opus) via OpenClaw. Use when user wants to use Cursor models, start Cursor proxy, or configure Cursor as a provider.
metadata:
  {
    "openclaw":
      {
        "emoji": "🖱️",
        "author": "xiaoyaner",
        "version": "1.0.0",
        "requires": {
          "bins": ["python3"],
          "python": ["httpx", "protobuf"]
        },
        "install": [
          {
            "id": "pip-deps",
            "kind": "shell",
            "command": "pip3 install httpx[http2] protobuf",
            "label": "Install Python dependencies"
          }
        ]
      }
  }
---

# Cursor Proxy

OpenAI-compatible API proxy for Cursor IDE, allowing OpenClaw to use Cursor subscription models.

## ⚠️ Important

This uses **reverse-engineered, unofficial Cursor API**. It may break when Cursor updates.

## Prerequisites

- Active Cursor IDE subscription (logged in locally)
- Cursor installed at default location
- Python 3.8+

## Available Models

| Model ID | Description |
|----------|-------------|
| `gpt-4o` | GPT-4o via Cursor |
| `claude-4-sonnet` | Claude 4 Sonnet |
| `claude-4.5-sonnet-thinking` | Claude 4.5 Sonnet with thinking |
| `claude-4.5-opus-high` | Claude 4.5 Opus |
| `claude-4.5-opus-high-thinking` | Claude 4.5 Opus with extended thinking |

## Usage

### Start the Proxy

```bash
# Start proxy (default port 3011)
python3 {SKILL_DIR}/scripts/proxy.py

# Custom port
python3 {SKILL_DIR}/scripts/proxy.py --port 3012
```

The proxy runs on `http://127.0.0.1:3011` by default.

### Configure OpenClaw

Add to your `openclaw.json`:

```json
{
  "models": {
    "providers": {
      "cursor": {
        "baseUrl": "http://127.0.0.1:3011/v1",
        "apiKey": "local-proxy",
        "api": "openai-completions",
        "models": [
          {
            "id": "gpt-4o",
            "name": "GPT-4o (Cursor)",
            "contextWindow": 128000,
            "maxTokens": 8192
          },
          {
            "id": "claude-4-sonnet",
            "name": "Claude 4 Sonnet (Cursor)",
            "contextWindow": 200000,
            "maxTokens": 8192
          },
          {
            "id": "claude-4.5-opus-high-thinking",
            "name": "Claude 4.5 Opus Thinking (Cursor)",
            "reasoning": true,
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "models": {
        "cursor/gpt-4o": {"alias": "cursor-gpt"},
        "cursor/claude-4-sonnet": {"alias": "cursor-sonnet"},
        "cursor/claude-4.5-opus-high-thinking": {"alias": "cursor-opus"}
      }
    }
  }
}
```

### Test the Proxy

```bash
curl http://localhost:3011/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-4-sonnet", "messages": [{"role": "user", "content": "Hello!"}]}'
```

### Use with tmux (Recommended)

For persistent proxy:

```bash
# Start in tmux session
tmux new-session -d -s cursor-proxy "python3 {SKILL_DIR}/scripts/proxy.py"

# Check status
tmux capture-pane -t cursor-proxy -p | tail -5

# Stop
tmux kill-session -t cursor-proxy
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | Chat completions (OpenAI format) |
| `/v1/models` | GET | List available models |
| `/health` | GET | Health check |

## Troubleshooting

### "Cursor client not found"
- Ensure Cursor IDE is installed and you're logged in
- Check that `~/Library/Application Support/Cursor/` exists (macOS)

### "Model not found"
- Use exact model IDs from the table above
- Some models may require specific Cursor subscription tiers

### Proxy stops working after Cursor update
- This is expected - the API is reverse-engineered
- Check for skill updates or report the issue

## Architecture

```
OpenClaw → Proxy (localhost:3011) → Cursor HTTP/2 API (api2.cursor.sh)
              ↓
         cursor_http2_client.py
              ↓
         Local SQLite (Cursor auth tokens)
```

## Credits

Based on [eisbaw/cursor_api_demo](https://github.com/eisbaw/cursor_api_demo) reverse engineering work.
