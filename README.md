# 🌿 gclaw

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

**🌱 A local-first AI agent gateway — defaults to Ollama, no API keys required.**

gclaw is a local-first fork of [OpenClaw](https://github.com/openclaw-ai/openclaw) that runs your own AI models on your own hardware with zero cloud dependencies. Built by [gthumb.ai](https://gthumb.ai) 🪴

## 🌿 Why gclaw?

OpenClaw is great, but it defaults to cloud providers. gclaw flips the defaults so everything runs locally out of the box:

- 🌱 **Ollama is the default provider** — not Anthropic
- 🌿 **Onboarding wizard leads with local** — cloud is still there under "Advanced"
- 🍃 **Ships with local-first configs** — works out of the box with `ollama pull gemma3:4b`
- 🌲 **Zero cloud dependencies** — no API keys, no accounts, no billing
- 🪴 **All cloud providers still work** — just not the default

See [FORK.md](./FORK.md) for the exact diff from upstream.

## 🌱 Why local-first?

- 🔒 **Privacy**: Your conversations never leave your machine
- 🆓 **No API keys**: Get started in minutes with Ollama — no accounts, no billing
- 🌐 **Offline capable**: Works without internet once models are pulled
- 💚 **Cost**: $0/month after hardware investment
- ☁️ **Cloud fallback**: Cloud providers (Anthropic, OpenAI, etc.) still work when you want them

## 🚀 Quick Start

```bash
# 1. Install Ollama (if you haven't)
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull the default model
ollama pull gemma3:4b

# 3. Run the setup script
./scripts/setup-local.sh

# 4. Start gclaw
gclaw gateway start
```

Or use the interactive onboarding wizard:

```bash
gclaw onboard
```

The wizard defaults to Ollama/local models. Cloud providers are available under "Advanced" options.

## 🌿 CLI Commands

| Command               | Description                             |
| --------------------- | --------------------------------------- |
| `gclaw gateway start` | Start the local agent gateway           |
| `gclaw onboard`       | Interactive setup wizard (Ollama-first) |
| `gclaw status`        | Check gateway and Ollama status         |
| `gclaw tui`           | TUI chat interface                      |

gclaw works fully offline once your Ollama models are pulled — no internet required.

## ⚙️ Configuration

Copy the example config and customize:

```bash
cp gclaw.example.json ~/.openclaw/config.json
```

See [gclaw.example.json](./gclaw.example.json) for all defaults.

### Default model: `ollama/gemma3:4b`

You can switch models anytime:

```bash
# Use a different Ollama model
ollama pull deepseek-coder-v2
# Then update your config's model.primary to "ollama/deepseek-coder-v2"

# Or switch to a cloud provider
# Set model.primary to "anthropic/claude-sonnet-4-5" and add your API key
```

### Supported Ollama Models

| RAM   | Model                   | Notes                            |
| ----- | ----------------------- | -------------------------------- |
| 8GB   | `llama3.3` (8B Q4)      | Default — good all-around        |
| 8GB   | `phi4-mini`             | Faster, lighter, good for coding |
| 8GB   | `qwen2.5:7b`            | Strong multilingual              |
| 16GB  | `deepseek-coder-v2:16b` | Best for code tasks              |
| 32GB+ | `llama3.1:70b-q4`       | Near cloud quality               |

See [docs/ollama-models.md](./docs/ollama-models.md) for the full guide.

## 🌿 What's different from upstream OpenClaw?

See [FORK.md](./FORK.md) for a detailed changelog. In short:

- Default provider changed from Anthropic → Ollama
- Onboarding wizard presents local/Ollama as the first option
- Model aliases include `local` and `llama` → `ollama/gemma3:4b`
- Ships with local-first example config and setup script
- All cloud provider functionality is preserved — just not the default

## 📋 Requirements

- **Node.js** ≥ 22
- **pnpm** (monorepo package manager)
- **Ollama** (for local inference) — [ollama.com](https://ollama.com)
- 8GB+ RAM recommended for llama3.3 (16GB+ for larger models)

## 🛠️ Development

```bash
git clone https://github.com/GreenThumbMarket/gclaw.git
cd gclaw
pnpm install
pnpm build
pnpm test
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for more details.

## License

MIT — same as upstream OpenClaw. See [LICENSE](./LICENSE).
