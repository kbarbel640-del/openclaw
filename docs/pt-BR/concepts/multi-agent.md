---
summary: "Roteamento multiagente: agentes isolados, contas de canal e bindings"
title: Roteamento Multiagente
read_when: "Voce quer multiplos agentes isolados (workspaces + auth) em um unico processo do Gateway."
status: active
x-i18n:
  source_path: concepts/multi-agent.md
  source_hash: 49b3ba55d8a7f0b3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:07Z
---

# Roteamento Multiagente

Objetivo: multiplos agentes _isolados_ (workspace separado + `agentDir` + sessoes), alem de multiplas contas de canal (por exemplo, dois WhatsApps) em um Gateway em execucao. As entradas sao roteadas para um agente via bindings.

## O que e “um agente”?

Um **agente** e um cerebro totalmente escopado com seu proprio:

- **Workspace** (arquivos, AGENTS.md/SOUL.md/USER.md, notas locais, regras de persona).
- **Diretorio de estado** (`agentDir`) para perfis de auth, registro de modelos e configuracao por agente.
- **Armazenamento de sessoes** (historico de chat + estado de roteamento) sob `~/.openclaw/agents/<agentId>/sessions`.

Os perfis de auth sao **por agente**. Cada agente le do seu proprio:

```
~/.openclaw/agents/<agentId>/agent/auth-profiles.json
```

As credenciais do agente principal **nao** sao compartilhadas automaticamente. Nunca reutilize `agentDir`
entre agentes (isso causa colisoes de auth/sessao). Se voce quiser compartilhar credenciais,
copie `auth-profiles.json` para o `agentDir` do outro agente.

As Skills sao por agente via a pasta `skills/` de cada workspace, com skills compartilhadas
disponiveis em `~/.openclaw/skills`. Veja [Skills: por agente vs compartilhadas](/tools/skills#per-agent-vs-shared-skills).

O Gateway pode hospedar **um agente** (padrao) ou **varios agentes** lado a lado.

**Nota sobre workspace:** o workspace de cada agente e o **cwd padrao**, nao um
sandbox rigido. Caminhos relativos resolvem dentro do workspace, mas caminhos absolutos podem
alcançar outros locais do host a menos que o sandboxing esteja habilitado. Veja
[Sandboxing](/gateway/sandboxing).

## Caminhos (mapa rapido)

- Config: `~/.openclaw/openclaw.json` (ou `OPENCLAW_CONFIG_PATH`)
- Diretorio de estado: `~/.openclaw` (ou `OPENCLAW_STATE_DIR`)
- Workspace: `~/.openclaw/workspace` (ou `~/.openclaw/workspace-<agentId>`)
- Diretorio do agente: `~/.openclaw/agents/<agentId>/agent` (ou `agents.list[].agentDir`)
- Sessoes: `~/.openclaw/agents/<agentId>/sessions`

### Modo de agente unico (padrao)

Se voce nao fizer nada, o OpenClaw executa um unico agente:

- `agentId` padrao para **`main`**.
- As sessoes sao indexadas como `agent:main:<mainKey>`.
- O workspace padrao e `~/.openclaw/workspace` (ou `~/.openclaw/workspace-<profile>` quando `OPENCLAW_PROFILE` esta definido).
- O estado padrao e `~/.openclaw/agents/main/agent`.

## Assistente de agente

Use o assistente de agente para adicionar um novo agente isolado:

```bash
openclaw agents add work
```

Em seguida, adicione `bindings` (ou deixe o assistente fazer isso) para rotear mensagens de entrada.

Verifique com:

```bash
openclaw agents list --bindings
```

## Multiplos agentes = multiplas pessoas, multiplas personalidades

Com **multiplos agentes**, cada `agentId` se torna uma **persona totalmente isolada**:

- **Numeros de telefone/contas diferentes** (por `accountId` de canal).
- **Personalidades diferentes** (arquivos de workspace por agente como `AGENTS.md` e `SOUL.md`).
- **Auth + sessoes separadas** (sem interferencia cruzada, a menos que explicitamente habilitado).

Isso permite que **multiplas pessoas** compartilhem um unico servidor Gateway mantendo seus “cerebros” de IA e dados isolados.

## Um numero de WhatsApp, multiplas pessoas (divisao de DM)

Voce pode rotear **DMs diferentes do WhatsApp** para agentes diferentes permanecendo em **uma unica conta do WhatsApp**. Combine pelo remetente E.164 (como `+15551234567`) com `peer.kind: "dm"`. As respostas ainda saem do mesmo numero do WhatsApp (sem identidade de remetente por agente).

Detalhe importante: chats diretos colapsam para a **chave de sessao principal** do agente, entao o isolamento real requer **um agente por pessoa**.

Exemplo:

```json5
{
  agents: {
    list: [
      { id: "alex", workspace: "~/.openclaw/workspace-alex" },
      { id: "mia", workspace: "~/.openclaw/workspace-mia" },
    ],
  },
  bindings: [
    { agentId: "alex", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551230001" } } },
    { agentId: "mia", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551230002" } } },
  ],
  channels: {
    whatsapp: {
      dmPolicy: "allowlist",
      allowFrom: ["+15551230001", "+15551230002"],
    },
  },
}
```

Notas:

- O controle de acesso a DM e **global por conta do WhatsApp** (pareamento/lista de permissao), nao por agente.
- Para grupos compartilhados, vincule o grupo a um agente ou use [Grupos de broadcast](/broadcast-groups).

## Regras de roteamento (como as mensagens escolhem um agente)

Os bindings sao **deterministicos** e **o mais especifico vence**:

1. Correspondencia `peer` (DM/grupo/id de canal exato)
2. `guildId` (Discord)
3. `teamId` (Slack)
4. Correspondencia `accountId` para um canal
5. Correspondencia em nivel de canal (`accountId: "*"`)
6. Fallback para o agente padrao (`agents.list[].default`, senao a primeira entrada da lista, padrao: `main`)

## Multiplas contas / numeros de telefone

Canais que suportam **multiplas contas** (por exemplo, WhatsApp) usam `accountId` para identificar
cada login. Cada `accountId` pode ser roteado para um agente diferente, entao um unico servidor pode hospedar
multiplos numeros de telefone sem misturar sessoes.

## Conceitos

- `agentId`: um “cerebro” (workspace, auth por agente, armazenamento de sessoes por agente).
- `accountId`: uma instancia de conta de canal (por exemplo, conta do WhatsApp `"personal"` vs `"biz"`).
- `binding`: roteia mensagens de entrada para um `agentId` por `(channel, accountId, peer)` e, opcionalmente, ids de guild/team.
- Chats diretos colapsam para `agent:<agentId>:<mainKey>` (principal por agente; `session.mainKey`).

## Exemplo: dois WhatsApps → dois agentes

`~/.openclaw/openclaw.json` (JSON5):

```js
{
  agents: {
    list: [
      {
        id: "home",
        default: true,
        name: "Home",
        workspace: "~/.openclaw/workspace-home",
        agentDir: "~/.openclaw/agents/home/agent",
      },
      {
        id: "work",
        name: "Work",
        workspace: "~/.openclaw/workspace-work",
        agentDir: "~/.openclaw/agents/work/agent",
      },
    ],
  },

  // Deterministic routing: first match wins (most-specific first).
  bindings: [
    { agentId: "home", match: { channel: "whatsapp", accountId: "personal" } },
    { agentId: "work", match: { channel: "whatsapp", accountId: "biz" } },

    // Optional per-peer override (example: send a specific group to work agent).
    {
      agentId: "work",
      match: {
        channel: "whatsapp",
        accountId: "personal",
        peer: { kind: "group", id: "1203630...@g.us" },
      },
    },
  ],

  // Off by default: agent-to-agent messaging must be explicitly enabled + allowlisted.
  tools: {
    agentToAgent: {
      enabled: false,
      allow: ["home", "work"],
    },
  },

  channels: {
    whatsapp: {
      accounts: {
        personal: {
          // Optional override. Default: ~/.openclaw/credentials/whatsapp/personal
          // authDir: "~/.openclaw/credentials/whatsapp/personal",
        },
        biz: {
          // Optional override. Default: ~/.openclaw/credentials/whatsapp/biz
          // authDir: "~/.openclaw/credentials/whatsapp/biz",
        },
      },
    },
  },
}
```

## Exemplo: chat diario no WhatsApp + trabalho profundo no Telegram

Divida por canal: roteie WhatsApp para um agente rapido do dia a dia e Telegram para um agente Opus.

```json5
{
  agents: {
    list: [
      {
        id: "chat",
        name: "Everyday",
        workspace: "~/.openclaw/workspace-chat",
        model: "anthropic/claude-sonnet-4-5",
      },
      {
        id: "opus",
        name: "Deep Work",
        workspace: "~/.openclaw/workspace-opus",
        model: "anthropic/claude-opus-4-6",
      },
    ],
  },
  bindings: [
    { agentId: "chat", match: { channel: "whatsapp" } },
    { agentId: "opus", match: { channel: "telegram" } },
  ],
}
```

Notas:

- Se voce tiver multiplas contas para um canal, adicione `accountId` ao binding (por exemplo `{ channel: "whatsapp", accountId: "personal" }`).
- Para rotear uma unica DM/grupo para Opus mantendo o resto no chat, adicione um binding `match.peer` para esse peer; correspondencias de peer sempre vencem as regras em nivel de canal.

## Exemplo: mesmo canal, um peer para Opus

Mantenha o WhatsApp no agente rapido, mas roteie uma DM para Opus:

```json5
{
  agents: {
    list: [
      {
        id: "chat",
        name: "Everyday",
        workspace: "~/.openclaw/workspace-chat",
        model: "anthropic/claude-sonnet-4-5",
      },
      {
        id: "opus",
        name: "Deep Work",
        workspace: "~/.openclaw/workspace-opus",
        model: "anthropic/claude-opus-4-6",
      },
    ],
  },
  bindings: [
    { agentId: "opus", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551234567" } } },
    { agentId: "chat", match: { channel: "whatsapp" } },
  ],
}
```

Bindings de peer sempre vencem, entao mantenha-os acima da regra em nivel de canal.

## Agente da familia vinculado a um grupo do WhatsApp

Vincule um agente dedicado da familia a um unico grupo do WhatsApp, com controle por mencao
e uma politica de ferramentas mais restrita:

```json5
{
  agents: {
    list: [
      {
        id: "family",
        name: "Family",
        workspace: "~/.openclaw/workspace-family",
        identity: { name: "Family Bot" },
        groupChat: {
          mentionPatterns: ["@family", "@familybot", "@Family Bot"],
        },
        sandbox: {
          mode: "all",
          scope: "agent",
        },
        tools: {
          allow: [
            "exec",
            "read",
            "sessions_list",
            "sessions_history",
            "sessions_send",
            "sessions_spawn",
            "session_status",
          ],
          deny: ["write", "edit", "apply_patch", "browser", "canvas", "nodes", "cron"],
        },
      },
    ],
  },
  bindings: [
    {
      agentId: "family",
      match: {
        channel: "whatsapp",
        peer: { kind: "group", id: "120363999999999999@g.us" },
      },
    },
  ],
}
```

Notas:

- As listas de permitir/negar ferramentas sao **ferramentas**, nao skills. Se uma skill precisar executar um
  binario, garanta que `exec` esteja permitido e que o binario exista no sandbox.
- Para um controle mais rigoroso, defina `agents.list[].groupChat.mentionPatterns` e mantenha
  listas de permissao de grupo habilitadas para o canal.

## Sandbox e configuracao de ferramentas por agente

A partir da v2026.1.6, cada agente pode ter seu proprio sandbox e restricoes de ferramentas:

```js
{
  agents: {
    list: [
      {
        id: "personal",
        workspace: "~/.openclaw/workspace-personal",
        sandbox: {
          mode: "off",  // No sandbox for personal agent
        },
        // No tool restrictions - all tools available
      },
      {
        id: "family",
        workspace: "~/.openclaw/workspace-family",
        sandbox: {
          mode: "all",     // Always sandboxed
          scope: "agent",  // One container per agent
          docker: {
            // Optional one-time setup after container creation
            setupCommand: "apt-get update && apt-get install -y git curl",
          },
        },
        tools: {
          allow: ["read"],                    // Only read tool
          deny: ["exec", "write", "edit", "apply_patch"],    // Deny others
        },
      },
    ],
  },
}
```

Nota: `setupCommand` fica sob `sandbox.docker` e executa uma vez na criacao do container.
As substituicoes por agente de `sandbox.docker.*` sao ignoradas quando o escopo resolvido e `"shared"`.

**Beneficios:**

- **Isolamento de seguranca**: Restrinja ferramentas para agentes nao confiaveis
- **Controle de recursos**: Aplique sandbox a agentes especificos mantendo outros no host
- **Politicas flexiveis**: Permissoes diferentes por agente

Nota: `tools.elevated` e **global** e baseado no remetente; nao e configuravel por agente.
Se voce precisar de limites por agente, use `agents.list[].tools` para negar `exec`.
Para direcionamento de grupos, use `agents.list[].groupChat.mentionPatterns` para que @mencoes mapeiem corretamente para o agente pretendido.

Veja [Sandbox e Ferramentas Multiagente](/multi-agent-sandbox-tools) para exemplos detalhados.
