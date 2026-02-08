---
summary: "Von OpenClaw unterstützte Modellanbieter (LLMs)"
read_when:
  - Sie moechten einen Modellanbieter auswaehlen
  - Sie moechten schnelle Einrichtungsbeispiele fuer LLM-Authentifizierung und Modellauswahl
title: "Schnellstart fuer Modellanbieter"
x-i18n:
  source_path: providers/models.md
  source_hash: c897ca87805f1ec5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:11Z
---

# Modellanbieter

OpenClaw kann viele LLM-Anbieter nutzen. Waehlen Sie einen aus, authentifizieren Sie sich und legen Sie dann das Standard-
modell als `provider/model` fest.

## Highlight: Venice (Venice AI)

Venice ist unsere empfohlene Venice-AI-Einrichtung fuer datenschutzorientierte Inferenz mit der Option, Opus fuer die anspruchsvollsten Aufgaben zu verwenden.

- Standard: `venice/llama-3.3-70b`
- Insgesamt am besten: `venice/claude-opus-45` (Opus bleibt das staerkste)

Siehe [Venice AI](/providers/venice).

## Schnellstart (zwei Schritte)

1. Authentifizieren Sie sich beim Anbieter (meistens ueber `openclaw onboard`).
2. Legen Sie das Standardmodell fest:

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## Unterstuetzte Anbieter (Starter-Set)

- [OpenAI (API + Codex)](/providers/openai)
- [Anthropic (API + Claude Code CLI)](/providers/anthropic)
- [OpenRouter](/providers/openrouter)
- [Vercel AI Gateway](/providers/vercel-ai-gateway)
- [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)
- [Moonshot AI (Kimi + Kimi Coding)](/providers/moonshot)
- [Synthetic](/providers/synthetic)
- [OpenCode Zen](/providers/opencode)
- [Z.AI](/providers/zai)
- [GLM models](/providers/glm)
- [MiniMax](/providers/minimax)
- [Venice (Venice AI)](/providers/venice)
- [Amazon Bedrock](/bedrock)

Fuer den vollstaendigen Anbieterkatalog (xAI, Groq, Mistral usw.) und die erweiterte Konfiguration
siehe [Model providers](/concepts/model-providers).
