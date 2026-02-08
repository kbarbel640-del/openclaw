---
summary: "Visão geral do bot Feishu, recursos e configuração"
read_when:
  - Você quer conectar um bot Feishu/Lark
  - Você está configurando o canal Feishu
title: Feishu
x-i18n:
  source_path: channels/feishu.md
  source_hash: fd2c93ebb6dbeabf
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:30Z
---

# Bot Feishu

Feishu (Lark) é uma plataforma de chat corporativo usada por empresas para mensagens e colaboração. Este plugin conecta o OpenClaw a um bot Feishu/Lark usando a assinatura de eventos via WebSocket da plataforma, para que as mensagens possam ser recebidas sem expor uma URL pública de webhook.

---

## Plugin necessário

Instale o plugin Feishu:

```bash
openclaw plugins install @openclaw/feishu
```

Checkout local (ao executar a partir de um repositório git):

```bash
openclaw plugins install ./extensions/feishu
```

---

## Inicio rapido

Existem duas maneiras de adicionar o canal Feishu:

### Metodo 1: assistente de integracao inicial (recomendado)

Se você acabou de instalar o OpenClaw, execute o assistente:

```bash
openclaw onboard
```

O assistente orienta você em:

1. Criar um app Feishu e coletar credenciais
2. Configurar as credenciais do app no OpenClaw
3. Iniciar o gateway

✅ **Apos a configuracao**, verifique o status do gateway:

- `openclaw gateway status`
- `openclaw logs --follow`

### Metodo 2: configuracao via CLI

Se você ja concluiu a instalacao inicial, adicione o canal via CLI:

```bash
openclaw channels add
```

Escolha **Feishu** e, em seguida, informe o App ID e o App Secret.

✅ **Apos a configuracao**, gerencie o gateway:

- `openclaw gateway status`
- `openclaw gateway restart`
- `openclaw logs --follow`

---

## Passo 1: Criar um app Feishu

### 1. Abrir a Feishu Open Platform

Acesse [Feishu Open Platform](https://open.feishu.cn/app) e faça login.

Tenants Lark (global) devem usar https://open.larksuite.com/app e definir `domain: "lark"` na configuracao do Feishu.

### 2. Criar um app

1. Clique em **Create enterprise app**
2. Preencha o nome e a descricao do app
3. Escolha um icone para o app

![Create enterprise app](../images/feishu-step2-create-app.png)

### 3. Copiar credenciais

Em **Credentials & Basic Info**, copie:

- **App ID** (formato: `cli_xxx`)
- **App Secret**

❗ **Importante:** mantenha o App Secret privado.

![Get credentials](../images/feishu-step3-credentials.png)

### 4. Configurar permissoes

Em **Permissions**, clique em **Batch import** e cole:

```json
{
  "scopes": {
    "tenant": [
      "aily:file:read",
      "aily:file:write",
      "application:application.app_message_stats.overview:readonly",
      "application:application:self_manage",
      "application:bot.menu:write",
      "contact:user.employee_id:readonly",
      "corehr:file:download",
      "event:ip_list",
      "im:chat.access_event.bot_p2p_chat:read",
      "im:chat.members:bot_access",
      "im:message",
      "im:message.group_at_msg:readonly",
      "im:message.p2p_msg:readonly",
      "im:message:readonly",
      "im:message:send_as_bot",
      "im:resource"
    ],
    "user": ["aily:file:read", "aily:file:write", "im:chat.access_event.bot_p2p_chat:read"]
  }
}
```

![Configure permissions](../images/feishu-step4-permissions.png)

### 5. Ativar a capacidade de bot

Em **App Capability** > **Bot**:

1. Ative a capacidade de bot
2. Defina o nome do bot

![Enable bot capability](../images/feishu-step5-bot-capability.png)

### 6. Configurar assinatura de eventos

⚠️ **Importante:** antes de configurar a assinatura de eventos, certifique-se de que:

1. Você ja executou `openclaw channels add` para Feishu
2. O gateway esta em execucao (`openclaw gateway status`)

Em **Event Subscription**:

1. Escolha **Use long connection to receive events** (WebSocket)
2. Adicione o evento: `im.message.receive_v1`

⚠️ Se o gateway nao estiver em execucao, a configuracao de conexao longa pode falhar ao salvar.

![Configure event subscription](../images/feishu-step6-event-subscription.png)

### 7. Publicar o app

1. Crie uma versao em **Version Management & Release**
2. Envie para revisao e publique
3. Aguarde a aprovacao do administrador (apps corporativos geralmente aprovam automaticamente)

---

## Passo 2: Configurar o OpenClaw

### Configurar com o assistente (recomendado)

```bash
openclaw channels add
```

Escolha **Feishu** e cole seu App ID e App Secret.

### Configurar via arquivo de configuracao

Edite `~/.openclaw/openclaw.json`:

```json5
{
  channels: {
    feishu: {
      enabled: true,
      dmPolicy: "pairing",
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "xxx",
          botName: "My AI assistant",
        },
      },
    },
  },
}
```

### Configurar via variaveis de ambiente

```bash
export FEISHU_APP_ID="cli_xxx"
export FEISHU_APP_SECRET="xxx"
```

### Dominio Lark (global)

Se o seu tenant estiver no Lark (internacional), defina o dominio como `lark` (ou uma string de dominio completa). Você pode definir em `channels.feishu.domain` ou por conta (`channels.feishu.accounts.<id>.domain`).

```json5
{
  channels: {
    feishu: {
      domain: "lark",
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "xxx",
        },
      },
    },
  },
}
```

---

## Passo 3: Iniciar + testar

### 1. Iniciar o gateway

```bash
openclaw gateway
```

### 2. Enviar uma mensagem de teste

No Feishu, encontre seu bot e envie uma mensagem.

### 3. Aprovar pareamento

Por padrao, o bot responde com um codigo de pareamento. Aprove-o:

```bash
openclaw pairing approve feishu <CODE>
```

Apos a aprovacao, você pode conversar normalmente.

---

## Visao geral

- **Canal de bot Feishu**: bot Feishu gerenciado pelo gateway
- **Roteamento deterministico**: as respostas sempre retornam ao Feishu
- **Isolamento de sessao**: Mensagens diretas compartilham uma sessao principal; grupos sao isolados
- **Conexao WebSocket**: conexao longa via SDK do Feishu, sem necessidade de URL publica

---

## Controle de acesso

### Mensagens diretas

- **Padrao**: `dmPolicy: "pairing"` (usuarios desconhecidos recebem um codigo de pareamento)
- **Aprovar pareamento**:
  ```bash
  openclaw pairing list feishu
  openclaw pairing approve feishu <CODE>
  ```
- **Modo allowlist**: defina `channels.feishu.allowFrom` com Open IDs permitidos

### Chats em grupo

**1. Politica de grupo** (`channels.feishu.groupPolicy`):

- `"open"` = permitir todos nos grupos (padrao)
- `"allowlist"` = permitir apenas `groupAllowFrom`
- `"disabled"` = desativar mensagens em grupo

**2. Requisito de mencao** (`channels.feishu.groups.<chat_id>.requireMention`):

- `true` = exigir @mention (padrao)
- `false` = responder sem mencoes

---

## Exemplos de configuracao de grupo

### Permitir todos os grupos, exigir @mention (padrao)

```json5
{
  channels: {
    feishu: {
      groupPolicy: "open",
      // Default requireMention: true
    },
  },
}
```

### Permitir todos os grupos, sem exigir @mention

```json5
{
  channels: {
    feishu: {
      groups: {
        oc_xxx: { requireMention: false },
      },
    },
  },
}
```

### Permitir apenas usuarios especificos em grupos

```json5
{
  channels: {
    feishu: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["ou_xxx", "ou_yyy"],
    },
  },
}
```

---

## Obter IDs de grupo/usuario

### IDs de grupo (chat_id)

IDs de grupo se parecem com `oc_xxx`.

**Metodo 1 (recomendado)**

1. Inicie o gateway e mencione o bot (@mention) no grupo
2. Execute `openclaw logs --follow` e procure por `chat_id`

**Metodo 2**

Use o depurador da API Feishu para listar chats em grupo.

### IDs de usuario (open_id)

IDs de usuario se parecem com `ou_xxx`.

**Metodo 1 (recomendado)**

1. Inicie o gateway e envie uma Mensagem direta ao bot
2. Execute `openclaw logs --follow` e procure por `open_id`

**Metodo 2**

Verifique as solicitacoes de pareamento para Open IDs de usuario:

```bash
openclaw pairing list feishu
```

---

## Comandos comuns

| Comando   | Descricao             |
| --------- | --------------------- |
| `/status` | Mostrar status do bot |
| `/reset`  | Redefinir a sessao    |
| `/model`  | Mostrar/trocar modelo |

> Nota: o Feishu ainda nao oferece suporte a menus de comandos nativos, entao os comandos devem ser enviados como texto.

## Comandos de gerenciamento do Gateway

| Comando                    | Descricao                             |
| -------------------------- | ------------------------------------- |
| `openclaw gateway status`  | Mostrar status do gateway             |
| `openclaw gateway install` | Instalar/iniciar o servico do gateway |
| `openclaw gateway stop`    | Parar o servico do gateway            |
| `openclaw gateway restart` | Reiniciar o servico do gateway        |
| `openclaw logs --follow`   | Acompanhar logs do gateway            |

---

## Solucao de problemas

### O bot nao responde em chats em grupo

1. Certifique-se de que o bot foi adicionado ao grupo
2. Certifique-se de mencionar o bot com @mention (comportamento padrao)
3. Verifique se `groupPolicy` nao esta definido como `"disabled"`
4. Verifique os logs: `openclaw logs --follow`

### O bot nao recebe mensagens

1. Certifique-se de que o app esta publicado e aprovado
2. Certifique-se de que a assinatura de eventos inclui `im.message.receive_v1`
3. Certifique-se de que a **conexao longa** esta ativada
4. Certifique-se de que as permissoes do app estao completas
5. Certifique-se de que o gateway esta em execucao: `openclaw gateway status`
6. Verifique os logs: `openclaw logs --follow`

### Vazamento do App Secret

1. Redefina o App Secret na Feishu Open Platform
2. Atualize o App Secret na sua configuracao
3. Reinicie o gateway

### Falhas no envio de mensagens

1. Certifique-se de que o app possui a permissao `im:message:send_as_bot`
2. Certifique-se de que o app esta publicado
3. Verifique os logs para erros detalhados

---

## Configuracao avancada

### Multiplas contas

```json5
{
  channels: {
    feishu: {
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "xxx",
          botName: "Primary bot",
        },
        backup: {
          appId: "cli_yyy",
          appSecret: "yyy",
          botName: "Backup bot",
          enabled: false,
        },
      },
    },
  },
}
```

### Limites de mensagem

- `textChunkLimit`: tamanho do bloco de texto de saida (padrao: 2000 caracteres)
- `mediaMaxMb`: limite de upload/download de midia (padrao: 30MB)

### Streaming

O Feishu oferece suporte a respostas em streaming via cartoes interativos. Quando ativado, o bot atualiza um cartao conforme gera o texto.

```json5
{
  channels: {
    feishu: {
      streaming: true, // enable streaming card output (default true)
      blockStreaming: true, // enable block-level streaming (default true)
    },
  },
}
```

Defina `streaming: false` para aguardar a resposta completa antes de enviar.

### Roteamento multi-agente

Use `bindings` para rotear Mensagens diretas ou grupos do Feishu para diferentes agentes.

```json5
{
  agents: {
    list: [
      { id: "main" },
      {
        id: "clawd-fan",
        workspace: "/home/user/clawd-fan",
        agentDir: "/home/user/.openclaw/agents/clawd-fan/agent",
      },
      {
        id: "clawd-xi",
        workspace: "/home/user/clawd-xi",
        agentDir: "/home/user/.openclaw/agents/clawd-xi/agent",
      },
    ],
  },
  bindings: [
    {
      agentId: "main",
      match: {
        channel: "feishu",
        peer: { kind: "dm", id: "ou_xxx" },
      },
    },
    {
      agentId: "clawd-fan",
      match: {
        channel: "feishu",
        peer: { kind: "dm", id: "ou_yyy" },
      },
    },
    {
      agentId: "clawd-xi",
      match: {
        channel: "feishu",
        peer: { kind: "group", id: "oc_zzz" },
      },
    },
  ],
}
```

Campos de roteamento:

- `match.channel`: `"feishu"`
- `match.peer.kind`: `"dm"` ou `"group"`
- `match.peer.id`: Open ID do usuario (`ou_xxx`) ou ID do grupo (`oc_xxx`)

Veja [Obter IDs de grupo/usuario](#get-groupuser-ids) para dicas de consulta.

---

## Referencia de configuracao

Configuracao completa: [Configuracao do Gateway](/gateway/configuration)

Opcoes principais:

| Configuracao                                      | Descricao                                         | Padrao    |
| ------------------------------------------------- | ------------------------------------------------- | --------- |
| `channels.feishu.enabled`                         | Ativar/desativar canal                            | `true`    |
| `channels.feishu.domain`                          | Dominio da API (`feishu` ou `lark`)               | `feishu`  |
| `channels.feishu.accounts.<id>.appId`             | App ID                                            | -         |
| `channels.feishu.accounts.<id>.appSecret`         | App Secret                                        | -         |
| `channels.feishu.accounts.<id>.domain`            | Substituicao de dominio da API por conta          | `feishu`  |
| `channels.feishu.dmPolicy`                        | Politica de Mensagens diretas                     | `pairing` |
| `channels.feishu.allowFrom`                       | Allowlist de Mensagens diretas (lista de open_id) | -         |
| `channels.feishu.groupPolicy`                     | Politica de grupo                                 | `open`    |
| `channels.feishu.groupAllowFrom`                  | Allowlist de grupo                                | -         |
| `channels.feishu.groups.<chat_id>.requireMention` | Exigir @mention                                   | `true`    |
| `channels.feishu.groups.<chat_id>.enabled`        | Ativar grupo                                      | `true`    |
| `channels.feishu.textChunkLimit`                  | Tamanho do bloco de mensagem                      | `2000`    |
| `channels.feishu.mediaMaxMb`                      | Limite de tamanho de midia                        | `30`      |
| `channels.feishu.streaming`                       | Ativar saida de cartao em streaming               | `true`    |
| `channels.feishu.blockStreaming`                  | Ativar streaming por blocos                       | `true`    |

---

## Referencia de dmPolicy

| Valor         | Comportamento                                                                              |
| ------------- | ------------------------------------------------------------------------------------------ |
| `"pairing"`   | **Padrao.** Usuarios desconhecidos recebem um codigo de pareamento; precisam ser aprovados |
| `"allowlist"` | Apenas usuarios em `allowFrom` podem conversar                                             |
| `"open"`      | Permitir todos os usuarios (requer `"*"` em allowFrom)                                     |
| `"disabled"`  | Desativar Mensagens diretas                                                                |

---

## Tipos de mensagem suportados

### Receber

- ✅ Texto
- ✅ Texto rico (post)
- ✅ Imagens
- ✅ Arquivos
- ✅ Audio
- ✅ Video
- ✅ Figurinhas

### Enviar

- ✅ Texto
- ✅ Imagens
- ✅ Arquivos
- ✅ Audio
- ⚠️ Texto rico (suporte parcial)
