---
summary: "Provedores de modelo (LLMs) compatíveis com o OpenClaw"
read_when:
  - Voce quer escolher um provedor de modelo
  - Voce quer exemplos rapidos de configuracao para autenticacao de LLM + selecao de modelo
title: "Inicio Rapido de Provedores de Modelo"
x-i18n:
  source_path: providers/models.md
  source_hash: c897ca87805f1ec5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:02Z
---

# Provedores de Modelo

O OpenClaw pode usar muitos provedores de LLM. Escolha um, autentique e depois defina o
modelo padrao como `provider/model`.

## Destaque: Venice (Venice AI)

Venice e nossa configuracao recomendada do Venice AI para inferencia com foco em privacidade, com a opcao de usar Opus para as tarefas mais dificeis.

- Padrao: `venice/llama-3.3-70b`
- Melhor no geral: `venice/claude-opus-45` (Opus continua sendo o mais forte)

Veja [Venice AI](/providers/venice).

## Inicio rapido (dois passos)

1. Autentique-se com o provedor (geralmente via `openclaw onboard`).
2. Defina o modelo padrao:

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## Provedores suportados (conjunto inicial)

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

Para o catalogo completo de provedores (xAI, Groq, Mistral, etc.) e configuracao avancada,
veja [Provedores de modelo](/concepts/model-providers).
