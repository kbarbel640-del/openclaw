---
summary: „Von OpenClaw unterstützte Modellanbieter (LLMs)“
read_when:
  - Sie möchten einen Modellanbieter auswählen
  - Sie benötigen einen schnellen Überblick über unterstützte LLM-Backends
title: „Modellanbieter“
x-i18n:
  source_path: providers/index.md
  source_hash: 84233de8ae3a39e0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:10Z
---

# Modellanbieter

OpenClaw kann viele LLM-Anbieter verwenden. Wählen Sie einen Anbieter aus, authentifizieren Sie sich und legen Sie dann das
Standardmodell als `provider/model` fest.

Suchen Sie nach Dokumentation zu Chat-Kanälen (WhatsApp/Telegram/Discord/Slack/Mattermost (Plugin)/etc.)? Siehe [Kanäle](/channels).

## Highlight: Venice (Venice AI)

Venice ist unsere empfohlene Venice-AI-Konfiguration für datenschutzorientierte Inferenz mit der Option, Opus für anspruchsvolle Aufgaben zu verwenden.

- Standard: `venice/llama-3.3-70b`
- Insgesamt am besten: `venice/claude-opus-45` (Opus bleibt das stärkste)

Siehe [Venice AI](/providers/venice).

## Schnellstart

1. Authentifizieren Sie sich beim Anbieter (in der Regel über `openclaw onboard`).
2. Legen Sie das Standardmodell fest:

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## Anbieter-Dokumentation

- [OpenAI (API + Codex)](/providers/openai)
- [Anthropic (API + Claude Code CLI)](/providers/anthropic)
- [Qwen (OAuth)](/providers/qwen)
- [OpenRouter](/providers/openrouter)
- [Vercel AI Gateway](/providers/vercel-ai-gateway)
- [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)
- [Moonshot AI (Kimi + Kimi Coding)](/providers/moonshot)
- [OpenCode Zen](/providers/opencode)
- [Amazon Bedrock](/bedrock)
- [Z.AI](/providers/zai)
- [Xiaomi](/providers/xiaomi)
- [GLM-Modelle](/providers/glm)
- [MiniMax](/providers/minimax)
- [Venice (Venice AI, datenschutzorientiert)](/providers/venice)
- [Ollama (lokale Modelle)](/providers/ollama)

## Transkriptionsanbieter

- [Deepgram (Audiotranskription)](/providers/deepgram)

## Community-Tools

- [Claude Max API Proxy](/providers/claude-max-api-proxy) – Verwenden Sie ein Claude-Max/Pro-Abonnement als OpenAI-kompatiblen API-Endpunkt

Für den vollständigen Anbieter-Katalog (xAI, Groq, Mistral usw.) und erweiterte Konfigurationen
siehe [Modellanbieter](/concepts/model-providers).
