---
summary: "Adaptadores RPC para CLIs externas (signal-cli, imsg legado) e padrões de gateway"
read_when:
  - Adicionar ou alterar integrações de CLI externas
  - Depurar adaptadores RPC (signal-cli, imsg)
title: "Adaptadores RPC"
x-i18n:
  source_path: reference/rpc.md
  source_hash: 06dc6b97184cc704
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:11Z
---

# Adaptadores RPC

O OpenClaw integra CLIs externas via JSON-RPC. Dois padrões são usados atualmente.

## Padrão A: daemon HTTP (signal-cli)

- `signal-cli` roda como um daemon com JSON-RPC sobre HTTP.
- O fluxo de eventos é SSE (`/api/v1/events`).
- Sonda de saúde: `/api/v1/check`.
- O OpenClaw controla o ciclo de vida quando `channels.signal.autoStart=true`.

Veja [Signal](/channels/signal) para configuração e endpoints.

## Padrão B: processo filho via stdio (legado: imsg)

> **Nota:** Para novas configurações de iMessage, use [BlueBubbles](/channels/bluebubbles) em vez disso.

- O OpenClaw inicia `imsg rpc` como um processo filho (integração legada do iMessage).
- JSON-RPC é delimitado por linha via stdin/stdout (um objeto JSON por linha).
- Sem porta TCP, nenhum daemon necessário.

Métodos principais utilizados:

- `watch.subscribe` → notificações (`method: "message"`)
- `watch.unsubscribe`
- `send`
- `chats.list` (sonda/diagnóstico)

Veja [iMessage](/channels/imessage) para configuração legada e endereçamento (`chat_id` preferido).

## Diretrizes do adaptador

- O Gateway é responsável pelo processo (início/parada vinculados ao ciclo de vida do provedor).
- Mantenha clientes RPC resilientes: timeouts, reinício ao encerrar.
- Prefira IDs estáveis (por exemplo, `chat_id`) em vez de strings de exibição.
