# 🍃 Architecture — How openclaw-local differs from upstream

openclaw-local is a **thin fork** of [OpenClaw](https://github.com/openclaw-ai/openclaw). The architecture is identical — we only change defaults and onboarding flow.

## What's the same

Everything. The gateway, agent system, channel adapters, skill framework, web UI, CLI — all unchanged. Any OpenClaw documentation applies to openclaw-local.

## What's different

### 1. Default provider: Ollama instead of Anthropic

```
upstream:  DEFAULT_PROVIDER = "anthropic"
local:     DEFAULT_PROVIDER = "ollama"
```

When you start openclaw-local without configuring a provider, it talks to Ollama at `http://localhost:11434` instead of requiring an Anthropic API key.

### 2. Onboarding wizard order

The `openclaw onboard` wizard presents Ollama/local as the first choice instead of cloud providers. Cloud options are still available under "Advanced."

### 3. Model aliases

Added convenience aliases so `local` and `llama` resolve to `ollama/llama3.3`.

### 4. Example config and setup script

- `openclaw-local.example.json` — ready-to-use config with Ollama defaults
- `scripts/setup-local.sh` — checks prerequisites, pulls models, generates config

## Cloud providers still work

Nothing is removed. Set your API key and change `model.primary` to any cloud model and it works exactly like upstream OpenClaw.

## Keeping in sync with upstream

```bash
git remote add upstream https://github.com/openclaw-ai/openclaw.git
git fetch upstream
git merge upstream/main
```

Conflicts are limited to the handful of files listed in [FORK.md](../FORK.md).
