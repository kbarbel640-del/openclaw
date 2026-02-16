---
summary: "Use Morpheus decentralized AI inference in SmartAgentNeo"
read_when:
  - You want decentralized AI inference in SmartAgentNeo
  - You want Morpheus network setup guidance
  - You want to run inference without centralized providers
title: "Morpheus"
---

# Morpheus (Decentralized AI)

**Morpheus** is a decentralized AI inference network that routes requests through a P2P network of model providers, powered by MOR token staking on Base mainnet.

Smart Agent Neo supports Morpheus as a first-class inference provider, with two access modes:

1. **Gateway mode** (recommended) — Use the Morpheus API gateway (api.mor.org) with a simple API key. OpenAI-compatible, no local infrastructure needed.
2. **Local mode** (advanced) — Run your own Morpheus proxy-router for fully decentralized, trustless inference with on-chain session management.

## Why Morpheus in SmartAgentNeo

- **Decentralized inference** — no single point of failure or censorship
- **Open-source models** — GLM 4.7, Kimi K2.5, Qwen3 235B, Llama 3.3 70B, GPT OSS 120B
- **MOR token economics** — stake MOR for sessions, get it back when done
- **OpenAI-compatible API** — standard `/v1/chat/completions` endpoint

## Setup — Gateway Mode (Recommended)

### 1. Get API Key

1. Go to [app.mor.org](https://app.mor.org)
2. Create an API key
3. Copy the key

### 2. Configure SmartAgentNeo

**Option A: Environment Variable**

```bash
export MORPHEUS_API_KEY="sk-mor-xxxxxxxxxxxx"
```

**Option B: Interactive Setup**

```bash
smart-agent-neo onboard --auth-choice morpheus-api-key
```

### 3. Verify Setup

```bash
smart-agent-neo chat --model morpheus/kimi-k2.5 "Hello, are you working?"
```

## Setup — Local Mode (Advanced)

Local mode runs inference through your own Morpheus proxy-router, giving you fully decentralized, trustless access to the Morpheus P2P network.

### Prerequisites

- Morpheus proxy-router binary ([lumerin-node releases](https://github.com/MorpheusAIs/Morpheus-Lumerin-Node/releases))
- MOR tokens on Base mainnet (for session staking, ~1.9 MOR per 7-day session)
- ETH on Base (for gas)

### 1. Start the proxy-router

```bash
# The proxy-router listens on port 8082 by default
./mor-cli start
```

### 2. Configure SmartAgentNeo

```bash
export MORPHEUS_API_KEY="local"
export MORPHEUS_ROUTER_URL="http://localhost:8082"
```

Optional environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `MORPHEUS_ROUTER_URL` | — | Proxy-router URL (enables local mode) |
| `MORPHEUS_COOKIE_PATH` | `~/morpheus/.cookie` | Path to proxy-router auth cookie |
| `MORPHEUS_SESSION_DURATION` | `604800` | Session duration in seconds (7 days) |
| `MORPHEUS_RENEW_BEFORE` | `3600` | Renew session this many seconds before expiry |

### 3. Verify Setup

```bash
smart-agent-neo chat --model morpheus/glm-4.7 "Hello from the decentralized network!"
```

## Available Models (8)

| Model ID | Name | Context | Features |
|----------|------|---------|----------|
| `kimi-k2.5` | Kimi K2.5 | 131k | General, fast |
| `kimi-k2.5:web` | Kimi K2.5 Web | 131k | Web-augmented |
| `kimi-k2-thinking` | Kimi K2 Thinking | 131k | Reasoning |
| `glm-4.7-flash` | GLM 4.7 Flash | 202k | Fast, lightweight |
| `glm-4.7` | GLM 4.7 | 202k | Reasoning, multilingual |
| `qwen3-235b` | Qwen3 235B | 131k | Reasoning, large |
| `llama-3.3-70b` | Llama 3.3 70B | 131k | General |
| `gpt-oss-120b` | GPT OSS 120B | 131k | General, large |

Model availability depends on which providers are active on the Morpheus network. The catalog above is a static fallback; Smart Agent Neo discovers models dynamically from the blockchain when possible.

## Model Selection

```bash
# Default model (our pick)
smart-agent-neo models set morpheus/kimi-k2.5

# Best reasoning
smart-agent-neo models set morpheus/glm-4.7

# Fast/lightweight
smart-agent-neo models set morpheus/glm-4.7-flash

# List available models
smart-agent-neo models list | grep morpheus
```

## Session Economics (Local Mode)

In local mode, Morpheus uses MOR token staking for sessions:

| Parameter | Value |
|-----------|-------|
| Session duration | 7 days (default, configurable) |
| Stake per session | ~1.9 MOR |
| Stake return | When session ends or expires |
| Recommended allowance | 100 MOR |

**Important:** Never approve `maxUint256` allowance for the Diamond contract. Use a reasonable amount (100 MOR) to avoid Solidity overflow when the proxy-router calls `increaseAllowance`.

## Streaming & Tool Support

| Feature | Support |
|---------|---------|
| **Streaming** | Supported |
| **Function calling** | Depends on model |
| **Vision/Images** | Not currently supported |

## Troubleshooting

### "Morpheus session unavailable"

The proxy-router may not be running, or the .cookie file is missing/inaccessible.

```bash
# Check router is running
curl http://localhost:8082/health

# Check cookie file exists
cat ~/morpheus/.cookie
```

### "Unknown model" error

The model may not be available on the network. List available models:

```bash
# Via gateway
curl https://api.mor.org/api/v1/models

# Via local router
curl http://localhost:8082/blockchain/models
```

### Session errors / "session not found"

Sessions are lost when the proxy-router restarts. Smart Agent Neo handles this automatically with retry logic, but if errors persist:

1. Check that MOR tokens are staked and allowance is set
2. Verify the proxy-router has blockchain connectivity
3. Check session duration hasn't expired

### Inference timeout

Default timeout is 3 minutes. Morpheus P2P routing can be slower than centralized providers. If timeouts are frequent, try a different model or check provider availability on the network.

## Config File Example

```json5
{
  env: { MORPHEUS_API_KEY: "sk-mor-..." },
  agents: { defaults: { model: { primary: "morpheus/kimi-k2.5" } } },
  models: {
    mode: "merge",
    providers: {
      morpheus: {
        baseUrl: "https://api.mor.org/api/v1",
        apiKey: "${MORPHEUS_API_KEY}",
        api: "openai-completions",
        models: [
          {
            id: "kimi-k2.5",
            name: "Kimi K2.5",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 131072,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

## Links

- [Morpheus Network](https://mor.org)
- [Morpheus App / API Keys](https://app.mor.org)
- [Proxy-Router Releases](https://github.com/MorpheusAIs/Morpheus-Lumerin-Node/releases)
- [MOR Token (Base)](https://basescan.org/token/0x7431aDa8a591C955a994a21710752EF9b882b8e3)
