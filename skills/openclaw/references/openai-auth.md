# OpenAI auth (Codex subscription)

Source: local docs (/home/klabo/code/clawdbot/docs/providers/openai.md) or OpenClaw docs if present.

- OpenClaw can reuse Codex CLI auth stored at `~/.codex/auth.json`.
- Recommended for OpenAI subscription access: `openclaw onboard --auth-choice codex-cli`.
- Alternate OAuth flow in wizard: `openclaw onboard --auth-choice openai-codex`.
- Model refs use `provider/model`, e.g. `openai-codex/gpt-5.2`.
- API-key path exists but user prefers subscription (do not use keys unless asked).
