---
summary: "Provedores de modelos (LLMs) suportados pelo OpenClaw"
read_when:
  - Voce quer escolher um provedor de modelos
  - Voce precisa de uma visao geral rapida dos backends de LLM suportados
title: "Provedores de Modelos"
x-i18n:
  source_path: providers/index.md
  source_hash: 84233de8ae3a39e0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:05Z
---

# Provedores de Modelos

O OpenClaw pode usar muitos provedores de LLM. Escolha um provedor, autentique-se e, em seguida, defina o
modelo padrao como `provider/model`.

Procurando documentacao de canais de chat (WhatsApp/Telegram/Discord/Slack/Mattermost (plugin)/etc.)? Veja [Canais](/channels).

## Destaque: Venice (Venice AI)

Venice e a nossa configuracao recomendada do Venice AI para inferencia com foco em privacidade, com opcao de usar Opus para tarefas dificeis.

- Padrao: `venice/llama-3.3-70b`
- Melhor no geral: `venice/claude-opus-45` (Opus continua sendo o mais forte)

Veja [Venice AI](/providers/venice).

## Inicio rapido

1. Autentique-se com o provedor (geralmente via `openclaw onboard`).
2. Defina o modelo padrao:

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## Documentacao dos provedores

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
- [Venice (Venice AI, com foco em privacidade)](/providers/venice)
- [Ollama (modelos locais)](/providers/ollama)

## Provedores de transcricao

- [Deepgram (transcricao de audio)](/providers/deepgram)

## Ferramentas da comunidade

- [Claude Max API Proxy](/providers/claude-max-api-proxy) - Use a assinatura Claude Max/Pro como um endpoint de API compativel com OpenAI

Para o catalogo completo de provedores (xAI, Groq, Mistral, etc.) e configuracao avancada,
veja [Provedores de modelos](/concepts/model-providers).
