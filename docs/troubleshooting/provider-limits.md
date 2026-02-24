# API limits and local fallback

If you hit cloud API limits after onboarding, configure a local Ollama fallback.

```bash
ollama serve
ollama pull llama3.1:8b
openclaw config set model.provider ollama
openclaw config set model.name llama3.1:8b
```

Then verify with:

```bash
openclaw status
```
