---
summary: "Comportamento de chat em grupo em diferentes superficies (WhatsApp/Telegram/Discord/Slack/Signal/iMessage/Microsoft Teams)"
read_when:
  - Alterando o comportamento de chats em grupo ou o controle por mencoes
title: "Grupos"
x-i18n:
  source_path: channels/groups.md
  source_hash: 5380e07ea01f4a8f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:28Z
---

# Grupos

O OpenClaw trata chats em grupo de forma consistente em diferentes superficies: WhatsApp, Telegram, Discord, Slack, Signal, iMessage, Microsoft Teams.

## Introducao para iniciantes (2 minutos)

O OpenClaw “vive” nas suas proprias contas de mensagens. Nao existe um usuario de bot separado no WhatsApp.
Se **voce** esta em um grupo, o OpenClaw pode ver esse grupo e responder ali.

Comportamento padrao:

- Grupos sao restritos (`groupPolicy: "allowlist"`).
- Respostas exigem uma mencao, a menos que voce desative explicitamente o controle por mencoes.

Traducao: remetentes permitidos podem acionar o OpenClaw ao menciona-lo.

> TL;DR
>
> - **Acesso por DM** e controlado por `*.allowFrom`.
> - **Acesso a grupos** e controlado por `*.groupPolicy` + listas de permissao (`*.groups`, `*.groupAllowFrom`).
> - **Disparo de respostas** e controlado pelo controle por mencoes (`requireMention`, `/activation`).

Fluxo rapido (o que acontece com uma mensagem de grupo):

```
groupPolicy? disabled -> drop
groupPolicy? allowlist -> group allowed? no -> drop
requireMention? yes -> mentioned? no -> store for context only
otherwise -> reply
```

![Fluxo de mensagens de grupo](/images/groups-flow.svg)

Se voce quiser...

| Objetivo                                              | O que configurar                                           |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| Permitir todos os grupos, mas responder so a @mencoes | `groups: { "*": { requireMention: true } }`                |
| Desativar todas as respostas em grupo                 | `groupPolicy: "disabled"`                                  |
| Apenas grupos especificos                             | `groups: { "<group-id>": { ... } }` (sem a chave `"*"`)    |
| Apenas voce pode acionar em grupos                    | `groupPolicy: "allowlist"`, `groupAllowFrom: ["+1555..."]` |

## Chaves de sessao

- Sessoes de grupo usam chaves de sessao `agent:<agentId>:<channel>:group:<id>` (salas/canais usam `agent:<agentId>:<channel>:channel:<id>`).
- Topicos de forum do Telegram adicionam `:topic:<threadId>` ao id do grupo, para que cada topico tenha sua propria sessao.
- Chats diretos usam a sessao principal (ou por remetente, se configurado).
- Heartbeats sao ignorados para sessoes de grupo.

## Padrao: DMs pessoais + grupos publicos (agente unico)

Sim — isso funciona bem se seu trafego “pessoal” sao **DMs** e seu trafego “publico” sao **grupos**.

Por que: no modo de agente unico, DMs normalmente caem na chave de sessao **principal** (`agent:main:main`), enquanto grupos sempre usam chaves de sessao **nao principais** (`agent:main:<channel>:group:<id>`). Se voce ativar sandboxing com `mode: "non-main"`, essas sessoes de grupo rodam no Docker enquanto sua sessao principal de DM permanece no host.

Isso lhe da um unico “cerebro” de agente (workspace + memoria compartilhados), mas duas posturas de execucao:

- **DMs**: ferramentas completas (host)
- **Grupos**: sandbox + ferramentas restritas (Docker)

> Se voce precisa de workspaces/personas realmente separadas (“pessoal” e “publico” nunca devem se misturar), use um segundo agente + vinculacoes. Veja [Roteamento Multi-Agente](/concepts/multi-agent).

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

Quer “grupos so podem ver a pasta X” em vez de “sem acesso ao host”? Mantenha `workspaceAccess: "none"` e monte apenas caminhos permitidos no sandbox:

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
- Depuracao de por que uma ferramenta esta bloqueada: [Sandbox vs Politica de Ferramentas vs Elevado](/gateway/sandbox-vs-tool-policy-vs-elevated)
- Detalhes de bind mounts: [Sandboxing](/gateway/sandboxing#custom-bind-mounts)

## Rotulos de exibicao

- Rotulos da UI usam `displayName` quando disponivel, formatados como `<channel>:<token>`.
- `#room` e reservado para salas/canais; chats em grupo usam `g-<slug>` (minusculo, espacos -> `-`, manter `#@+._-`).

## Politica de grupo

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

| Politica      | Comportamento                                                                  |
| ------------- | ------------------------------------------------------------------------------ |
| `"open"`      | Grupos ignoram listas de permissao; controle por mencoes ainda se aplica.      |
| `"disabled"`  | Bloqueia todas as mensagens de grupo completamente.                            |
| `"allowlist"` | Permite apenas grupos/salas que correspondem a lista de permissao configurada. |

Notas:

- `groupPolicy` e separado do controle por mencoes (que exige @mencoes).
- WhatsApp/Telegram/Signal/iMessage/Microsoft Teams: use `groupAllowFrom` (fallback: `allowFrom` explicito).
- Discord: a lista de permissao usa `channels.discord.guilds.<id>.channels`.
- Slack: a lista de permissao usa `channels.slack.channels`.
- Matrix: a lista de permissao usa `channels.matrix.groups` (IDs de sala, aliases ou nomes). Use `channels.matrix.groupAllowFrom` para restringir remetentes; listas de permissao por sala `users` tambem sao suportadas.
- DMs em grupo sao controladas separadamente (`channels.discord.dm.*`, `channels.slack.dm.*`).
- A lista de permissao do Telegram pode corresponder a IDs de usuario (`"123456789"`, `"telegram:123456789"`, `"tg:123456789"`) ou nomes de usuario (`"@alice"` ou `"alice"`); prefixos nao diferenciam maiusculas/minusculas.
- O padrao e `groupPolicy: "allowlist"`; se sua lista de permissao de grupos estiver vazia, mensagens de grupo sao bloqueadas.

Modelo mental rapido (ordem de avaliacao para mensagens de grupo):

1. `groupPolicy` (aberto/desativado/lista de permissao)
2. listas de permissao de grupo (`*.groups`, `*.groupAllowFrom`, lista de permissao especifica do canal)
3. controle por mencoes (`requireMention`, `/activation`)

## Controle por mencoes (padrao)

Mensagens em grupo exigem uma mencao, a menos que seja substituido por grupo. Os padroes vivem por subsistema em `*.groups."*"`.

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

- `mentionPatterns` sao regexes que nao diferenciam maiusculas/minusculas.
- Superficies que fornecem mencoes explicitas ainda passam; os padroes sao um fallback.
- Substituicao por agente: `agents.list[].groupChat.mentionPatterns` (util quando varios agentes compartilham um grupo).
- O controle por mencoes so e aplicado quando a deteccao de mencoes e possivel (mencoes nativas ou `mentionPatterns` configurados).
- Padroes do Discord vivem em `channels.discord.guilds."*"` (substituiveis por guild/canal).
- O contexto de historico de grupo e encapsulado de forma uniforme entre canais e e **apenas pendente** (mensagens ignoradas devido ao controle por mencoes); use `messages.groupChat.historyLimit` para o padrao global e `channels.<channel>.historyLimit` (ou `channels.<channel>.accounts.*.historyLimit`) para substituicoes. Defina `0` para desativar.

## Restricoes de ferramentas por grupo/canal (opcional)

Algumas configuracoes de canal suportam restringir quais ferramentas estao disponiveis **dentro de um grupo/sala/canal especifico**.

- `tools`: permitir/negar ferramentas para todo o grupo.
- `toolsBySender`: substituicoes por remetente dentro do grupo (as chaves sao IDs de remetente/nomes de usuario/emails/numeros de telefone, dependendo do canal). Use `"*"` como curinga.

Ordem de resolucao (o mais especifico vence):

1. correspondencia de `toolsBySender` do grupo/canal
2. `tools` do grupo/canal
3. padrao (`"*"`) correspondencia de `toolsBySender`
4. padrao (`"*"`) `tools`

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

- Restricoes de ferramentas por grupo/canal sao aplicadas alem da politica global/de agente de ferramentas (negar ainda vence).
- Alguns canais usam aninhamento diferente para salas/canais (por exemplo, Discord `guilds.*.channels.*`, Slack `channels.*`, MS Teams `teams.*.channels.*`).

## Listas de permissao de grupo

Quando `channels.whatsapp.groups`, `channels.telegram.groups` ou `channels.imessage.groups` e configurado, as chaves atuam como uma lista de permissao de grupo. Use `"*"` para permitir todos os grupos enquanto ainda define o comportamento padrao de mencoes.

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

4. Apenas o proprietario pode acionar em grupos (WhatsApp)

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

## Ativacao (somente proprietario)

Proprietarios de grupo podem alternar a ativacao por grupo:

- `/activation mention`
- `/activation always`

O proprietario e determinado por `channels.whatsapp.allowFrom` (ou o E.164 do proprio bot quando nao definido). Envie o comando como uma mensagem isolada. Outras superficies atualmente ignoram `/activation`.

## Campos de contexto

Payloads de entrada de grupo definem:

- `ChatType=group`
- `GroupSubject` (se conhecido)
- `GroupMembers` (se conhecido)
- `WasMentioned` (resultado do controle por mencoes)
- Topicos de forum do Telegram tambem incluem `MessageThreadId` e `IsForum`.

O prompt de sistema do agente inclui uma introducao de grupo no primeiro turno de uma nova sessao de grupo. Ele lembra o modelo de responder como um humano, evitar tabelas em Markdown e evitar digitar sequencias literais `\n`.

## Especificidades do iMessage

- Prefira `chat_id:<id>` ao rotear ou criar listas de permissao.
- Listar chats: `imsg chats --limit 20`.
- Respostas em grupo sempre voltam para o mesmo `chat_id`.

## Especificidades do WhatsApp

Veja [Mensagens de grupo](/channels/group-messages) para comportamento exclusivo do WhatsApp (injecao de historico, detalhes de tratamento de mencoes).
