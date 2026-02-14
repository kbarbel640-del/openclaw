# 🌿 FORK.md — gclaw

This documents what changed from upstream [OpenClaw](https://github.com/openclaw-ai/openclaw) and why.

## 🌱 Philosophy

gclaw is a minimal fork that changes **defaults**, not architecture. The goal: a user who runs `gclaw onboard` gets a working local setup with Ollama without needing any API keys or cloud accounts.

All cloud provider functionality is preserved. This fork only changes what happens when you don't configure anything.

## 🍃 Changes from upstream

### `package.json`

- **name**: `openclaw` → `gclaw`
- **description**: Updated to reflect local-first focus

### `src/agents/defaults.ts`

- **DEFAULT_PROVIDER**: `"anthropic"` → `"ollama"`
- **DEFAULT_MODEL**: `"claude-opus-4-6"` → `"llama3.3"`

### `src/config/defaults.ts`

- Added model aliases: `llama` → `ollama/llama3.3`, `local` → `ollama/llama3.3`

### `src/commands/auth-choice-options.ts`

- Moved "Ollama / vLLM (local)" to the top of the provider selection list in the onboarding wizard
- Updated labels/hints to emphasize local-first: "no API key needed (recommended)"

### New files

- **`README.md`** — Local-first documentation
- **`FORK.md`** — This file
- **`gclaw.example.json`** — Example config with Ollama defaults
- **`scripts/setup-local.sh`** — Setup script that checks for Ollama, pulls a model, generates config

## 🔄 Keeping up with upstream

```bash
git remote add upstream https://github.com/openclaw-ai/openclaw.git
git fetch upstream
git merge upstream/main
```

Conflicts should be minimal — they'll only occur in the few files listed above.
