---
summary: "Use Mistral AI models in OpenClaw"
read_when:
  - You want to use Mistral models in OpenClaw
  - You need Mistral setup and configuration guidance
title: "Mistral AI"
---

# Mistral AI

[Mistral AI](https://mistral.ai) provides efficient, high-quality open-weight and proprietary LLMs via a simple API. Mistral models are known for strong performance at competitive cost.

## Setup

### 1. Get API Key

1. Sign up at [console.mistral.ai](https://console.mistral.ai)
2. Go to **API Keys → Create new key**
3. Copy your key

### 2. Configure OpenClaw

**Option A: Environment Variable**

```bash
export MISTRAL_API_KEY="..."
```

**Option B: Config file**

```json5
{
  env: { MISTRAL_API_KEY: "..." },
  agents: { defaults: { model: { primary: "mistral/mistral-large-latest" } } },
}
```

### 3. Verify Setup

```bash
openclaw chat --model mistral/mistral-large-latest "Hello from Mistral!"
```

## Available Models

| Model ID                       | Description                                         |
| ------------------------------ | --------------------------------------------------- |
| `mistral/mistral-large-latest` | Most capable Mistral model — best for complex tasks |
| `mistral/mistral-small-latest` | Efficient and cost-effective for everyday tasks     |
| `mistral/codestral-latest`     | Code-optimized model for programming tasks          |

Use `openclaw models list | grep mistral` to see all available models.

## Pricing

Check [mistral.ai/technology/#pricing](https://mistral.ai/technology/#pricing) for current rates.

| Model                  | Input (per 1M tokens) | Output (per 1M tokens) |
| ---------------------- | --------------------- | ---------------------- |
| `mistral-large-latest` | $2.00                 | $6.00                  |
| `mistral-small-latest` | $0.20                 | $0.60                  |

## Links

- [Mistral Console](https://console.mistral.ai)
- [API Documentation](https://docs.mistral.ai)
- [Model Overview](https://docs.mistral.ai/getting-started/models/models_overview/)
