# 🌿 Ollama Model Guide

Which models work well locally, and what hardware you need.

## Quick recommendations

| RAM   | Recommended model       | Size   | Notes                            |
| ----- | ----------------------- | ------ | -------------------------------- |
| 8GB   | `llama3.3` (8B Q4)      | ~4GB   | Default. Good all-around         |
| 8GB   | `phi4-mini`             | ~2.5GB | Faster, lighter, good for coding |
| 8GB   | `qwen2.5:7b`            | ~4GB   | Strong multilingual              |
| 16GB  | `llama3.3:latest`       | ~4GB   | Headroom for longer contexts     |
| 16GB  | `deepseek-coder-v2:16b` | ~9GB   | Best for code tasks              |
| 32GB+ | `llama3.1:70b-q4`       | ~40GB  | Near cloud quality               |

## Hardware guidelines

### Minimum (8GB RAM, no GPU)

- Models up to ~7B parameters (Q4 quantization)
- Expect 5-15 tokens/sec on modern i5/Ryzen 5
- Close browser tabs and other heavy apps when using larger models

### Recommended (16GB RAM)

- Comfortable with 7-13B models
- Room for the OS + model + openclaw simultaneously

### With GPU

- NVIDIA: Ollama uses CUDA automatically
- AMD: ROCm support (see Ollama docs)
- Apple Silicon: Metal acceleration, 7B models run great on M1 8GB

## Pulling models

```bash
# Default
ollama pull llama3.3

# Smaller/faster
ollama pull phi4-mini

# For coding
ollama pull deepseek-coder-v2

# List installed models
ollama list
```

## Configuring in openclaw-local

Set your model in `~/.openclaw/config.json`:

```json
{
  "model": {
    "primary": "ollama/llama3.3"
  }
}
```

Or use model aliases defined in the fork:

- `local` → `ollama/llama3.3`
- `llama` → `ollama/llama3.3`

## Performance tips

- **Use Q4 quantization** — best speed/quality tradeoff for limited RAM
- **Keep Ollama running** — first load is slow, subsequent calls reuse the loaded model
- **Set `OLLAMA_NUM_PARALLEL=1`** on 8GB machines to avoid OOM
- **Context length** — shorter contexts = faster. Default 2048 is fine for most chat
