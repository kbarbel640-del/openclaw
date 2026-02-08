---
summary: "Comportamento de chat em grupo entre superficies (WhatsApp/Telegram/Discord/Slack/Signal/iMessage/Microsoft Teams)"
read_when:
  - Alterar o comportamento de chats em grupo ou o gating por mencao
title: "Grupos"
x-i18n:
  source_path: concepts/groups.md
  source_hash: b727a053edf51f6e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:09Z
---

# Grupos

O OpenClaw trata chats em grupo de forma consistente entre superficies: WhatsApp, Telegram, Discord, Slack, Signal, iMessage, Microsoft Teams.

## Introducao para iniciantes (2 minutos)

O OpenClaw “vive” nas suas proprias contas de mensagens. Nao existe um usuario de bot separado no WhatsApp.
Se **voce** esta em um grupo, o OpenClaw pode ver esse grupo e responder ali.

Comportamento padrao:

- Grupos sao restritos (`groupPolicy: "allowlist"`).
- Respostas exigem uma mencao, a menos que voce desative explicitamente o gating por mencao.

Traducao: remetentes na allowlist podem acionar o OpenClaw mencionando-o.

> TL;DR
>
> - **Acesso a DMs** e controlado por `*.allowFrom`.
> - **Acesso a grupos** e controlado por `*.groupPolicy` + allowlists (`*.groups`, `*.groupAllowFrom`).
> - **Disparo de respostas** e controlado pelo gating por mencao (`requireMention`, `/activation`).

Fluxo rapido (o que acontece com uma mensagem de grupo):

```
groupPolicy? disabled -> drop
groupPolicy? allowlist -> group allowed? no -> drop
requireMention? yes -> mentioned? no -> store for context only
otherwise -> reply
```

![Fluxo de mensagem de grupo](/images/groups-flow.svg)

Se voce quiser...
| Objetivo | O que configurar |
|------|-------------|
| Permitir todos os grupos, mas responder apenas a @mencoes | `groups: { "*": { requireMention: true } }` |
| Desativar todas as respostas em grupo | `groupPolicy: "disabled"` |
| Apenas grupos especificos | `groups: { "<group-id>": { ... } }` (sem a chave `"*"`) |
| Apenas voce pode acionar em grupos | `groupPolicy: "allowlist"`, `groupAllowFrom: ["+1555..."]` |

## Chaves de sessao

- Sessoes de grupo usam chaves de sessao `agent:<agentId>:<channel>:group:<id>` (salas/canais usam `agent:<agentId>:<channel>:channel:<id>`).
- Topicos de forum do Telegram adicionam `:topic:<threadId>` ao id do grupo, para que cada topico tenha sua propria sessao.
- Chats diretos usam a sessao principal (ou por remetente, se configurado).
- Heartbeats sao ignorados para sessoes de grupo.

## Padrao: DMs pessoais + grupos publicos (agente unico)

Sim — isso funciona bem se seu trafego “pessoal” for **DMs** e seu trafego “publico” for **grupos**.

Por que: no modo de agente unico, DMs normalmente caem na chave de sessao **principal** (`agent:main:main`), enquanto grupos sempre usam chaves de sessao **nao principais** (`agent:main:<channel>:group:<id>`). Se voce ativar sandboxing com `mode: "non-main"`, essas sessoes de grupo rodam no Docker enquanto sua sessao principal de DMs permanece no host.

Isso lhe da um “cerebro” de agente (workspace + memoria compartilhados), mas duas posturas de execucao:

- **DMs**: ferramentas completas (host)
- **Grupos**: sandbox + ferramentas restritas (Docker)

> Se voce precisar de workspaces/personas realmente separados (“pessoal” e “publico” nunca devem se misturar), use um segundo agente + bindings. Veja [Roteamento Multi-Agente](/concepts/multi-agent).

Exemplo (DMs no host, grupos em sandbox + ferramentas apenas de mensagens):

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main", // groups/channels are non-main -> sandboxed
        scope: "session", // strongest isolation (one container per group/channel)
        workspaceAccess: "none",
      },
    },
  },
  tools: {
    sandbox: {
      tools: {
        // If allow is non-empty, everything else is blocked (deny still wins).
        allow: ["group:messaging", "group:sessions"],
        deny: ["group:runtime", "group:fs", "group:ui", "nodes", "cron", "gateway"],
      },
    },
  },
}
```

Quer “grupos so podem ver a pasta X” em vez de “sem acesso ao host”? Mantenha `workspaceAccess: "none"` e monte apenas caminhos na allowlist dentro do sandbox:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        scope: "session",
        workspaceAccess: "none",
        docker: {
          binds: [
            // hostPath:containerPath:mode
            "~/FriendsShared:/data:ro",
          ],
        },
      },
    },
  },
}
```

Relacionado:

- Chaves de configuracao e padroes: [Configuracao do Gateway](/gateway/configuration#agentsdefaultssandbox)
- Depurando por que uma ferramenta esta bloqueada: [Sandbox vs Politica de Ferramentas vs Elevado](/gateway/sandbox-vs-tool-policy-vs-elevated)
- Detalhes de bind mounts: [Sandboxing](/gateway/sandboxing#custom-bind-mounts)

## Rotulos de exibicao

- Rotulos da UI usam `displayName` quando disponivel, formatado como `<channel>:<token>`.
- `#room` e reservado para salas/canais; chats em grupo usam `g-<slug>` (minusculas, espacos -> `-`, manter `#@+._-`).

## Politica de grupos

Controle como mensagens de grupo/sala sao tratadas por canal:

```json5
{
  channels: {
    whatsapp: {
      groupPolicy: "disabled", // "open" | "disabled" | "allowlist"
      groupAllowFrom: ["+15551234567"],
    },
    telegram: {
      groupPolicy: "disabled",
      groupAllowFrom: ["123456789", "@username"],
    },
    signal: {
      groupPolicy: "disabled",
      groupAllowFrom: ["+15551234567"],
    },
    imessage: {
      groupPolicy: "disabled",
      groupAllowFrom: ["chat_id:123"],
    },
    msteams: {
      groupPolicy: "disabled",
      groupAllowFrom: ["user@org.com"],
    },
    discord: {
      groupPolicy: "allowlist",
      guilds: {
        GUILD_ID: { channels: { help: { allow: true } } },
      },
    },
    slack: {
      groupPolicy: "allowlist",
      channels: { "#general": { allow: true } },
    },
    matrix: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["@owner:example.org"],
      groups: {
        "!roomId:example.org": { allow: true },
        "#alias:example.org": { allow: true },
      },
    },
  },
}
```

| Politica      | Comportamento                                                         |
| ------------- | --------------------------------------------------------------------- |
| `"open"`      | Grupos ignoram allowlists; o gating por mencao ainda se aplica.       |
| `"disabled"`  | Bloqueia totalmente todas as mensagens de grupo.                      |
| `"allowlist"` | Permite apenas grupos/salas que correspondem a allowlist configurada. |

Notas:

- `groupPolicy` e separado do gating por mencao (que exige @mencoes).
- WhatsApp/Telegram/Signal/iMessage/Microsoft Teams: use `groupAllowFrom` (fallback: `allowFrom` explicito).
- Discord: a allowlist usa `channels.discord.guilds.<id>.channels`.
- Slack: a allowlist usa `channels.slack.channels`.
- Matrix: a allowlist usa `channels.matrix.groups` (IDs de sala, aliases ou nomes). Use `channels.matrix.groupAllowFrom` para restringir remetentes; allowlists por sala `users` tambem sao suportadas.
- DMs de grupo sao controladas separadamente (`channels.discord.dm.*`, `channels.slack.dm.*`).
- A allowlist do Telegram pode corresponder a IDs de usuario (`"123456789"`, `"telegram:123456789"`, `"tg:123456789"`) ou usernames (`"@alice"` ou `"alice"`); prefixos nao diferenciam maiusculas/minusculas.
- O padrao e `groupPolicy: "allowlist"`; se sua allowlist de grupos estiver vazia, mensagens de grupo sao bloqueadas.

Modelo mental rapido (ordem de avaliacao para mensagens de grupo):

1. `groupPolicy` (aberto/desativado/allowlist)
2. allowlists de grupo (`*.groups`, `*.groupAllowFrom`, allowlist especifica do canal)
3. gating por mencao (`requireMention`, `/activation`)

## Gating por mencao (padrao)

Mensagens de grupo exigem uma mencao, a menos que sejam substituidas por grupo. Os padroes vivem por subsistema em `*.groups."*"`.

Responder a uma mensagem do bot conta como uma mencao implicita (quando o canal suporta metadados de resposta). Isso se aplica a Telegram, WhatsApp, Slack, Discord e Microsoft Teams.

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "*": { requireMention: true },
        "123@g.us": { requireMention: false },
      },
    },
    telegram: {
      groups: {
        "*": { requireMention: true },
        "123456789": { requireMention: false },
      },
    },
    imessage: {
      groups: {
        "*": { requireMention: true },
        "123": { requireMention: false },
      },
    },
  },
  agents: {
    list: [
      {
        id: "main",
        groupChat: {
          mentionPatterns: ["@openclaw", "openclaw", "\\+15555550123"],
          historyLimit: 50,
        },
      },
    ],
  },
}
```

Notas:

- `mentionPatterns` sao regexes case-insensitive.
- Superficies que fornecem mencoes explicitas ainda passam; os padroes sao um fallback.
- Substituicao por agente: `agents.list[].groupChat.mentionPatterns` (util quando varios agentes compartilham um grupo).
- O gating por mencao so e aplicado quando a deteccao de mencao e possivel (mencoes nativas ou `mentionPatterns` configurado).
- Os padroes do Discord vivem em `channels.discord.guilds."*"` (substituiveis por guild/canal).
- O contexto do historico de grupo e encapsulado de forma uniforme entre canais e e **somente pendente** (mensagens ignoradas devido ao gating por mencao); use `messages.groupChat.historyLimit` para o padrao global e `channels.<channel>.historyLimit` (ou `channels.<channel>.accounts.*.historyLimit`) para substituicoes. Defina `0` para desativar.

## Restricoes de ferramentas por grupo/canal (opcional)

Algumas configuracoes de canal suportam restringir quais ferramentas estao disponiveis **dentro de um grupo/sala/canal especifico**.

- `tools`: permitir/negar ferramentas para todo o grupo.
- `toolsBySender`: substituicoes por remetente dentro do grupo (as chaves sao IDs de remetente/usernames/emails/numeros de telefone, dependendo do canal). Use `"*"` como curinga.

Ordem de resolucao (o mais especifico vence):

1. correspondencia `toolsBySender` de grupo/canal
2. `tools` de grupo/canal
3. correspondencia `toolsBySender` do padrao (`"*"`)
4. `tools` do padrao (`"*"`)

Exemplo (Telegram):

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { tools: { deny: ["exec"] } },
        "-1001234567890": {
          tools: { deny: ["exec", "read", "write"] },
          toolsBySender: {
            "123456789": { alsoAllow: ["exec"] },
          },
        },
      },
    },
  },
}
```

Notas:

- Restricoes de ferramentas por grupo/canal sao aplicadas alem da politica global/do agente (negacao ainda vence).
- Alguns canais usam aninhamento diferente para salas/canais (ex.: Discord `guilds.*.channels.*`, Slack `channels.*`, MS Teams `teams.*.channels.*`).

## Allowlists de grupo

Quando `channels.whatsapp.groups`, `channels.telegram.groups` ou `channels.imessage.groups` esta configurado, as chaves atuam como uma allowlist de grupo. Use `"*"` para permitir todos os grupos enquanto ainda define o comportamento padrao de mencao.

Intencoes comuns (copiar/colar):

1. Desativar todas as respostas em grupo

```json5
{
  channels: { whatsapp: { groupPolicy: "disabled" } },
}
```

2. Permitir apenas grupos especificos (WhatsApp)

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "123@g.us": { requireMention: true },
        "456@g.us": { requireMention: false },
      },
    },
  },
}
```

3. Permitir todos os grupos, mas exigir mencao (explicito)

```json5
{
  channels: {
    whatsapp: {
      groups: { "*": { requireMention: true } },
    },
  },
}
```

4. Apenas o dono pode acionar em grupos (WhatsApp)

```json5
{
  channels: {
    whatsapp: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15551234567"],
      groups: { "*": { requireMention: true } },
    },
  },
}
```

## Ativacao (apenas dono)

Donos de grupos podem alternar a ativacao por grupo:

- `/activation mention`
- `/activation always`

O dono e determinado por `channels.whatsapp.allowFrom` (ou o E.164 do proprio bot quando nao definido). Envie o comando como uma mensagem isolada. Outras superficies atualmente ignoram `/activation`.

## Campos de contexto

Payloads de entrada de grupo definem:

- `ChatType=group`
- `GroupSubject` (se conhecido)
- `GroupMembers` (se conhecido)
- `WasMentioned` (resultado do gating por mencao)
- Topicos de forum do Telegram tambem incluem `MessageThreadId` e `IsForum`.

O prompt de sistema do agente inclui uma introducao de grupo no primeiro turno de uma nova sessao de grupo. Ele lembra o modelo de responder como um humano, evitar tabelas Markdown e evitar digitar sequencias literais `\n`.

## Especificos do iMessage

- Prefira `chat_id:<id>` ao rotear ou criar allowlists.
- Listar chats: `imsg chats --limit 20`.
- Respostas em grupo sempre retornam para o mesmo `chat_id`.

## Especificos do WhatsApp

Veja [Mensagens de grupo](/concepts/group-messages) para o comportamento exclusivo do WhatsApp (injecao de historico, detalhes de tratamento de mencoes).
