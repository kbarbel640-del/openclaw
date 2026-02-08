---
summary: "Regras de roteamento por canal (WhatsApp, Telegram, Discord, Slack) e contexto compartilhado"
read_when:
  - Ao alterar o roteamento de canais ou o comportamento da caixa de entrada
title: "Roteamento de Canais"
x-i18n:
  source_path: concepts/channel-routing.md
  source_hash: 1a322b5187e32c82
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:51Z
---

# Canais e roteamento

O OpenClaw roteia as respostas **de volta para o canal de onde a mensagem veio**. O
modelo não escolhe um canal; o roteamento é determinístico e controlado pela
configuração do host.

## Termos principais

- **Canal**: `whatsapp`, `telegram`, `discord`, `slack`, `signal`, `imessage`, `webchat`.
- **AccountId**: instância de conta por canal (quando suportado).
- **AgentId**: um workspace isolado + armazenamento de sessões (“cérebro”).
- **SessionKey**: a chave de bucket usada para armazenar contexto e controlar concorrência.

## Formatos de chave de sessão (exemplos)

Mensagens diretas colapsam para a sessão **principal** do agente:

- `agent:<agentId>:<mainKey>` (padrão: `agent:main:main`)

Grupos e canais permanecem isolados por canal:

- Grupos: `agent:<agentId>:<channel>:group:<id>`
- Canais/salas: `agent:<agentId>:<channel>:channel:<id>`

Tópicos:

- Tópicos do Slack/Discord adicionam `:thread:<threadId>` à chave base.
- Tópicos de fórum do Telegram incorporam `:topic:<topicId>` na chave do grupo.

Exemplos:

- `agent:main:telegram:group:-1001234567890:topic:42`
- `agent:main:discord:channel:123456:thread:987654`

## Regras de roteamento (como um agente é escolhido)

O roteamento escolhe **um agente** para cada mensagem de entrada:

1. **Correspondência exata de par** (`bindings` com `peer.kind` + `peer.id`).
2. **Correspondência de guilda** (Discord) via `guildId`.
3. **Correspondência de equipe** (Slack) via `teamId`.
4. **Correspondência de conta** (`accountId` no canal).
5. **Correspondência de canal** (qualquer conta naquele canal).
6. **Agente padrão** (`agents.list[].default`, caso contrário a primeira entrada da lista, com fallback para `main`).

O agente correspondente determina qual workspace e armazenamento de sessões são usados.

## Grupos de broadcast (executar vários agentes)

Grupos de broadcast permitem executar **vários agentes** para o mesmo par **quando o OpenClaw normalmente responderia** (por exemplo: em grupos do WhatsApp, após gating de menção/ativação).

Configuração:

```json5
{
  broadcast: {
    strategy: "parallel",
    "120363403215116621@g.us": ["alfred", "baerbel"],
    "+15555550123": ["support", "logger"],
  },
}
```

Veja: [Grupos de Broadcast](/broadcast-groups).

## Visão geral da configuração

- `agents.list`: definições de agentes nomeadas (workspace, modelo, etc.).
- `bindings`: mapeia canais/contas/pares de entrada para agentes.

Exemplo:

```json5
{
  agents: {
    list: [{ id: "support", name: "Support", workspace: "~/.openclaw/workspace-support" }],
  },
  bindings: [
    { match: { channel: "slack", teamId: "T123" }, agentId: "support" },
    { match: { channel: "telegram", peer: { kind: "group", id: "-100123" } }, agentId: "support" },
  ],
}
```

## Armazenamento de sessão

Os armazenamentos de sessão ficam sob o diretório de estado (padrão `~/.openclaw`):

- `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- Transcrições JSONL ficam ao lado do armazenamento

Você pode substituir o caminho do armazenamento via `session.store` e a templating `{agentId}`.

## Comportamento do WebChat

O WebChat se conecta ao **agente selecionado** e, por padrão, à sessão principal do agente. Por causa disso, o WebChat permite que você veja o contexto entre canais para esse agente em um só lugar.

## Contexto de resposta

As respostas de entrada incluem:

- `ReplyToId`, `ReplyToBody` e `ReplyToSender` quando disponíveis.
- O contexto citado é anexado a `Body` como um bloco `[Replying to ...]`.

Isso é consistente entre os canais.
