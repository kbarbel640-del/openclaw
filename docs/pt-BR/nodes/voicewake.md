---
summary: "Palavras de ativacao por voz globais (de propriedade do Gateway) e como elas sincronizam entre os nodes"
read_when:
  - Alterar o comportamento ou os padroes das palavras de ativacao por voz
  - Adicionar novas plataformas de node que precisam de sincronizacao de palavras de ativacao
title: "Ativacao por Voz"
x-i18n:
  source_path: nodes/voicewake.md
  source_hash: eb34f52dfcdc3fc1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:45Z
---

# Ativacao por Voz (Palavras de Ativacao Globais)

O OpenClaw trata **palavras de ativacao como uma unica lista global** de propriedade do **Gateway**.

- **Nao ha palavras de ativacao personalizadas por node**.
- **Qualquer UI de node/app pode editar** a lista; as alteracoes sao persistidas pelo Gateway e transmitidas para todos.
- Cada dispositivo ainda mantem seu proprio alternador **Ativacao por Voz ativada/desativada** (UX local + permissoes diferem).

## Armazenamento (host do Gateway)

As palavras de ativacao sao armazenadas na maquina do gateway em:

- `~/.openclaw/settings/voicewake.json`

Formato:

```json
{ "triggers": ["openclaw", "claude", "computer"], "updatedAtMs": 1730000000000 }
```

## Protocolo

### Metodos

- `voicewake.get` → `{ triggers: string[] }`
- `voicewake.set` com parametros `{ triggers: string[] }` → `{ triggers: string[] }`

Observacoes:

- Os gatilhos sao normalizados (espacos removidos, vazios descartados). Listas vazias retornam aos padroes.
- Limites sao aplicados por seguranca (limites de quantidade/comprimento).

### Eventos

- `voicewake.changed` payload `{ triggers: string[] }`

Quem recebe:

- Todos os clientes WebSocket (app macOS, WebChat, etc.)
- Todos os nodes conectados (iOS/Android) e tambem no momento da conexao do node como um envio inicial do “estado atual”.

## Comportamento do cliente

### App macOS

- Usa a lista global para controlar gatilhos de `VoiceWakeRuntime`.
- Editar “Palavras de gatilho” nas configuracoes de Ativacao por Voz chama `voicewake.set` e entao depende da transmissao para manter outros clientes sincronizados.

### Node iOS

- Usa a lista global para deteccao de gatilhos de `VoiceWakeManager`.
- Editar Palavras de Ativacao em Configuracoes chama `voicewake.set` (via WS do Gateway) e tambem mantem a deteccao local de palavras de ativacao responsiva.

### Node Android

- Exibe um editor de Palavras de Ativacao em Configuracoes.
- Chama `voicewake.set` via WS do Gateway para que as edicoes sincronizem em todos os lugares.
