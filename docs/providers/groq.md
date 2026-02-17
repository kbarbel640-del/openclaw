---
summary: "Use Groq's ultra-fast LPU inference in OpenClaw"
read_when:
  - You want to use Groq models in OpenClaw
  - You need fast, low-latency LLM inference
title: "Groq"
---

# Groq

[Groq](https://groq.com) provides ultra-fast LLM inference using its custom LPU (Language Processing Unit) hardware. It offers an OpenAI-compatible API and some of the lowest latency available for open-source models.

## Setup

### 1. Get API Key

1. Sign up at [console.groq.com](https://console.groq.com)
2. Go to **API Keys → Create API Key**
3. Copy your key (format: `gsk_...`)

### 2. Configure OpenClaw

**Option A: Environment Variable**

```bash
export GROQ_API_KEY="gsk_..."
```

**Option B: Config file**

```json5
{
  env: { GROQ_API_KEY: "gsk_..." },
  agents: { defaults: { model: { primary: "groq/deepseek-r1-distill-llama-70b" } } },
}
```

### 3. Verify Setup

```bash
openclaw chat --model groq/deepseek-r1-distill-llama-70b "Hello from Groq!"
```

## Available Models

| Model ID                             | Description                                               |
| ------------------------------------ | --------------------------------------------------------- |
| `groq/deepseek-r1-distill-llama-70b` | DeepSeek R1 distilled on Llama 70B — fast reasoning model |

Use `openclaw models list | grep groq` to see currently available models.

## Pricing

Groq uses a token-based pricing model. Check [console.groq.com/settings/billing](https://console.groq.com/settings/billing) for current rates.

## Links

- [Groq Console](https://console.groq.com)
- [API Documentation](https://console.groq.com/docs/openai)
- [Model Library](https://console.groq.com/docs/models)
