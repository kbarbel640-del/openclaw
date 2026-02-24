# Onboarding

## Local fallback with Ollama (recommended)

If your cloud API reaches limits or becomes unavailable, configure a local fallback model with Ollama.

### 1) Install and run Ollama

```bash
ollama serve
ollama pull llama3.1:8b
```

### 2) Configure OpenClaw to use local Ollama

```bash
openclaw config set model.provider ollama
openclaw config set model.name llama3.1:8b
```

### 3) Verify

```bash
openclaw status
```

Tip: you can switch back to cloud providers anytime by changing provider/model in config.
