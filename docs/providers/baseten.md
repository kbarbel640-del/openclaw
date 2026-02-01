---
summary: "Use Baseten Model-APIs for open source models in OpenClaw"
read_when:
  - You want to use Baseten as a model provider
  - You need Baseten API key setup for DeepSeek, GLM, or Kimi models
title: "Baseten"
---

# Baseten

Baseten provides inference for open source models like DeepSeek, GLM, and Kimi
via an OpenAI-compatible API. OpenClaw registers it as the `baseten` provider.

## Quick setup

1. Set `BASETEN_API_KEY` (or run the wizard below).
2. Run onboarding:

```bash
openclaw onboard --auth-choice baseten-api-key
```

The default model is set to:

```
baseten/deepseek-ai/DeepSeek-V3.1
```

## Get your API key

1. Sign up at [baseten.co](https://baseten.co)
2. Go to **Settings > API Keys** at [app.baseten.co/settings/api-keys](https://app.baseten.co/settings/api-keys)
3. Create a new API key

## Configuration options

**Option A: Environment Variable**

```bash
export BASETEN_API_KEY="your-api-key"
```

**Option B: Interactive Setup (Recommended)**

```bash
openclaw onboard --auth-choice baseten-api-key
```

**Option C: Non-interactive**

```bash
openclaw onboard --non-interactive \
  --auth-choice baseten-api-key \
  --baseten-api-key "your-api-key"
```

## Verify setup

```bash
openclaw chat --model baseten/deepseek-ai/DeepSeek-V3.1 "Hello, are you working?"
```

## Config example

```json5
{
  env: { BASETEN_API_KEY: "..." },
  agents: {
    defaults: {
      model: { primary: "baseten/deepseek-ai/DeepSeek-V3.1" },
      models: { "baseten/deepseek-ai/DeepSeek-V3.1": { alias: "DeepSeek V3.1" } },
    },
  },
}
```

Baseten uses implicit provider discovery, so no explicit `models.providers`
config is needed when `BASETEN_API_KEY` is set.

## Model catalog

All models use OpenAI-compatible endpoints. Pricing varies by model; check
[baseten.co/pricing](https://www.baseten.co/pricing) for current rates.

| Model ID                        | Name              | Context Window | Max Tokens | Reasoning |
| ------------------------------- | ----------------- | -------------- | ---------- | --------- |
| `zai-org/GLM-4.6`               | GLM 4.6           | 200k           | 8192       | false     |
| `zai-org/GLM-4.7`               | GLM 4.7           | 200k           | 8192       | false     |
| `deepseek-ai/DeepSeek-V3-0324`  | DeepSeek V3 0324  | 128k           | 8192       | true      |
| `deepseek-ai/DeepSeek-V3.1`     | DeepSeek V3.1     | 128k           | 8192       | true      |
| `moonshotai/Kimi-K2-0905`       | Kimi K2 0905      | 128k           | 8192       | false     |
| `moonshotai/Kimi-K2-Thinking`   | Kimi K2 Thinking  | 128k           | 8192       | true      |

## Which model should I use

| Use Case              | Recommended Model                    | Why                          |
| --------------------- | ------------------------------------ | ---------------------------- |
| **General tasks**     | `deepseek-ai/DeepSeek-V3.1`          | Strong reasoning, versatile  |
| **Coding**            | `deepseek-ai/DeepSeek-V3.1`          | Code-optimized reasoning     |
| **Multilingual**      | `zai-org/GLM-4.7`                    | Strong multilingual support  |
| **Complex reasoning** | `moonshotai/Kimi-K2-Thinking`        | Thinking/reasoning model     |

## Change default model

```bash
openclaw models set baseten/deepseek-ai/DeepSeek-V3.1
openclaw models set baseten/zai-org/GLM-4.7
```

List available models:

```bash
openclaw models list | grep baseten
```

## Features

| Feature              | Support           |
| -------------------- | ----------------- |
| **Streaming**        | Yes               |
| **Function calling** | Model-dependent   |
| **Vision**           | No (text only)    |

## Troubleshooting

### API key not recognized

```bash
echo $BASETEN_API_KEY
openclaw models list | grep baseten
```

### Model not available

Baseten model availability may change. Run `openclaw models list` to see
currently available models.

### Connection issues

Baseten API is at `https://inference.baseten.co/v1`. Ensure your network allows
HTTPS connections.

## Links

- [Baseten](https://baseten.co)
- [API Documentation](https://docs.baseten.co)
- [Pricing](https://www.baseten.co/pricing)
