---
summary: "Configuracao do Slack para modo socket ou webhook HTTP"
read_when: "Configurando o Slack ou depurando o modo socket/HTTP do Slack"
title: "Slack"
x-i18n:
  source_path: channels/slack.md
  source_hash: 703b4b4333bebfef
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:57Z
---

# Slack

## Modo Socket (padrao)

### Configuracao rapida (iniciante)

1. Crie um app do Slack e habilite o **Socket Mode**.
2. Crie um **App Token** (`xapp-...`) e um **Bot Token** (`xoxb-...`).
3. Defina os tokens para o OpenClaw e inicie o Gateway.

Configuracao minima:

```json5
{
  channels: {
    slack: {
      enabled: true,
      appToken: "xapp-...",
      botToken: "xoxb-...",
    },
  },
}
```

### Configuracao

1. Crie um app do Slack (From scratch) em https://api.slack.com/apps.
2. **Socket Mode** → ative. Em seguida, vá em **Basic Information** → **App-Level Tokens** → **Generate Token and Scopes** com o escopo `connections:write`. Copie o **App Token** (`xapp-...`).
3. **OAuth & Permissions** → adicione escopos do bot (use o manifesto abaixo). Clique em **Install to Workspace**. Copie o **Bot User OAuth Token** (`xoxb-...`).
4. Opcional: **OAuth & Permissions** → adicione **User Token Scopes** (veja a lista somente leitura abaixo). Reinstale o app e copie o **User OAuth Token** (`xoxp-...`).
5. **Event Subscriptions** → habilite eventos e inscreva-se em:
   - `message.*` (inclui edicoes/exclusoes/transmissoes de threads)
   - `app_mention`
   - `reaction_added`, `reaction_removed`
   - `member_joined_channel`, `member_left_channel`
   - `channel_rename`
   - `pin_added`, `pin_removed`
6. Convide o bot para os canais que voce deseja que ele leia.
7. Slash Commands → crie `/openclaw` se voce usar `channels.slack.slashCommand`. Se voce habilitar comandos nativos, adicione um slash command por comando integrado (mesmos nomes que `/help`). Nativo vem desativado por padrao para o Slack, a menos que voce defina `channels.slack.commands.native: true` (o `commands.native` global eh `"auto"`, que deixa o Slack desativado).
8. App Home → habilite a **Messages Tab** para que os usuarios possam enviar Mensagens diretas ao bot.

Use o manifesto abaixo para manter escopos e eventos em sincronia.

Suporte a varias contas: use `channels.slack.accounts` com tokens por conta e `name` opcional. Veja [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) para o padrao compartilhado.

### Configuracao do OpenClaw (minima)

Defina os tokens via variaveis de ambiente (recomendado):

- `SLACK_APP_TOKEN=xapp-...`
- `SLACK_BOT_TOKEN=xoxb-...`

Ou via configuracao:

```json5
{
  channels: {
    slack: {
      enabled: true,
      appToken: "xapp-...",
      botToken: "xoxb-...",
    },
  },
}
```

### Token de usuario (opcional)

O OpenClaw pode usar um token de usuario do Slack (`xoxp-...`) para operacoes de leitura (historico,
pins, reacoes, emoji, informacoes de membros). Por padrao, isso permanece somente leitura: leituras
preferem o token de usuario quando presente, e escritas ainda usam o token do bot, a menos
que voce opte explicitamente. Mesmo com `userTokenReadOnly: false`, o token do bot continua
preferido para escritas quando estiver disponivel.

Tokens de usuario sao configurados no arquivo de configuracao (sem suporte a variaveis de ambiente). Para
multi-conta, defina `channels.slack.accounts.<id>.userToken`.

Exemplo com tokens de bot + app + usuario:

```json5
{
  channels: {
    slack: {
      enabled: true,
      appToken: "xapp-...",
      botToken: "xoxb-...",
      userToken: "xoxp-...",
    },
  },
}
```

Exemplo com userTokenReadOnly definido explicitamente (permitir escritas com token de usuario):

```json5
{
  channels: {
    slack: {
      enabled: true,
      appToken: "xapp-...",
      botToken: "xoxb-...",
      userToken: "xoxp-...",
      userTokenReadOnly: false,
    },
  },
}
```

#### Uso de tokens

- Operacoes de leitura (historico, lista de reacoes, lista de pins, lista de emoji, informacoes de membros,
  busca) preferem o token de usuario quando configurado; caso contrario, o token do bot.
- Operacoes de escrita (enviar/editar/excluir mensagens, adicionar/remover reacoes, fixar/desafixar,
  uploads de arquivos) usam o token do bot por padrao. Se `userTokenReadOnly: false` e
  nenhum token de bot estiver disponivel, o OpenClaw recorre ao token de usuario.

### Contexto de historico

- `channels.slack.historyLimit` (ou `channels.slack.accounts.*.historyLimit`) controla quantas mensagens recentes de canal/grupo sao incorporadas ao prompt.
- Retorna para `messages.groupChat.historyLimit`. Defina `0` para desativar (padrao 50).

## Modo HTTP (Events API)

Use o modo de webhook HTTP quando o seu Gateway for acessivel pelo Slack via HTTPS (tipico para implantacoes em servidor).
O modo HTTP usa a Events API + Interactivity + Slash Commands com uma URL de requisicao compartilhada.

### Configuracao

1. Crie um app do Slack e **desative o Socket Mode** (opcional se voce usar apenas HTTP).
2. **Basic Information** → copie o **Signing Secret**.
3. **OAuth & Permissions** → instale o app e copie o **Bot User OAuth Token** (`xoxb-...`).
4. **Event Subscriptions** → habilite eventos e defina a **Request URL** para o caminho do webhook do seu gateway (padrao `/slack/events`).
5. **Interactivity & Shortcuts** → habilite e defina a mesma **Request URL**.
6. **Slash Commands** → defina a mesma **Request URL** para seu(s) comando(s).

Exemplo de Request URL:
`https://gateway-host/slack/events`

### Configuracao do OpenClaw (minima)

```json5
{
  channels: {
    slack: {
      enabled: true,
      mode: "http",
      botToken: "xoxb-...",
      signingSecret: "your-signing-secret",
      webhookPath: "/slack/events",
    },
  },
}
```

Modo HTTP multi-conta: defina `channels.slack.accounts.<id>.mode = "http"` e forneca um
`webhookPath` exclusivo por conta para que cada app do Slack aponte para sua propria URL.

### Manifesto (opcional)

Use este manifesto de app do Slack para criar o app rapidamente (ajuste o nome/comando se desejar). Inclua os
escopos de usuario se voce planeja configurar um token de usuario.

```json
{
  "display_information": {
    "name": "OpenClaw",
    "description": "Slack connector for OpenClaw"
  },
  "features": {
    "bot_user": {
      "display_name": "OpenClaw",
      "always_online": false
    },
    "app_home": {
      "messages_tab_enabled": true,
      "messages_tab_read_only_enabled": false
    },
    "slash_commands": [
      {
        "command": "/openclaw",
        "description": "Send a message to OpenClaw",
        "should_escape": false
      }
    ]
  },
  "oauth_config": {
    "scopes": {
      "bot": [
        "chat:write",
        "channels:history",
        "channels:read",
        "groups:history",
        "groups:read",
        "groups:write",
        "im:history",
        "im:read",
        "im:write",
        "mpim:history",
        "mpim:read",
        "mpim:write",
        "users:read",
        "app_mentions:read",
        "reactions:read",
        "reactions:write",
        "pins:read",
        "pins:write",
        "emoji:read",
        "commands",
        "files:read",
        "files:write"
      ],
      "user": [
        "channels:history",
        "channels:read",
        "groups:history",
        "groups:read",
        "im:history",
        "im:read",
        "mpim:history",
        "mpim:read",
        "users:read",
        "reactions:read",
        "pins:read",
        "emoji:read",
        "search:read"
      ]
    }
  },
  "settings": {
    "socket_mode_enabled": true,
    "event_subscriptions": {
      "bot_events": [
        "app_mention",
        "message.channels",
        "message.groups",
        "message.im",
        "message.mpim",
        "reaction_added",
        "reaction_removed",
        "member_joined_channel",
        "member_left_channel",
        "channel_rename",
        "pin_added",
        "pin_removed"
      ]
    }
  }
}
```

Se voce habilitar comandos nativos, adicione uma entrada `slash_commands` por comando que deseja expor (correspondendo a lista `/help`). Substitua com `channels.slack.commands.native`.

## Escopos (atuais vs opcionais)

A Conversations API do Slack eh tipada por escopo: voce so precisa dos escopos para os
tipos de conversa que realmente usa (channels, groups, im, mpim). Veja
https://docs.slack.dev/apis/web-api/using-the-conversations-api/ para a visao geral.

### Escopos do token do bot (obrigatorios)

- `chat:write` (enviar/atualizar/excluir mensagens via `chat.postMessage`)
  https://docs.slack.dev/reference/methods/chat.postMessage
- `im:write` (abrir Mensagens diretas via `conversations.open` para DMs de usuarios)
  https://docs.slack.dev/reference/methods/conversations.open
- `channels:history`, `groups:history`, `im:history`, `mpim:history`
  https://docs.slack.dev/reference/methods/conversations.history
- `channels:read`, `groups:read`, `im:read`, `mpim:read`
  https://docs.slack.dev/reference/methods/conversations.info
- `users:read` (consulta de usuarios)
  https://docs.slack.dev/reference/methods/users.info
- `reactions:read`, `reactions:write` (`reactions.get` / `reactions.add`)
  https://docs.slack.dev/reference/methods/reactions.get
  https://docs.slack.dev/reference/methods/reactions.add
- `pins:read`, `pins:write` (`pins.list` / `pins.add` / `pins.remove`)
  https://docs.slack.dev/reference/scopes/pins.read
  https://docs.slack.dev/reference/scopes/pins.write
- `emoji:read` (`emoji.list`)
  https://docs.slack.dev/reference/scopes/emoji.read
- `files:write` (uploads via `files.uploadV2`)
  https://docs.slack.dev/messaging/working-with-files/#upload

### Escopos do token de usuario (opcional, somente leitura por padrao)

Adicione estes em **User Token Scopes** se voce configurar `channels.slack.userToken`.

- `channels:history`, `groups:history`, `im:history`, `mpim:history`
- `channels:read`, `groups:read`, `im:read`, `mpim:read`
- `users:read`
- `reactions:read`
- `pins:read`
- `emoji:read`
- `search:read`

### Nao necessario hoje (mas provavelmente no futuro)

- `mpim:write` (apenas se adicionarmos abertura de DM em grupo/inicio de DM via `conversations.open`)
- `groups:write` (apenas se adicionarmos gerenciamento de canais privados: criar/renomear/convidar/arquivar)
- `chat:write.public` (apenas se quisermos postar em canais em que o bot nao esta)
  https://docs.slack.dev/reference/scopes/chat.write.public
- `users:read.email` (apenas se precisarmos de campos de email de `users.info`)
  https://docs.slack.dev/changelog/2017-04-narrowing-email-access
- `files:read` (apenas se comecarmos a listar/ler metadados de arquivos)

## Configuracao

O Slack usa apenas Socket Mode (sem servidor de webhook HTTP). Forneca ambos os tokens:

```json
{
  "slack": {
    "enabled": true,
    "botToken": "xoxb-...",
    "appToken": "xapp-...",
    "groupPolicy": "allowlist",
    "dm": {
      "enabled": true,
      "policy": "pairing",
      "allowFrom": ["U123", "U456", "*"],
      "groupEnabled": false,
      "groupChannels": ["G123"],
      "replyToMode": "all"
    },
    "channels": {
      "C123": { "allow": true, "requireMention": true },
      "#general": {
        "allow": true,
        "requireMention": true,
        "users": ["U123"],
        "skills": ["search", "docs"],
        "systemPrompt": "Keep answers short."
      }
    },
    "reactionNotifications": "own",
    "reactionAllowlist": ["U123"],
    "replyToMode": "off",
    "actions": {
      "reactions": true,
      "messages": true,
      "pins": true,
      "memberInfo": true,
      "emojiList": true
    },
    "slashCommand": {
      "enabled": true,
      "name": "openclaw",
      "sessionPrefix": "slack:slash",
      "ephemeral": true
    },
    "textChunkLimit": 4000,
    "mediaMaxMb": 20
  }
}
```

Os tokens tambem podem ser fornecidos via variaveis de ambiente:

- `SLACK_BOT_TOKEN`
- `SLACK_APP_TOKEN`

As reacoes de ack sao controladas globalmente via `messages.ackReaction` +
`messages.ackReactionScope`. Use `messages.removeAckAfterReply` para limpar a
reacao de ack apos o bot responder.

## Limites

- Texto de saida eh fragmentado em `channels.slack.textChunkLimit` (padrao 4000).
- Fragmentacao opcional por nova linha: defina `channels.slack.chunkMode="newline"` para dividir em linhas em branco (limites de paragrafo) antes da fragmentacao por tamanho.
- Uploads de midia sao limitados por `channels.slack.mediaMaxMb` (padrao 20).

## Encadeamento de respostas

Por padrao, o OpenClaw responde no canal principal. Use `channels.slack.replyToMode` para controlar o encadeamento automatico:

| Modo    | Comportamento                                                                                                                                                                             |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `off`   | **Padrao.** Responder no canal principal. So encadeia se a mensagem que disparou ja estava em uma thread.                                                                                 |
| `first` | A primeira resposta vai para a thread (sob a mensagem que disparou); respostas subsequentes vao para o canal principal. Util para manter o contexto visivel evitando poluicao de threads. |
| `all`   | Todas as respostas vao para a thread. Mantem as conversas contidas, mas pode reduzir a visibilidade.                                                                                      |

O modo se aplica tanto a respostas automaticas quanto a chamadas de ferramentas do agente (`slack sendMessage`).

### Encadeamento por tipo de chat

Voce pode configurar comportamentos de encadeamento diferentes por tipo de chat definindo `channels.slack.replyToModeByChatType`:

```json5
{
  channels: {
    slack: {
      replyToMode: "off", // default for channels
      replyToModeByChatType: {
        direct: "all", // DMs always thread
        group: "first", // group DMs/MPIM thread first reply
      },
    },
  },
}
```

Tipos de chat suportados:

- `direct`: DMs 1:1 (Slack `im`)
- `group`: DMs em grupo / MPIMs (Slack `mpim`)
- `channel`: canais padrao (publicos/privados)

Precedencia:

1. `replyToModeByChatType.<chatType>`
2. `replyToMode`
3. Padrao do provedor (`off`)

O legado `channels.slack.dm.replyToMode` ainda eh aceito como fallback para `direct` quando nenhum override por tipo de chat eh definido.

Exemplos:

Encadear apenas DMs:

```json5
{
  channels: {
    slack: {
      replyToMode: "off",
      replyToModeByChatType: { direct: "all" },
    },
  },
}
```

Encadear DMs em grupo, mas manter canais na raiz:

```json5
{
  channels: {
    slack: {
      replyToMode: "off",
      replyToModeByChatType: { group: "first" },
    },
  },
}
```

Encadear canais, manter DMs na raiz:

```json5
{
  channels: {
    slack: {
      replyToMode: "first",
      replyToModeByChatType: { direct: "off", group: "off" },
    },
  },
}
```

### Tags manuais de encadeamento

Para controle fino, use estas tags nas respostas do agente:

- `[[reply_to_current]]` — responder a mensagem que disparou (iniciar/continuar thread).
- `[[reply_to:<id>]]` — responder a um id de mensagem especifico.

## Sessoes + roteamento

- DMs compartilham a sessao `main` (como WhatsApp/Telegram).
- Canais mapeiam para sessoes `agent:<agentId>:slack:channel:<channelId>`.
- Slash commands usam sessoes `agent:<agentId>:slack:slash:<userId>` (prefixo configuravel via `channels.slack.slashCommand.sessionPrefix`).
- Se o Slack nao fornecer `channel_type`, o OpenClaw o infere a partir do prefixo do ID do canal (`D`, `C`, `G`) e assume `channel` para manter chaves de sessao estaveis.
- O registro de comandos nativos usa `commands.native` (padrao global `"auto"` → Slack desativado) e pode ser sobrescrito por workspace com `channels.slack.commands.native`. Comandos de texto exigem mensagens `/...` independentes e podem ser desativados com `commands.text: false`. Slash commands do Slack sao gerenciados no app do Slack e nao sao removidos automaticamente. Use `commands.useAccessGroups: false` para ignorar verificacoes de grupo de acesso para comandos.
- Lista completa de comandos + configuracao: [Slash commands](/tools/slash-commands)

## Seguranca de DM (pareamento)

- Padrao: `channels.slack.dm.policy="pairing"` — remetentes de DM desconhecidos recebem um codigo de pareamento (expira apos 1 hora).
- Aprovar via: `openclaw pairing approve slack <code>`.
- Para permitir qualquer pessoa: defina `channels.slack.dm.policy="open"` e `channels.slack.dm.allowFrom=["*"]`.
- `channels.slack.dm.allowFrom` aceita IDs de usuario, @handles ou emails (resolvidos na inicializacao quando os tokens permitem). O assistente aceita nomes de usuario e os resolve para ids durante a configuracao quando os tokens permitem.

## Politica de grupo

- `channels.slack.groupPolicy` controla o tratamento de canais (`open|disabled|allowlist`).
- `allowlist` exige que os canais estejam listados em `channels.slack.channels`.
- Se voce apenas definir `SLACK_BOT_TOKEN`/`SLACK_APP_TOKEN` e nunca criar uma secao `channels.slack`,
  o runtime define `groupPolicy` como `open`. Adicione `channels.slack.groupPolicy`,
  `channels.defaults.groupPolicy` ou uma allowlist de canais para restringir.
- O assistente de configuracao aceita nomes `#channel` e os resolve para IDs quando possivel
  (publicos + privados); se existirem varias correspondencias, ele prefere o canal ativo.
- Na inicializacao, o OpenClaw resolve nomes de canais/usuarios nas allowlists para IDs (quando os tokens permitem)
  e registra o mapeamento; entradas nao resolvidas sao mantidas como digitadas.
- Para permitir **nenhum canal**, defina `channels.slack.groupPolicy: "disabled"` (ou mantenha uma allowlist vazia).

Opcoes de canal (`channels.slack.channels.<id>` ou `channels.slack.channels.<name>`):

- `allow`: permitir/negar o canal quando `groupPolicy="allowlist"`.
- `requireMention`: controle por mencao para o canal.
- `tools`: overrides opcionais de politica de ferramentas por canal (`allow`/`deny`/`alsoAllow`).
- `toolsBySender`: overrides opcionais de politica de ferramentas por remetente dentro do canal (chaves sao ids de remetente/@handles/emails; curinga `"*"` suportado).
- `allowBots`: permitir mensagens escritas pelo bot neste canal (padrao: false).
- `users`: allowlist opcional de usuarios por canal.
- `skills`: filtro de skill (omitir = todas as skills, vazio = nenhuma).
- `systemPrompt`: prompt de sistema extra para o canal (combinado com topico/proposito).
- `enabled`: defina `false` para desativar o canal.

## Alvos de entrega

Use estes com envios via cron/CLI:

- `user:<id>` para DMs
- `channel:<id>` para canais

## Acoes de ferramentas

As acoes de ferramentas do Slack podem ser controladas com `channels.slack.actions.*`:

| Grupo de acao | Padrao  | Observacoes                    |
| ------------- | ------- | ------------------------------ |
| reactions     | enabled | Reagir + listar reacoes        |
| messages      | enabled | Ler/enviar/editar/excluir      |
| pins          | enabled | Fixar/desafixar/listar         |
| memberInfo    | enabled | Informacoes de membros         |
| emojiList     | enabled | Lista de emojis personalizados |

## Notas de seguranca

- Escritas usam por padrao o token do bot para que acoes que alteram estado fiquem limitadas as
  permissoes e identidade do bot do app.
- Definir `userTokenReadOnly: false` permite que o token de usuario seja usado para operacoes de escrita
  quando um token de bot nao estiver disponivel, o que significa que as acoes rodam com o acesso
  do usuario que instalou. Trate o token de usuario como altamente privilegiado e mantenha
  controles de acao e allowlists restritos.
- Se voce habilitar escritas com token de usuario, certifique-se de que o token de usuario inclua os escopos de escrita esperados (`chat:write`, `reactions:write`, `pins:write`,
  `files:write`) ou essas operacoes falharao.

## Observacoes

- O controle por mencao eh gerenciado via `channels.slack.channels` (defina `requireMention` como `true`); `agents.list[].groupChat.mentionPatterns` (ou `messages.groupChat.mentionPatterns`) tambem contam como mencoes.
- Override multi-agente: defina padroes por agente em `agents.list[].groupChat.mentionPatterns`.
- Notificacoes de reacoes seguem `channels.slack.reactionNotifications` (use `reactionAllowlist` com o modo `allowlist`).
- Mensagens escritas pelo bot sao ignoradas por padrao; habilite via `channels.slack.allowBots` ou `channels.slack.channels.<id>.allowBots`.
- Aviso: se voce permitir respostas a outros bots (`channels.slack.allowBots=true` ou `channels.slack.channels.<id>.allowBots=true`), evite loops de resposta entre bots com allowlists `requireMention`, `channels.slack.channels.<id>.users` e/ou protecoes claras em `AGENTS.md` e `SOUL.md`.
- Para a ferramenta do Slack, a semantica de remocao de reacoes esta em [/tools/reactions](/tools/reactions).
- Anexos sao baixados para o armazenamento de midia quando permitido e abaixo do limite de tamanho.
