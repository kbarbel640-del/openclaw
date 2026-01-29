---
summary: "Use Nebius OpenAI-compatible inference for frontier and open-source models"
read_when:
  - You want to use Nebius inference
  - You want to use Qwen, Llama, DeepSeek, and other open models
---
# Nebius

Nebius provides **OpenAI-compatible inference** for frontier and open-source models, including **Qwen**, **Llama**, **DeepSeek**, and **GLM**, via the Nebius TokenFactory API. This allows seamless drop-in usage with existing OpenAI-style clients and tooling.

## CLI setup

```bash
clawdbot onboard --auth-choice nebius-api-key
# or non-interactive
clawdbot onboard --nebius-api-key "$NEBIUS_API_KEY"

```

## Config snippet

```json5
{
  env: { NEBIUS_API_KEY: "sk-..." },
  agents: {
    defaults: {
      model: {
        primary: "Qwen/Qwen3-32B-fast",
        fallbacks: ["meta-llama/Llama-3.3-70B-Instruct-fast"]
      }
    }
  }
}
```

## Available models

### Daily Driver (Fast, Capable)
- `Qwen/Qwen3-32B-fast` – Qwen3 32B Fast (recommended default)

### Lightweight (Fast, Basic)
- `meta-llama/Meta-Llama-3.1-8B-Instruct-fast` – Llama 3.1 8B Fast

### Heavy Lifting (More Complex)
- `meta-llama/Llama-3.3-70B-Instruct` – Llama 3.3 70B
- `meta-llama/Llama-3.3-70B-Instruct-fast` – Llama 3.3 70B Fast
- `deepseek-ai/DeepSeek-V3-0324-fast` – DeepSeek V3 Fast

### Specialized (Reasoning)
- `deepseek-ai/DeepSeek-R1-0528-fast` – DeepSeek R1 Fast

### Vision
- `Qwen/Qwen2.5-VL-72B-Instruct` – Qwen2.5 VL 72B

### Coding
- `Qwen/Qwen2.5-Coder-7B-fast` – Qwen2.5 Coder 7B Fast

### GLM Models
- `zai-org/GLM-4.7-FP8` – GLM 4.7 FP8
- `zai-org/GLM-4.5` – GLM 4.5

## Notes

- Base URL: https://api.tokenfactory.nebius.com/v1
- OpenAI-compatible Chat Completions API
- Model refs use nebius/<model> format
- Set NEBIUS_API_KEY in the environment or config
- Works with standard OpenAI SDKs (Python, JS, etc.)