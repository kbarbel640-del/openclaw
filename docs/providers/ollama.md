---
summary: "Run OpenClaw with Ollama (local LLM runtime)"
read_when:
  - You want to run OpenClaw with local models via Ollama
  - You need Ollama setup and configuration guidance
title: "Ollama"
---

# Ollama

Ollama is a local LLM runtime that makes it easy to run open-source models on your machine. OpenClaw integrates with Ollama's native API (`/api/chat`), supporting streaming and tool calling, and can **auto-discover tool-capable models** when you opt in with `OLLAMA_API_KEY` (or an auth profile) and do not define an explicit `models.providers.ollama` entry.

## Quick start

1. Install Ollama: [https://ollama.ai](https://ollama.ai)

2. Pull a model:

```bash
ollama pull gpt-oss:20b
# or
ollama pull llama3.3
# or
ollama pull qwen2.5-coder:32b
# or
ollama pull deepseek-r1:32b
```

3. Enable Ollama for OpenClaw (any value works; Ollama doesn't require a real key):

```bash
# Set environment variable
export OLLAMA_API_KEY="ollama-local"

# Or configure in your config file
openclaw config set models.providers.ollama.apiKey "ollama-local"
```

4. Use Ollama models:

```json5
{
  agents: {
    defaults: {
      model: { primary: "ollama/gpt-oss:20b" },
    },
  },
}
```

## Model discovery (implicit provider)

When you set `OLLAMA_API_KEY` (or an auth profile) and **do not** define `models.providers.ollama`, OpenClaw discovers models from the local Ollama instance at `http://127.0.0.1:11434`:

- Queries `/api/tags` and `/api/show`
- Keeps only models that report `tools` capability
- Marks `reasoning` when the model reports `thinking`
- Reads `contextWindow` from `model_info["<arch>.context_length"]` when available
- Sets `maxTokens` to 10× the context window
- Sets all costs to `0`

This avoids manual model entries while keeping the catalog aligned with Ollama's capabilities.

To see what models are available:

```bash
ollama list
openclaw models list
```

To add a new model, simply pull it with Ollama:

```bash
ollama pull mistral
```

The new model will be automatically discovered and available to use.

If you set `models.providers.ollama` explicitly, auto-discovery is skipped and you must define models manually (see below).

## Configuration

### Basic setup (implicit discovery)

The simplest way to enable Ollama is via environment variable:

```bash
export OLLAMA_API_KEY="ollama-local"
```

### Explicit setup (manual models)

Use explicit config when:

- Ollama runs on another host/port.
- You want to force specific context windows or model lists.
- You want to include models that do not report tool support.

```json5
{
  models: {
    providers: {
      ollama: {
        baseUrl: "http://ollama-host:11434",
        apiKey: "ollama-local",
        api: "ollama",
        models: [
          {
            id: "gpt-oss:20b",
            name: "GPT-OSS 20B",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 8192,
            maxTokens: 8192 * 10
          }
        ]
      }
    }
  }
}
```

If `OLLAMA_API_KEY` is set, you can omit `apiKey` in the provider entry and OpenClaw will fill it for availability checks.

### Custom base URL (explicit config)

If Ollama is running on a different host or port (explicit config disables auto-discovery, so define models manually):

```json5
{
  models: {
    providers: {
      ollama: {
        apiKey: "ollama-local",
        baseUrl: "http://ollama-host:11434",
      },
    },
  },
}
```

### Model selection

Once configured, all your Ollama models are available:

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "ollama/gpt-oss:20b",
        fallbacks: ["ollama/llama3.3", "ollama/qwen2.5-coder:32b"],
      },
    },
  },
}
```

## Advanced

### Reasoning models

OpenClaw marks models as reasoning-capable when Ollama reports `thinking` in `/api/show`:

```bash
ollama pull deepseek-r1:32b
```

### Model Costs

Ollama is free and runs locally, so all model costs are set to $0.

### Streaming Configuration

OpenClaw's Ollama integration uses the **native Ollama API** (`/api/chat`) by default, which fully supports streaming and tool calling simultaneously. No special configuration is needed.

#### Legacy OpenAI-Compatible Mode

If you need to use the OpenAI-compatible endpoint instead (e.g., behind a proxy that only supports OpenAI format), set `api: "openai-completions"` explicitly:

```json5
{
  models: {
    providers: {
      ollama: {
        baseUrl: "http://ollama-host:11434/v1",
        api: "openai-completions",
        apiKey: "ollama-local",
        models: [...]
      }
    }
  }
}
```

Note: The OpenAI-compatible endpoint may not support streaming + tool calling simultaneously. You may need to disable streaming with `params: { streaming: false }` in model config.

### Context windows

For auto-discovered models, OpenClaw uses the context window reported by Ollama when available, otherwise it defaults to `8192`. You can override `contextWindow` and `maxTokens` in explicit provider config.

## Troubleshooting

### Ollama not detected

Make sure Ollama is running and that you set `OLLAMA_API_KEY` (or an auth profile), and that you did **not** define an explicit `models.providers.ollama` entry:

```bash
ollama serve
```

And that the API is accessible:

```bash
curl http://localhost:11434/api/tags
```

### No models available

OpenClaw only auto-discovers models that report tool support. If your model isn't listed, either:

- Pull a tool-capable model, or
- Define the model explicitly in `models.providers.ollama`.

To add models:

```bash
ollama list  # See what's installed
ollama pull gpt-oss:20b  # Pull a tool-capable model
ollama pull llama3.3     # Or another model
```

### Connection refused

Check that Ollama is running on the correct port:

```bash
# Check if Ollama is running
ps aux | grep ollama

# Or restart Ollama
ollama serve
```

## See Also

- [Model Providers](/concepts/model-providers) - Overview of all providers
- [Model Selection](/concepts/models) - How to choose models
- [Configuration](/gateway/configuration) - Full config reference

### VPS / remote Ollama: connection refused (ECONNREFUSED)

By default Ollama binds only to `127.0.0.1:11434` (localhost). If OpenClaw is
running on a different machine, or if you're accessing Ollama via the VPS's
public or LAN IP, all requests will fail with `ECONNREFUSED`.

**Fix — expose Ollama on all interfaces:**

```bash
# Inject OLLAMA_HOST into the systemd service
sudo sed -i 's|Environment="PATH=|Environment="OLLAMA_HOST=0.0.0.0"\nEnvironment="OLLAMA_ORIGINS=*"\nEnvironment="PATH=|' \
  /etc/systemd/system/ollama.service
sudo systemctl daemon-reload
sudo systemctl restart ollama

# Verify it is now bound to all interfaces (should show *:11434)
ss -tlnp | grep 11434
```

> **Security note:** exposing port 11434 publicly without authentication is not
> recommended for production. Firewall the port or use a reverse proxy with auth
> if the VPS is internet-facing.

### VPS / Ubuntu 22.04: intermittent DNS failures (systemd 255 + IPv6)

On Ubuntu 22.04 and 24.04 with systemd 255, `systemd-resolved` can crash with:

```
Assertion 's->read_packet->family == AF_INET6' failed
Aborting.
```

This kills DNS resolution until the service auto-restarts, causing transient
`fetch failed` / timeout errors when Ollama pulls models or when OpenClaw makes
any outbound HTTP request.

**Fix — disable DNS-over-TLS streaming (triggers the IPv6 bug):**

```bash
sudo mkdir -p /etc/systemd/resolved.conf.d
sudo tee /etc/systemd/resolved.conf.d/disable-dns-tcp.conf << 'EOF'
[Resolve]
DNSOverTLS=no
EOF
sudo systemctl restart systemd-resolved
```

### VPS: agents use wrong or slow model after setup

If agents default to a model other than the one you pulled (or fall back to CPU
inference causing 60–730 s responses), the active model config may not have been
updated after setup. Set it explicitly:

```bash
openclaw config set gateway.mode local
openclaw config set provider ollama
openclaw config set agents.defaults.model.primary "ollama/<your-model>"
# e.g.:
openclaw config set agents.defaults.model.primary "ollama/llama3.2:3b"
```

Confirm with:

```bash
openclaw config get agents.defaults.model.primary
# Should print: ollama/llama3.2:3b (or whichever model you pulled)
```

