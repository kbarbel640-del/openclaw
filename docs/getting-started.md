# 🌱 Getting Started with openclaw-local

A step-by-step guide to running your own local AI agent.

## Prerequisites

- **Node.js ≥ 22** — [nodejs.org](https://nodejs.org/)
- **pnpm** — `corepack enable` (bundled with Node 22+)
- **Ollama** — [ollama.com](https://ollama.com)

## 1. Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Verify it's running:

```bash
ollama --version
```

## 2. Pull a model

```bash
ollama pull llama3.3
```

This downloads ~4GB. On 8GB RAM machines, llama3.3 (8B Q4) runs well. See [ollama-models.md](./ollama-models.md) for alternatives.

## 3. Clone and build

```bash
git clone https://github.com/gthumb-ai/openclaw-local.git
cd openclaw-local
pnpm install
pnpm build
```

## 4. Run setup

```bash
./scripts/setup-local.sh
```

This checks for Ollama, pulls the default model if needed, and generates a config file at `~/.openclaw/config.json`.

## 5. Start the gateway

```bash
openclaw gateway start
```

Or use the interactive wizard:

```bash
openclaw onboard
```

## 6. Chat

Open the web UI at `http://localhost:3000` (default) or connect via any supported channel (Discord, Telegram, etc.).

## Troubleshooting

- **"Ollama not found"** — Make sure `ollama serve` is running
- **Slow responses** — Try a smaller model like `phi4-mini` or `qwen2.5:3b`
- **Out of memory** — Close other apps, or use a quantized model (Q4 variants)

## Next steps

- [Recommended models](./ollama-models.md) for different hardware
- [Architecture overview](./architecture.md)
- [Contributing](../CONTRIBUTING.md)
