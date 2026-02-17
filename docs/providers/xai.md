---
summary: "Use xAI Grok models in OpenClaw"
read_when:
  - You want to use xAI Grok models in OpenClaw
  - You need xAI setup and configuration guidance
title: "xAI (Grok)"
---

# xAI (Grok)

[xAI](https://x.ai) is Elon Musk's AI company offering the Grok family of models. Grok models support real-time information access and are available via an OpenAI-compatible API.

## Setup

### 1. Get API Key

1. Sign up at [console.x.ai](https://console.x.ai)
2. Go to **API Keys → Create API Key**
3. Copy your key (format: `xai-...`)

### 2. Configure OpenClaw

**Option A: Environment Variable**

```bash
export XAI_API_KEY="xai-..."
```

**Option B: Config file**

```json5
{
  env: { XAI_API_KEY: "xai-..." },
  agents: { defaults: { model: { primary: "xai/grok-2" } } },
}
```

### 3. Verify Setup

```bash
openclaw chat --model xai/grok-2 "Hello from Grok!"
```

## Available Models

| Model ID          | Description                                        |
| ----------------- | -------------------------------------------------- |
| `xai/grok-2`      | Full Grok 2 model — best quality for complex tasks |
| `xai/grok-2-mini` | Faster, lighter variant — great for everyday use   |

Use `openclaw models list | grep xai` to see all available models.

## Pricing

Check [x.ai/api](https://x.ai/api) for current rates.

| Model         | Input (per 1M tokens) | Output (per 1M tokens) |
| ------------- | --------------------- | ---------------------- |
| `grok-2`      | $2.00                 | $10.00                 |
| `grok-2-mini` | $0.20                 | $1.00                  |

## Links

- [xAI Console](https://console.x.ai)
- [API Documentation](https://docs.x.ai/api)
- [Grok Model Overview](https://docs.x.ai/docs/models)
