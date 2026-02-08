---
summary: "Use o Xiaomi MiMo (mimo-v2-flash) com o OpenClaw"
read_when:
  - Voce quer modelos Xiaomi MiMo no OpenClaw
  - Voce precisa da configuracao do XIAOMI_API_KEY
title: "Xiaomi MiMo"
x-i18n:
  source_path: providers/xiaomi.md
  source_hash: 366fd2297b2caf8c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:10Z
---

# Xiaomi MiMo

Xiaomi MiMo é a plataforma de API para modelos **MiMo**. Ela fornece APIs REST compatíveis com os
formatos OpenAI e Anthropic e usa chaves de API para autenticacao. Crie sua chave de API no
[console do Xiaomi MiMo](https://platform.xiaomimimo.com/#/console/api-keys). O OpenClaw usa
o provedor `xiaomi` com uma chave de API do Xiaomi MiMo.

## Visao geral do modelo

- **mimo-v2-flash**: janela de contexto de 262144 tokens, compatível com a Anthropic Messages API.
- URL base: `https://api.xiaomimimo.com/anthropic`
- Autorizacao: `Bearer $XIAOMI_API_KEY`

## Configuracao do CLI

```bash
openclaw onboard --auth-choice xiaomi-api-key
# or non-interactive
openclaw onboard --auth-choice xiaomi-api-key --xiaomi-api-key "$XIAOMI_API_KEY"
```

## Trecho de configuracao

```json5
{
  env: { XIAOMI_API_KEY: "your-key" },
  agents: { defaults: { model: { primary: "xiaomi/mimo-v2-flash" } } },
  models: {
    mode: "merge",
    providers: {
      xiaomi: {
        baseUrl: "https://api.xiaomimimo.com/anthropic",
        api: "anthropic-messages",
        apiKey: "XIAOMI_API_KEY",
        models: [
          {
            id: "mimo-v2-flash",
            name: "Xiaomi MiMo V2 Flash",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 262144,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

## Observacoes

- Referencia do modelo: `xiaomi/mimo-v2-flash`.
- O provedor e injetado automaticamente quando `XIAOMI_API_KEY` esta definido (ou quando existe um perfil de autenticacao).
- Veja [/concepts/model-providers](/concepts/model-providers) para mais detalhes sobre as regras de provedores.
