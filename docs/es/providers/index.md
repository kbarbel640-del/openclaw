---
summary: "Proveedores de modelos (LLM) compatibles con OpenClaw"
read_when:
  - Desea elegir un proveedor de modelos
  - Necesita una vista general rapida de los backends de LLM compatibles
title: "Proveedores de Modelos"
x-i18n:
  source_path: providers/index.md
  source_hash: 84233de8ae3a39e0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:38Z
---

# Proveedores de Modelos

OpenClaw puede usar muchos proveedores de LLM. Elija un proveedor, autentiquese y luego establezca el
modelo predeterminado como `provider/model`.

¿Busca documentacion de canales de chat (WhatsApp/Telegram/Discord/Slack/Mattermost (plugin)/etc.)? Consulte [Canales](/channels).

## Destacado: Venice (Venice AI)

Venice es nuestra configuracion recomendada de Venice AI para inferencia con enfoque en la privacidad, con la opcion de usar Opus para tareas exigentes.

- Predeterminado: `venice/llama-3.3-70b`
- Mejor en general: `venice/claude-opus-45` (Opus sigue siendo el mas potente)

Consulte [Venice AI](/providers/venice).

## Inicio rapido

1. Autentiquese con el proveedor (generalmente mediante `openclaw onboard`).
2. Establezca el modelo predeterminado:

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## Documentacion de proveedores

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
- [Modelos GLM](/providers/glm)
- [MiniMax](/providers/minimax)
- [Venice (Venice AI, enfoque en la privacidad)](/providers/venice)
- [Ollama (modelos locales)](/providers/ollama)

## Proveedores de transcripcion

- [Deepgram (transcripcion de audio)](/providers/deepgram)

## Herramientas de la comunidad

- [Claude Max API Proxy](/providers/claude-max-api-proxy) - Use la suscripcion Claude Max/Pro como un endpoint de API compatible con OpenAI

Para el catalogo completo de proveedores (xAI, Groq, Mistral, etc.) y la configuracion avanzada,
consulte [Proveedores de modelos](/concepts/model-providers).
