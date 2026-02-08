---
summary: "Visão geral da família de modelos GLM + como usá-los no OpenClaw"
read_when:
  - Você quer modelos GLM no OpenClaw
  - Você precisa da convenção de nomes dos modelos e da configuração
title: "Modelos GLM"
x-i18n:
  source_path: providers/glm.md
  source_hash: 2d7b457f033f26f2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:06Z
---

# Modelos GLM

GLM é uma **família de modelos** (não uma empresa) disponível por meio da plataforma Z.AI. No OpenClaw, os modelos GLM são acessados via o provedor `zai` e IDs de modelo como `zai/glm-4.7`.

## Configuração da CLI

```bash
openclaw onboard --auth-choice zai-api-key
```

## Trecho de configuração

```json5
{
  env: { ZAI_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "zai/glm-4.7" } } },
}
```

## Notas

- As versões e a disponibilidade do GLM podem mudar; verifique a documentação da Z.AI para obter as informações mais recentes.
- Exemplos de IDs de modelo incluem `glm-4.7` e `glm-4.6`.
- Para detalhes do provedor, veja [/providers/zai](/providers/zai).
