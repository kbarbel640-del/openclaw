---
summary: "Status de suporte do bot do Telegram, capacidades e configuracao"
read_when:
  - Trabalhando em recursos ou webhooks do Telegram
title: "Telegram"
x-i18n:
  source_path: channels/telegram.md
  source_hash: 5f75bd20da52c8f0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:29Z
---

# Telegram (Bot API)

Status: pronto para producao para Mensagens diretas de bots + grupos via grammY. Long-polling por padrao; webhook opcional.

## Inicio rapido (iniciante)

1. Crie um bot com **@BotFather** ([link direto](https://t.me/BotFather)). Confirme que o handle e exatamente `@BotFather`, depois copie o token.
2. Defina o token:
   - Env: `TELEGRAM_BOT_TOKEN=...`
   - Ou config: `channels.telegram.botToken: "..."`.
   - Se ambos estiverem definidos, a configuracao tem precedencia (o fallback por env e apenas para a conta padrao).
3. Inicie o Gateway.
4. O acesso por Mensagem direta e por pareamento por padrao; aprove o codigo de pareamento no primeiro contato.

Configuracao minima:

```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "123:abc",
      dmPolicy: "pairing",
    },
  },
}
```

## O que e

- Um canal da Telegram Bot API pertencente ao Gateway.
- Roteamento deterministico: as respostas retornam ao Telegram; o modelo nunca escolhe canais.
- Mensagens diretas compartilham a sessao principal do agente; grupos permanecem isolados (`agent:<agentId>:telegram:group:<chatId>`).

## Configuracao (caminho rapido)

### 1) Criar um token de bot (BotFather)

1. Abra o Telegram e converse com **@BotFather** ([link direto](https://t.me/BotFather)). Confirme que o handle e exatamente `@BotFather`.
2. Execute `/newbot`, depois siga os prompts (nome + username terminando em `bot`).
3. Copie o token e armazene-o com seguranca.

Configuracoes opcionais no BotFather:

- `/setjoingroups` — permitir/negar adicionar o bot a grupos.
- `/setprivacy` — controlar se o bot ve todas as mensagens do grupo.

### 2) Configurar o token (env ou config)

Exemplo:

```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "123:abc",
      dmPolicy: "pairing",
      groups: { "*": { requireMention: true } },
    },
  },
}
```

Opcao por env: `TELEGRAM_BOT_TOKEN=...` (funciona para a conta padrao).
Se ambos env e config estiverem definidos, a configuracao tem precedencia.

Suporte a multiplas contas: use `channels.telegram.accounts` com tokens por conta e `name` opcional. Veja [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) para o padrao compartilhado.

3. Inicie o Gateway. O Telegram inicia quando um token e resolvido (config primeiro, fallback por env).
4. O acesso por Mensagem direta usa pareamento por padrao. Aprove o codigo quando o bot for contatado pela primeira vez.
5. Para grupos: adicione o bot, decida o comportamento de privacidade/admin (abaixo) e depois defina `channels.telegram.groups` para controlar a exigencia de mencao + allowlists.

## Token + privacidade + permissoes (lado do Telegram)

### Criacao do token (BotFather)

- `/newbot` cria o bot e retorna o token (mantenha-o em segredo).
- Se um token vazar, revogue/regere via @BotFather e atualize sua configuracao.

### Visibilidade de mensagens em grupo (Modo de Privacidade)

Bots do Telegram usam **Modo de Privacidade** por padrao, o que limita quais mensagens de grupo eles recebem.
Se o seu bot precisa ver _todas_ as mensagens do grupo, voce tem duas opcoes:

- Desativar o modo de privacidade com `/setprivacy` **ou**
- Adicionar o bot como **admin** do grupo (bots admin recebem todas as mensagens).

**Observacao:** Ao alternar o modo de privacidade, o Telegram exige remover e readicionar o bot
a cada grupo para que a mudanca tenha efeito.

### Permissoes de grupo (direitos de admin)

O status de admin e definido dentro do grupo (UI do Telegram). Bots admin sempre recebem todas
as mensagens do grupo, entao use admin se voce precisar de visibilidade total.

## Como funciona (comportamento)

- Mensagens de entrada sao normalizadas no envelope de canal compartilhado com contexto de resposta e placeholders de midia.
- Respostas em grupo exigem mencao por padrao (mencao nativa @ ou `agents.list[].groupChat.mentionPatterns` / `messages.groupChat.mentionPatterns`).
- Sobrescrita multiagente: defina padroes por agente em `agents.list[].groupChat.mentionPatterns`.
- As respostas sempre retornam para o mesmo chat do Telegram.
- Long-polling usa o runner do grammY com sequenciamento por chat; a concorrencia geral e limitada por `agents.defaults.maxConcurrent`.
- A Telegram Bot API nao suporta confirmacoes de leitura; nao ha opcao `sendReadReceipts`.

## Streaming de rascunhos

O OpenClaw pode transmitir respostas parciais em Mensagens diretas do Telegram usando `sendMessageDraft`.

Requisitos:

- Modo Thread habilitado para o bot no @BotFather (modo de topico de forum).
- Apenas threads de chat privado (o Telegram inclui `message_thread_id` nas mensagens de entrada).
- `channels.telegram.streamMode` nao definido como `"off"` (padrao: `"partial"`, `"block"` habilita atualizacoes de rascunho em blocos).

O streaming de rascunhos e apenas para Mensagens diretas; o Telegram nao suporta isso em grupos ou canais.

## Formatacao (HTML do Telegram)

- O texto de saida do Telegram usa `parse_mode: "HTML"` (subconjunto de tags suportadas pelo Telegram).
- Entrada em estilo Markdown e renderizada em **HTML seguro para o Telegram** (negrito/italico/tachado/codigo/links); elementos de bloco sao achatados em texto com novas linhas/bullets.
- HTML bruto vindo de modelos e escapado para evitar erros de parsing do Telegram.
- Se o Telegram rejeitar o payload HTML, o OpenClaw tenta novamente a mesma mensagem como texto simples.

## Comandos (nativos + personalizados)

O OpenClaw registra comandos nativos (como `/status`, `/reset`, `/model`) no menu de bots do Telegram ao iniciar.
Voce pode adicionar comandos personalizados ao menu via configuracao:

```json5
{
  channels: {
    telegram: {
      customCommands: [
        { command: "backup", description: "Git backup" },
        { command: "generate", description: "Create an image" },
      ],
    },
  },
}
```

## Solucao de problemas

- `setMyCommands failed` nos logs geralmente significa que HTTPS/DNS de saida esta bloqueado para `api.telegram.org`.
- Se voce ver falhas `sendMessage` ou `sendChatAction`, verifique o roteamento IPv6 e o DNS.

Mais ajuda: [Solucao de problemas de canais](/channels/troubleshooting).

Observacoes:

- Comandos personalizados sao **apenas entradas de menu**; o OpenClaw nao os implementa a menos que voce trate isso em outro lugar.
- Nomes de comandos sao normalizados (o `/` inicial e removido, convertido para minusculas) e devem corresponder a `a-z`, `0-9`, `_` (1–32 caracteres).
- Comandos personalizados **nao podem sobrescrever comandos nativos**. Conflitos sao ignorados e registrados em log.
- Se `commands.native` estiver desativado, apenas comandos personalizados sao registrados (ou limpos se nao houver).

## Limites

- Texto de saida e fragmentado em `channels.telegram.textChunkLimit` (padrao 4000).
- Fragmentacao opcional por nova linha: defina `channels.telegram.chunkMode="newline"` para dividir em linhas em branco (limites de paragrafo) antes da fragmentacao por tamanho.
- Downloads/uploads de midia sao limitados por `channels.telegram.mediaMaxMb` (padrao 5).
- Requisicoes da Telegram Bot API expiram apos `channels.telegram.timeoutSeconds` (padrao 500 via grammY). Defina um valor menor para evitar travamentos longos.
- O contexto de historico de grupo usa `channels.telegram.historyLimit` (ou `channels.telegram.accounts.*.historyLimit`), com fallback para `messages.groupChat.historyLimit`. Defina `0` para desativar (padrao 50).
- O historico de Mensagens diretas pode ser limitado com `channels.telegram.dmHistoryLimit` (turnos do usuario). Sobrescritas por usuario: `channels.telegram.dms["<user_id>"].historyLimit`.

## Modos de ativacao em grupo

Por padrao, o bot so responde a mencoes em grupos (`@botname` ou padroes em `agents.list[].groupChat.mentionPatterns`). Para mudar esse comportamento:

### Via configuracao (recomendado)

```json5
{
  channels: {
    telegram: {
      groups: {
        "-1001234567890": { requireMention: false }, // always respond in this group
      },
    },
  },
}
```

**Importante:** Definir `channels.telegram.groups` cria uma **allowlist** — apenas os grupos listados (ou `"*"`) serao aceitos.
Topicos de forum herdam a configuracao do grupo pai (allowFrom, requireMention, skills, prompts) a menos que voce adicione sobrescritas por topico em `channels.telegram.groups.<groupId>.topics.<topicId>`.

Para permitir todos os grupos com resposta sempre ativa:

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { requireMention: false }, // all groups, always respond
      },
    },
  },
}
```

Para manter apenas mencoes para todos os grupos (comportamento padrao):

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { requireMention: true }, // or omit groups entirely
      },
    },
  },
}
```

### Via comando (nivel de sessao)

Envie no grupo:

- `/activation always` - responder a todas as mensagens
- `/activation mention` - exigir mencoes (padrao)

**Observacao:** Comandos atualizam apenas o estado da sessao. Para comportamento persistente entre reinicios, use a configuracao.

### Obtendo o ID do chat do grupo

Encaminhe qualquer mensagem do grupo para `@userinfobot` ou `@getidsbot` no Telegram para ver o ID do chat (numero negativo como `-1001234567890`).

**Dica:** Para seu proprio ID de usuario, envie Mensagem direta ao bot e ele respondera com seu ID de usuario (mensagem de pareamento), ou use `/whoami` quando os comandos estiverem habilitados.

**Nota de privacidade:** `@userinfobot` e um bot de terceiros. Se preferir, adicione o bot ao grupo, envie uma mensagem e use `openclaw logs --follow` para ler `chat.id`, ou use a Bot API `getUpdates`.

## Escritas de configuracao

Por padrao, o Telegram tem permissao para gravar atualizacoes de configuracao disparadas por eventos do canal ou `/config set|unset`.

Isso acontece quando:

- Um grupo e atualizado para supergrupo e o Telegram emite `migrate_to_chat_id` (o ID do chat muda). O OpenClaw pode migrar `channels.telegram.groups` automaticamente.
- Voce executa `/config set` ou `/config unset` em um chat do Telegram (requer `commands.config: true`).

Desative com:

```json5
{
  channels: { telegram: { configWrites: false } },
}
```

## Topicos (supergrupos de forum)

Topicos de forum do Telegram incluem um `message_thread_id` por mensagem. O OpenClaw:

- Acrescenta `:topic:<threadId>` a chave de sessao do grupo do Telegram para que cada topico fique isolado.
- Envia indicadores de digitacao e respostas com `message_thread_id` para que as respostas permaneçam no topico.
- O topico geral (thread id `1`) e especial: envios de mensagens omitem `message_thread_id` (o Telegram rejeita), mas os indicadores de digitacao ainda o incluem.
- Exponibiliza `MessageThreadId` + `IsForum` no contexto de template para roteamento/templating.
- Configuracao especifica por topico esta disponivel em `channels.telegram.groups.<chatId>.topics.<threadId>` (skills, allowlists, resposta automatica, prompts de sistema, desativar).
- Configuracoes de topico herdam as configuracoes do grupo (requireMention, allowlists, skills, prompts, habilitado) a menos que sejam sobrescritas por topico.

Chats privados podem incluir `message_thread_id` em alguns casos extremos. O OpenClaw mantem a chave de sessao de Mensagem direta inalterada, mas ainda usa o thread id para respostas/streaming de rascunhos quando presente.

## Botoes Inline

O Telegram suporta teclados inline com botoes de callback.

```json5
{
  channels: {
    telegram: {
      capabilities: {
        inlineButtons: "allowlist",
      },
    },
  },
}
```

Para configuracao por conta:

```json5
{
  channels: {
    telegram: {
      accounts: {
        main: {
          capabilities: {
            inlineButtons: "allowlist",
          },
        },
      },
    },
  },
}
```

Escopos:

- `off` — botoes inline desativados
- `dm` — apenas Mensagens diretas (alvos de grupo bloqueados)
- `group` — apenas grupos (alvos de Mensagens diretas bloqueados)
- `all` — Mensagens diretas + grupos
- `allowlist` — Mensagens diretas + grupos, mas apenas remetentes permitidos por `allowFrom`/`groupAllowFrom` (mesmas regras que comandos de controle)

Padrao: `allowlist`.
Legado: `capabilities: ["inlineButtons"]` = `inlineButtons: "all"`.

### Enviando botoes

Use a ferramenta de mensagem com o parametro `buttons`:

```json5
{
  action: "send",
  channel: "telegram",
  to: "123456789",
  message: "Choose an option:",
  buttons: [
    [
      { text: "Yes", callback_data: "yes" },
      { text: "No", callback_data: "no" },
    ],
    [{ text: "Cancel", callback_data: "cancel" }],
  ],
}
```

Quando um usuario clica em um botao, os dados de callback sao enviados de volta ao agente como uma mensagem no formato:
`callback_data: value`

### Opcoes de configuracao

As capacidades do Telegram podem ser configuradas em dois niveis (forma de objeto mostrada acima; arrays de strings legados ainda sao suportados):

- `channels.telegram.capabilities`: Configuracao padrao global de capacidades aplicada a todas as contas do Telegram, a menos que seja sobrescrita.
- `channels.telegram.accounts.<account>.capabilities`: Capacidades por conta que sobrescrevem os padroes globais para aquela conta especifica.

Use a configuracao global quando todos os bots/contas do Telegram devem se comportar da mesma forma. Use configuracao por conta quando bots diferentes precisam de comportamentos diferentes (por exemplo, uma conta so lida com Mensagens diretas enquanto outra e permitida em grupos).

## Controle de acesso (Mensagens diretas + grupos)

### Acesso por Mensagem direta

- Padrao: `channels.telegram.dmPolicy = "pairing"`. Remetentes desconhecidos recebem um codigo de pareamento; as mensagens sao ignoradas ate serem aprovadas (codigos expiram apos 1 hora).
- Aprove via:
  - `openclaw pairing list telegram`
  - `openclaw pairing approve telegram <CODE>`
- Pareamento e a troca de token padrao usada para Mensagens diretas do Telegram. Detalhes: [Pareamento](/start/pairing)
- `channels.telegram.allowFrom` aceita IDs numericos de usuario (recomendado) ou entradas `@username`. Nao e o username do bot; use o ID do remetente humano. O assistente aceita `@username` e resolve para o ID numerico quando possivel.

#### Encontrando seu ID de usuario do Telegram

Mais seguro (sem bot de terceiros):

1. Inicie o Gateway e envie Mensagem direta ao seu bot.
2. Execute `openclaw logs --follow` e procure por `from.id`.

Alternativo (Bot API oficial):

1. Envie Mensagem direta ao seu bot.
2. Busque atualizacoes com o token do bot e leia `message.from.id`:
   ```bash
   curl "https://api.telegram.org/bot<bot_token>/getUpdates"
   ```

Terceiros (menos privado):

- Envie Mensagem direta para `@userinfobot` ou `@getidsbot` e use o ID de usuario retornado.

### Acesso a grupos

Dois controles independentes:

**1. Quais grupos sao permitidos** (allowlist de grupos via `channels.telegram.groups`):

- Sem configuracao `groups` = todos os grupos permitidos
- Com configuracao `groups` = apenas grupos listados ou `"*"` sao permitidos
- Exemplo: `"groups": { "-1001234567890": {}, "*": {} }` permite todos os grupos

**2. Quais remetentes sao permitidos** (filtro de remetentes via `channels.telegram.groupPolicy`):

- `"open"` = todos os remetentes em grupos permitidos podem enviar mensagens
- `"allowlist"` = apenas remetentes em `channels.telegram.groupAllowFrom` podem enviar mensagens
- `"disabled"` = nenhuma mensagem de grupo e aceita
  O padrao e `groupPolicy: "allowlist"` (bloqueado a menos que voce adicione `groupAllowFrom`).

A maioria dos usuarios quer: `groupPolicy: "allowlist"` + `groupAllowFrom` + grupos especificos listados em `channels.telegram.groups`

Para permitir que **qualquer membro do grupo** fale em um grupo especifico (mantendo comandos de controle restritos a remetentes autorizados), defina uma sobrescrita por grupo:

```json5
{
  channels: {
    telegram: {
      groups: {
        "-1001234567890": {
          groupPolicy: "open",
          requireMention: false,
        },
      },
    },
  },
}
```

## Long-polling vs webhook

- Padrao: long-polling (nenhuma URL publica necessaria).
- Modo webhook: defina `channels.telegram.webhookUrl` e `channels.telegram.webhookSecret` (opcionalmente `channels.telegram.webhookPath`).
  - O listener local se vincula a `0.0.0.0:8787` e serve `POST /telegram-webhook` por padrao.
  - Se sua URL publica for diferente, use um proxy reverso e aponte `channels.telegram.webhookUrl` para o endpoint publico.

## Encadeamento de respostas

O Telegram suporta respostas encadeadas opcionais via tags:

- `[[reply_to_current]]` -- responder a mensagem que disparou.
- `[[reply_to:<id>]]` -- responder a um ID de mensagem especifico.

Controlado por `channels.telegram.replyToMode`:

- `first` (padrao), `all`, `off`.

## Mensagens de audio (voz vs arquivo)

O Telegram distingue **notas de voz** (bolha redonda) de **arquivos de audio** (cartao de metadados).
O OpenClaw usa arquivos de audio por padrao para compatibilidade retroativa.

Para forcar uma bolha de nota de voz nas respostas do agente, inclua esta tag em qualquer lugar da resposta:

- `[[audio_as_voice]]` — enviar audio como nota de voz em vez de arquivo.

A tag e removida do texto entregue. Outros canais ignoram essa tag.

Para envios pela ferramenta de mensagem, defina `asVoice: true` com uma URL de `media` de audio compativel com voz
(`message` e opcional quando a midia esta presente):

```json5
{
  action: "send",
  channel: "telegram",
  to: "123456789",
  media: "https://example.com/voice.ogg",
  asVoice: true,
}
```

## Figurinhas

O OpenClaw oferece suporte a receber e enviar figurinhas do Telegram com cache inteligente.

### Recebendo figurinhas

Quando um usuario envia uma figurinha, o OpenClaw a trata com base no tipo:

- **Figurinhas estaticas (WEBP):** Baixadas e processadas via visao. A figurinha aparece como um placeholder `<media:sticker>` no conteudo da mensagem.
- **Figurinhas animadas (TGS):** Ignoradas (formato Lottie nao suportado para processamento).
- **Figurinhas de video (WEBM):** Ignoradas (formato de video nao suportado para processamento).

Campo de contexto de template disponivel ao receber figurinhas:

- `Sticker` — objeto com:
  - `emoji` — emoji associado a figurinha
  - `setName` — nome do conjunto de figurinhas
  - `fileId` — ID do arquivo do Telegram (enviar a mesma figurinha de volta)
  - `fileUniqueId` — ID estavel para consulta no cache
  - `cachedDescription` — descricao de visao em cache quando disponivel

### Cache de figurinhas

Figurinhas sao processadas pelas capacidades de visao da IA para gerar descricoes. Como as mesmas figurinhas sao frequentemente enviadas repetidamente, o OpenClaw armazena essas descricoes em cache para evitar chamadas redundantes de API.

**Como funciona:**

1. **Primeiro encontro:** A imagem da figurinha e enviada para a IA para analise de visao. A IA gera uma descricao (por exemplo, "Um gato cartum acenando entusiasmado").
2. **Armazenamento em cache:** A descricao e salva junto com o ID do arquivo da figurinha, emoji e nome do conjunto.
3. **Encontros subsequentes:** Quando a mesma figurinha aparece novamente, a descricao em cache e usada diretamente. A imagem nao e enviada a IA.

**Local do cache:** `~/.openclaw/telegram/sticker-cache.json`

**Formato da entrada do cache:**

```json
{
  "fileId": "CAACAgIAAxkBAAI...",
  "fileUniqueId": "AgADBAADb6cxG2Y",
  "emoji": "👋",
  "setName": "CoolCats",
  "description": "A cartoon cat waving enthusiastically",
  "cachedAt": "2026-01-15T10:30:00.000Z"
}
```

**Beneficios:**

- Reduz custos de API ao evitar chamadas de visao repetidas para a mesma figurinha
- Tempos de resposta mais rapidos para figurinhas em cache (sem atraso de processamento de visao)
- Habilita funcionalidade de busca de figurinhas com base em descricoes em cache

O cache e preenchido automaticamente conforme as figurinhas sao recebidas. Nao ha necessidade de gerenciamento manual do cache.

### Enviando figurinhas

O agente pode enviar e buscar figurinhas usando as acoes `sticker` e `sticker-search`. Elas estao desativadas por padrao e devem ser habilitadas na configuracao:

```json5
{
  channels: {
    telegram: {
      actions: {
        sticker: true,
      },
    },
  },
}
```

**Enviar uma figurinha:**

```json5
{
  action: "sticker",
  channel: "telegram",
  to: "123456789",
  fileId: "CAACAgIAAxkBAAI...",
}
```

Parametros:

- `fileId` (obrigatorio) — o ID do arquivo do Telegram da figurinha. Obtenha isso de `Sticker.fileId` ao receber uma figurinha, ou de um resultado `sticker-search`.
- `replyTo` (opcional) — ID da mensagem para responder.
- `threadId` (opcional) — ID do thread da mensagem para topicos de forum.

**Buscar figurinhas:**

O agente pode buscar figurinhas em cache por descricao, emoji ou nome do conjunto:

```json5
{
  action: "sticker-search",
  channel: "telegram",
  query: "cat waving",
  limit: 5,
}
```

Retorna figurinhas correspondentes do cache:

```json5
{
  ok: true,
  count: 2,
  stickers: [
    {
      fileId: "CAACAgIAAxkBAAI...",
      emoji: "👋",
      description: "A cartoon cat waving enthusiastically",
      setName: "CoolCats",
    },
  ],
}
```

A busca usa correspondencia aproximada em texto de descricao, caracteres de emoji e nomes de conjuntos.

**Exemplo com encadeamento:**

```json5
{
  action: "sticker",
  channel: "telegram",
  to: "-1001234567890",
  fileId: "CAACAgIAAxkBAAI...",
  replyTo: 42,
  threadId: 123,
}
```

## Streaming (rascunhos)

O Telegram pode transmitir **bolhas de rascunho** enquanto o agente esta gerando uma resposta.
O OpenClaw usa a Bot API `sendMessageDraft` (nao sao mensagens reais) e depois envia a
resposta final como uma mensagem normal.

Requisitos (Telegram Bot API 9.3+):

- **Chats privados com topicos habilitados** (modo de topico de forum para o bot).
- Mensagens de entrada devem incluir `message_thread_id` (thread de topico privado).
- O streaming e ignorado para grupos/supergrupos/canais.

Configuracao:

- `channels.telegram.streamMode: "off" | "partial" | "block"` (padrao: `partial`)
  - `partial`: atualizar a bolha de rascunho com o texto de streaming mais recente.
  - `block`: atualizar a bolha de rascunho em blocos maiores (fragmentado).
  - `off`: desativar o streaming de rascunhos.
- Opcional (apenas para `streamMode: "block"`):
  - `channels.telegram.draftChunk: { minChars?, maxChars?, breakPreference? }`
    - padroes: `minChars: 200`, `maxChars: 800`, `breakPreference: "paragraph"` (limitado a `channels.telegram.textChunkLimit`).

Nota: o streaming de rascunhos e separado do **streaming em blocos** (mensagens de canal).
O streaming em blocos fica desativado por padrao e requer `channels.telegram.blockStreaming: true`
se voce quiser mensagens antecipadas no Telegram em vez de atualizacoes de rascunho.

Streaming de raciocinio (apenas Telegram):

- `/reasoning stream` transmite o raciocinio para a bolha de rascunho enquanto a resposta esta
  sendo gerada, depois envia a resposta final sem o raciocinio.
- Se `channels.telegram.streamMode` for `off`, o streaming de raciocinio e desativado.
  Mais contexto: [Streaming + fragmentacao](/concepts/streaming).

## Politica de retentativas

Chamadas de API do Telegram de saida tentam novamente em erros transitorios/429 com backoff exponencial e jitter. Configure via `channels.telegram.retry`. Veja [Politica de retentativas](/concepts/retry).

## Ferramenta do agente (mensagens + reacoes)

- Ferramenta: `telegram` com acao `sendMessage` (`to`, `content`, opcional `mediaUrl`, `replyToMessageId`, `messageThreadId`).
- Ferramenta: `telegram` com acao `react` (`chatId`, `messageId`, `emoji`).
- Ferramenta: `telegram` com acao `deleteMessage` (`chatId`, `messageId`).
- Semantica de remocao de reacoes: veja [/tools/reactions](/tools/reactions).
- Controle de ferramentas: `channels.telegram.actions.reactions`, `channels.telegram.actions.sendMessage`, `channels.telegram.actions.deleteMessage` (padrao: habilitado) e `channels.telegram.actions.sticker` (padrao: desativado).

## Notificacoes de reacoes

**Como as reacoes funcionam:**
Reacoes do Telegram chegam como **eventos `message_reaction` separados**, nao como propriedades no payload da mensagem. Quando um usuario adiciona uma reacao, o OpenClaw:

1. Recebe a atualizacao `message_reaction` da API do Telegram
2. Converte em um **evento de sistema** com o formato: `"Telegram reaction added: {emoji} by {user} on msg {id}"`
3. Enfileira o evento de sistema usando a **mesma chave de sessao** que mensagens regulares
4. Quando a proxima mensagem chega naquela conversa, os eventos de sistema sao drenados e preprendidos ao contexto do agente

O agente ve reacoes como **notificacoes de sistema** no historico da conversa, nao como metadados de mensagem.

**Configuracao:**

- `channels.telegram.reactionNotifications`: Controla quais reacoes disparam notificacoes
  - `"off"` — ignorar todas as reacoes
  - `"own"` — notificar quando usuarios reagem a mensagens do bot (best-effort; em memoria) (padrao)
  - `"all"` — notificar para todas as reacoes

- `channels.telegram.reactionLevel`: Controla a capacidade de reacao do agente
  - `"off"` — o agente nao pode reagir a mensagens
  - `"ack"` — o bot envia reacoes de confirmacao (👀 enquanto processa) (padrao)
  - `"minimal"` — o agente pode reagir com parcimonia (diretriz: 1 a cada 5–10 trocas)
  - `"extensive"` — o agente pode reagir liberalmente quando apropriado

**Grupos de forum:** Reacoes em grupos de forum incluem `message_thread_id` e usam chaves de sessao como `agent:main:telegram:group:{chatId}:topic:{threadId}`. Isso garante que reacoes e mensagens no mesmo topico permaneçam juntas.

**Exemplo de configuracao:**

```json5
{
  channels: {
    telegram: {
      reactionNotifications: "all", // See all reactions
      reactionLevel: "minimal", // Agent can react sparingly
    },
  },
}
```

**Requisitos:**

- Bots do Telegram devem solicitar explicitamente `message_reaction` em `allowed_updates` (configurado automaticamente pelo OpenClaw)
- No modo webhook, as reacoes sao incluidas no webhook `allowed_updates`
- No modo polling, as reacoes sao incluidas no `getUpdates` `allowed_updates`

## Destinos de entrega (CLI/cron)

- Use um chat id (`123456789`) ou um username (`@name`) como destino.
- Exemplo: `openclaw message send --channel telegram --target 123456789 --message "hi"`.

## Solucao de problemas

**O bot nao responde a mensagens sem mencao em um grupo:**

- Se voce definiu `channels.telegram.groups.*.requireMention=false`, o **modo de privacidade** da Bot API do Telegram deve estar desativado.
  - BotFather: `/setprivacy` → **Disable** (depois remova e readicione o bot ao grupo)
- `openclaw channels status` mostra um aviso quando a configuracao espera mensagens de grupo sem mencao.
- `openclaw channels status --probe` pode adicionalmente verificar a associacao para IDs numericos de grupo explicitos (nao consegue auditar regras curinga `"*"`).
- Teste rapido: `/activation always` (apenas sessao; use configuracao para persistencia)

**O bot nao ve mensagens de grupo de forma alguma:**

- Se `channels.telegram.groups` estiver definido, o grupo deve estar listado ou usar `"*"`
- Verifique as Configuracoes de Privacidade no @BotFather → "Group Privacy" deve estar **OFF**
- Verifique se o bot realmente e membro (nao apenas admin sem acesso de leitura)
- Verifique os logs do Gateway: `openclaw logs --follow` (procure por "skipping group message")

**O bot responde a mencoes mas nao a `/activation always`:**

- O comando `/activation` atualiza o estado da sessao, mas nao persiste na configuracao
- Para comportamento persistente, adicione o grupo a `channels.telegram.groups` com `requireMention: false`

**Comandos como `/status` nao funcionam:**

- Certifique-se de que seu ID de usuario do Telegram esta autorizado (via pareamento ou `channels.telegram.allowFrom`)
- Comandos exigem autorizacao mesmo em grupos com `groupPolicy: "open"`

**O long-polling aborta imediatamente no Node 22+ (frequentemente com proxies/fetch customizado):**

- O Node 22+ e mais rigoroso com instancias de `AbortSignal`; sinais estrangeiros podem abortar chamadas `fetch` imediatamente.
- Atualize para uma versao do OpenClaw que normalize sinais de abort, ou execute o Gateway no Node 20 ate poder atualizar.

**O bot inicia e depois para silenciosamente de responder (ou registra `HttpError: Network request ... failed`):**

- Alguns hosts resolvem `api.telegram.org` para IPv6 primeiro. Se seu servidor nao tiver egresso IPv6 funcional, o grammY pode travar em requisicoes apenas IPv6.
- Corrija habilitando egresso IPv6 **ou** forcando resolucao IPv4 para `api.telegram.org` (por exemplo, adicione uma entrada `/etc/hosts` usando o registro A IPv4, ou prefira IPv4 na pilha DNS do seu SO), depois reinicie o Gateway.
- Verificacao rapida: `dig +short api.telegram.org A` e `dig +short api.telegram.org AAAA` para confirmar o que o DNS retorna.

## Referencia de configuracao (Telegram)

Configuracao completa: [Configuracao](/gateway/configuration)

Opcoes do provedor:

- `channels.telegram.enabled`: habilitar/desabilitar inicializacao do canal.
- `channels.telegram.botToken`: token do bot (BotFather).
- `channels.telegram.tokenFile`: ler token a partir de um caminho de arquivo.
- `channels.telegram.dmPolicy`: `pairing | allowlist | open | disabled` (padrao: pareamento).
- `channels.telegram.allowFrom`: allowlist de Mensagens diretas (ids/usernames). `open` requer `"*"`.
- `channels.telegram.groupPolicy`: `open | allowlist | disabled` (padrao: allowlist).
- `channels.telegram.groupAllowFrom`: allowlist de remetentes de grupo (ids/usernames).
- `channels.telegram.groups`: padroes por grupo + allowlist (use `"*"` para padroes globais).
  - `channels.telegram.groups.<id>.groupPolicy`: sobrescrita por grupo para groupPolicy (`open | allowlist | disabled`).
  - `channels.telegram.groups.<id>.requireMention`: padrao de exigencia de mencao.
  - `channels.telegram.groups.<id>.skills`: filtro de skills (omitir = todas as skills, vazio = nenhuma).
  - `channels.telegram.groups.<id>.allowFrom`: sobrescrita por grupo da allowlist de remetentes.
  - `channels.telegram.groups.<id>.systemPrompt`: prompt de sistema extra para o grupo.
  - `channels.telegram.groups.<id>.enabled`: desativar o grupo quando `false`.
  - `channels.telegram.groups.<id>.topics.<threadId>.*`: sobrescritas por topico (mesmos campos do grupo).
  - `channels.telegram.groups.<id>.topics.<threadId>.groupPolicy`: sobrescrita por topico para groupPolicy (`open | allowlist | disabled`).
  - `channels.telegram.groups.<id>.topics.<threadId>.requireMention`: sobrescrita por topico da exigencia de mencao.
- `channels.telegram.capabilities.inlineButtons`: `off | dm | group | all | allowlist` (padrao: allowlist).
- `channels.telegram.accounts.<account>.capabilities.inlineButtons`: sobrescrita por conta.
- `channels.telegram.replyToMode`: `off | first | all` (padrao: `first`).
- `channels.telegram.textChunkLimit`: tamanho do fragmento de saida (caracteres).
- `channels.telegram.chunkMode`: `length` (padrao) ou `newline` para dividir em linhas em branco (limites de paragrafo) antes da fragmentacao por tamanho.
- `channels.telegram.linkPreview`: alternar previews de link para mensagens de saida (padrao: true).
- `channels.telegram.streamMode`: `off | partial | block` (streaming de rascunhos).
- `channels.telegram.mediaMaxMb`: limite de midia de entrada/saida (MB).
- `channels.telegram.retry`: politica de retentativas para chamadas de API do Telegram de saida (tentativas, minDelayMs, maxDelayMs, jitter).
- `channels.telegram.network.autoSelectFamily`: sobrescrever autoSelectFamily do Node (true=habilitar, false=desabilitar). Padrao desativado no Node 22 para evitar timeouts do Happy Eyeballs.
- `channels.telegram.proxy`: URL de proxy para chamadas da Bot API (SOCKS/HTTP).
- `channels.telegram.webhookUrl`: habilitar modo webhook (requer `channels.telegram.webhookSecret`).
- `channels.telegram.webhookSecret`: segredo do webhook (obrigatorio quando webhookUrl esta definido).
- `channels.telegram.webhookPath`: caminho local do webhook (padrao `/telegram-webhook`).
- `channels.telegram.actions.reactions`: controlar reacoes da ferramenta do Telegram.
- `channels.telegram.actions.sendMessage`: controlar envios de mensagens da ferramenta do Telegram.
- `channels.telegram.actions.deleteMessage`: controlar exclusoes de mensagens da ferramenta do Telegram.
- `channels.telegram.actions.sticker`: controlar acoes de figurinhas do Telegram — enviar e buscar (padrao: false).
- `channels.telegram.reactionNotifications`: `off | own | all` — controlar quais reacoes disparam eventos de sistema (padrao: `own` quando nao definido).
- `channels.telegram.reactionLevel`: `off | ack | minimal | extensive` — controlar a capacidade de reacao do agente (padrao: `minimal` quando nao definido).

Opcoes globais relacionadas:

- `agents.list[].groupChat.mentionPatterns` (padroes de exigencia de mencao).
- `messages.groupChat.mentionPatterns` (fallback global).
- `commands.native` (padrao para `"auto"` → ligado para Telegram/Discord, desligado para Slack), `commands.text`, `commands.useAccessGroups` (comportamento de comandos). Sobrescreva com `channels.telegram.commands.native`.
- `messages.responsePrefix`, `messages.ackReaction`, `messages.ackReactionScope`, `messages.removeAckAfterReply`.
