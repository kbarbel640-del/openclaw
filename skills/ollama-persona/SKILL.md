---
name: ollama-persona
description: Set up a local Ollama model with agent persona for cost-efficient posting and replies. Use when setting up local LLM, creating persona models, or offloading simple tasks from expensive cloud models.
---

# Ollama Persona

Create a local LLM persona from your workspace identity files for cheap, fast replies.

## Prerequisites

- NVIDIA GPU with 4GB+ VRAM (or CPU-only with 8GB+ RAM)
- ~3GB disk space for base model

## Quick Setup

### 1. Install Ollama

```bash
# Linux
curl -fsSL https://ollama.com/install.sh | sh

# macOS
brew install ollama

# Start server
ollama serve &
```

### 2. Generate Persona Model

Run the bundled script to create a model from your workspace identity:

```bash
python3 scripts/create_persona.py \
  --name "myagent" \
  --workspace /path/to/workspace \
  --base llama3.2:3b
```

The script reads `SOUL.md`, `IDENTITY.md`, and `USER.md` to build a system prompt.

### 3. Use the Model

```bash
# Quick prompt
curl -s http://localhost:11434/api/generate \
  -d '{"model":"myagent","prompt":"Write a tweet about AI agents","stream":false}' \
  | jq -r '.response'

# Or use the helper
scripts/ask-local "Write a tweet about AI agents"
```

## When to Use Local vs Cloud

| Task | Use Local | Use Cloud |
|------|-----------|-----------|
| Tweets/posts | ✅ | |
| Simple summaries | ✅ | |
| Greentext replies | ✅ | |
| Coding | | ✅ |
| Complex reasoning | | ✅ |
| Multi-step tasks | | ✅ |

## Model Options

| Model | Size | VRAM | Speed | Quality |
|-------|------|------|-------|---------|
| llama3.2:1b | 1.3GB | 2GB | Fast | Basic |
| llama3.2:3b | 2GB | 4GB | Good | Solid |
| llama3.1:8b | 4.7GB | 8GB | Slower | Better |

## Customization

Edit the generated Modelfile at `~/.ollama/<name>.modelfile` to tune:

- `PARAMETER temperature` - Higher = more creative (0.7-1.0 for posts)
- `PARAMETER top_p` - Nucleus sampling (0.9 default)
- System prompt - Add catchphrases, topics, forbidden words

## Troubleshooting

**Model too slow**: Try `llama3.2:1b` or enable GPU offloading
**Out of memory**: Set `OLLAMA_NUM_GPU=0` for CPU-only
**Server not running**: `ollama serve &` or check port 11434
