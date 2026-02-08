---
summary: "Use Z.AI (modelos GLM) com OpenClaw"
read_when:
  - Voce quer modelos Z.AI / GLM no OpenClaw
  - Voce precisa de uma configuracao simples de ZAI_API_KEY
title: "Z.AI"
x-i18n:
  source_path: providers/zai.md
  source_hash: 2c24bbad86cf86c3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:11Z
---

# Z.AI

Z.AI e a plataforma de API para modelos **GLM**. Ela fornece APIs REST para GLM e usa chaves de API
para autenticacao. Crie sua chave de API no console da Z.AI. O OpenClaw usa o provedor `zai`
com uma chave de API da Z.AI.

## Configuracao do CLI

```bash
openclaw onboard --auth-choice zai-api-key
# or non-interactive
openclaw onboard --zai-api-key "$ZAI_API_KEY"
```

## Trecho de configuracao

```json5
{
  env: { ZAI_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "zai/glm-4.7" } } },
}
```

## Notas

- Os modelos GLM estao disponiveis como `zai/<model>` (exemplo: `zai/glm-4.7`).
- Veja [/providers/glm](/providers/glm) para a visao geral da familia de modelos.
- Z.AI usa autenticacao Bearer com sua chave de API.
