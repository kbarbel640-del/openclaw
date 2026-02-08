---
summary: "Use a API unificada do OpenRouter para acessar muitos modelos no OpenClaw"
read_when:
  - Voce quer uma unica chave de API para muitos LLMs
  - Voce quer executar modelos via OpenRouter no OpenClaw
title: "OpenRouter"
x-i18n:
  source_path: providers/openrouter.md
  source_hash: b7e29fc9c456c64d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:09Z
---

# OpenRouter

O OpenRouter fornece uma **API unificada** que roteia solicitacoes para muitos modelos por tras de um unico
endpoint e chave de API. Ele e compativel com OpenAI, entao a maioria dos SDKs da OpenAI funciona ao trocar a URL base.

## Configuracao do CLI

```bash
openclaw onboard --auth-choice apiKey --token-provider openrouter --token "$OPENROUTER_API_KEY"
```

## Trecho de configuracao

```json5
{
  env: { OPENROUTER_API_KEY: "sk-or-..." },
  agents: {
    defaults: {
      model: { primary: "openrouter/anthropic/claude-sonnet-4-5" },
    },
  },
}
```

## Notas

- As referencias de modelo sao `openrouter/<provider>/<model>`.
- Para mais opcoes de modelo/provedor, veja [/concepts/model-providers](/concepts/model-providers).
- O OpenRouter usa um token Bearer com a sua chave de API nos bastidores.
