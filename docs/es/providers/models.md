---
summary: "Proveedores de modelos (LLMs) compatibles con OpenClaw"
read_when:
  - Quiere elegir un proveedor de modelos
  - Quiere ejemplos de configuracion rapida para autenticacion de LLM + seleccion de modelo
title: "Inicio Rapido del Proveedor de Modelos"
x-i18n:
  source_path: providers/models.md
  source_hash: c897ca87805f1ec5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:38Z
---

# Proveedores de modelos

OpenClaw puede usar muchos proveedores de LLM. Elija uno, autentíquese y luego establezca el
modelo predeterminado como `provider/model`.

## Destacado: Venice (Venice AI)

Venice es nuestra configuracion recomendada de Venice AI para inferencia con prioridad en la privacidad, con la opcion de usar Opus para las tareas mas exigentes.

- Predeterminado: `venice/llama-3.3-70b`
- Mejor en general: `venice/claude-opus-45` (Opus sigue siendo el mas potente)

Vea [Venice AI](/providers/venice).

## Inicio rapido (dos pasos)

1. Autentíquese con el proveedor (generalmente mediante `openclaw onboard`).
2. Establezca el modelo predeterminado:

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## Proveedores compatibles (conjunto inicial)

- [OpenAI (API + Codex)](/providers/openai)
- [Anthropic (API + Claude Code CLI)](/providers/anthropic)
- [OpenRouter](/providers/openrouter)
- [Vercel AI Gateway](/providers/vercel-ai-gateway)
- [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)
- [Moonshot AI (Kimi + Kimi Coding)](/providers/moonshot)
- [Synthetic](/providers/synthetic)
- [OpenCode Zen](/providers/opencode)
- [Z.AI](/providers/zai)
- [Modelos GLM](/providers/glm)
- [MiniMax](/providers/minimax)
- [Venice (Venice AI)](/providers/venice)
- [Amazon Bedrock](/bedrock)

Para el catalogo completo de proveedores (xAI, Groq, Mistral, etc.) y la configuracion avanzada,
vea [Proveedores de modelos](/concepts/model-providers).
