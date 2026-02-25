---
summary: "Use SkillBoss unified AI platform with OpenClaw"
read_when:
  - You want to use SkillBoss models in OpenClaw
  - You want SkillBoss setup guidance
title: "SkillBoss"
---

# SkillBoss

[SkillBoss](https://skillboss.co) is a unified platform that provides pay-as-you-go access to 50+ AI models through a single API key. It uses an Anthropic-compatible API endpoint.

## Features

- **50+ models**: Access Claude, GPT, Gemini, DeepSeek, Qwen, and more
- **Pay-as-you-go**: No subscriptions, add credit starting at $7.50
- **Anthropic-compatible API**: Standard `/v1` endpoint
- **Single API key**: One key for all models

## Setup

### 1. Get API Key

1. Sign up at [skillboss.co](https://skillboss.co)
2. Add credit to your wallet from the dashboard
3. Copy your API key from the dashboard

### 2. Configure OpenClaw

**Option A: Interactive Setup (Recommended)**

```bash
openclaw onboard --auth-choice skillboss-api-key
```

This will:

1. Prompt for your API key (or use existing `SKILLBOSS_API_KEY`)
2. Show available models
3. Let you pick your default model
4. Configure the provider automatically

**Option B: Environment Variable**

```bash
export SKILLBOSS_API_KEY="your-api-key"
```

**Option C: Non-interactive**

```bash
openclaw onboard --non-interactive \
  --auth-choice skillboss-api-key \
  --skillboss-api-key "your-api-key"
```

### 3. Verify Setup

```bash
openclaw agent --model skillboss/claude-opus-4-6 --message "Hello, are you working?"
```

## Available Models

| Model ID            | Name              | Context (tokens) | Features          |
| ------------------- | ----------------- | ---------------- | ----------------- |
| `claude-opus-4-6`   | Claude Opus 4.6   | 200k             | Reasoning, vision |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 | 200k             | Reasoning, vision |
| `gpt-5.2`           | GPT 5.2           | 128k             | Vision            |

Change your default model anytime:

```bash
openclaw models set skillboss/claude-opus-4-6
openclaw models set skillboss/claude-sonnet-4-6
```

## Config file example

```json5
{
  env: { SKILLBOSS_API_KEY: "your-api-key" },
  agents: { defaults: { model: { primary: "skillboss/claude-opus-4-6" } } },
  models: {
    mode: "merge",
    providers: {
      skillboss: {
        baseUrl: "https://api.heybossai.com/v1",
        apiKey: "${SKILLBOSS_API_KEY}",
        api: "anthropic-messages",
        models: [
          {
            id: "claude-opus-4-6",
            name: "Claude Opus 4.6",
            reasoning: true,
            input: ["text", "image"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200000,
            maxTokens: 32000,
          },
        ],
      },
    },
  },
}
```

## Troubleshooting

### API key not recognized

```bash
echo $SKILLBOSS_API_KEY
openclaw models list | grep skillboss
```

Ensure you have copied the key from your SkillBoss dashboard.

### Connection issues

SkillBoss API is at `https://api.heybossai.com/v1`. Ensure your network allows HTTPS connections.

## Links

- [SkillBoss](https://skillboss.co)
