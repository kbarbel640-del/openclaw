---
summary: "Notas do protocolo RPC para o assistente de integracao inicial e o esquema de configuracao"
read_when: "Ao alterar as etapas do assistente de integracao inicial ou os endpoints do esquema de configuracao"
title: "Integracao Inicial e Protocolo de Configuracao"
x-i18n:
  source_path: experiments/onboarding-config-protocol.md
  source_hash: 55163b3ee029c024
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:06Z
---

# Integracao Inicial + Protocolo de Configuracao

Objetivo: superficies compartilhadas de integracao inicial + configuracao entre CLI, app macOS e Web UI.

## Componentes

- Mecanismo do assistente (sessao compartilhada + prompts + estado de integracao inicial).
- A integracao inicial via CLI usa o mesmo fluxo de assistente que os clientes de UI.
- O Gateway RPC expõe endpoints do assistente + do esquema de configuracao.
- A integracao inicial no macOS usa o modelo de etapas do assistente.
- A Web UI renderiza formularios de configuracao a partir de JSON Schema + dicas de UI.

## Gateway RPC

- `wizard.start` params: `{ mode?: "local"|"remote", workspace?: string }`
- `wizard.next` params: `{ sessionId, answer?: { stepId, value? } }`
- `wizard.cancel` params: `{ sessionId }`
- `wizard.status` params: `{ sessionId }`
- `config.schema` params: `{}`

Respostas (formato)

- Assistente: `{ sessionId, done, step?, status?, error? }`
- Esquema de configuracao: `{ schema, uiHints, version, generatedAt }`

## Dicas de UI

- `uiHints` indexadas por caminho; metadados opcionais (label/help/group/order/advanced/sensitive/placeholder).
- Campos sensiveis sao renderizados como entradas de senha; sem camada de redacao.
- Nos de esquema nao suportados recorrem ao editor JSON bruto.

## Notas

- Este documento e o unico local para acompanhar refatoracoes de protocolo para integracao inicial/configuracao.
