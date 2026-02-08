---
summary: "Status de suporte do bot do Discord, capacidades e configuração"
read_when:
  - Trabalhando em recursos do canal Discord
title: "Discord"
x-i18n:
  source_path: channels/discord.md
  source_hash: 9bebfe8027ff1972
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:01Z
---

# Discord (Bot API)

Status: pronto para Mensagens diretas e canais de texto de guildas via o gateway oficial de bots do Discord.

## Inicio rapido (iniciante)

1. Crie um bot do Discord e copie o token do bot.
2. Nas configurações do app do Discord, habilite **Message Content Intent** (e **Server Members Intent** se você pretende usar allowlists ou buscas por nome).
3. Defina o token para o OpenClaw:
   - Env: `DISCORD_BOT_TOKEN=...`
   - Ou config: `channels.discord.token: "..."`.
   - Se ambos estiverem definidos, a config tem precedência (o fallback por env é apenas para a conta padrão).
4. Convide o bot para o seu servidor com permissões de mensagens (crie um servidor privado se você só quiser Mensagens diretas).
5. Inicie o Gateway.
6. O acesso por Mensagens diretas é pareamento por padrão; aprove o código de pareamento no primeiro contato.

Config mínima:

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "YOUR_BOT_TOKEN",
    },
  },
}
```

## Objetivos

- Falar com o OpenClaw via Mensagens diretas do Discord ou canais de guilda.
- Conversas diretas colapsam na sessao principal do agente (padrão `agent:main:main`); canais de guilda permanecem isolados como `agent:<agentId>:discord:channel:<channelId>` (nomes exibidos usam `discord:<guildSlug>#<channelSlug>`).
- DMs em grupo são ignoradas por padrão; habilite via `channels.discord.dm.groupEnabled` e, opcionalmente, restrinja por `channels.discord.dm.groupChannels`.
- Manter o roteamento determinístico: respostas sempre voltam para o canal de onde chegaram.

## Como funciona

1. Crie um aplicativo do Discord → Bot, habilite os intents necessários (DMs + mensagens de guilda + conteúdo de mensagens) e pegue o token do bot.
2. Convide o bot para o seu servidor com as permissões necessárias para ler/enviar mensagens onde você quiser usá-lo.
3. Configure o OpenClaw com `channels.discord.token` (ou `DISCORD_BOT_TOKEN` como fallback).
4. Execute o Gateway; ele inicia automaticamente o canal do Discord quando um token está disponível (config primeiro, env como fallback) e `channels.discord.enabled` não é `false`.
   - Se você preferir variaveis de ambiente, defina `DISCORD_BOT_TOKEN` (um bloco de config é opcional).
5. Conversas diretas: use `user:<id>` (ou uma menção `<@id>`) ao entregar; todas as interações caem na sessao compartilhada `main`. IDs numéricos puros são ambíguos e rejeitados.
6. Canais de guilda: use `channel:<channelId>` para entrega. Menções são exigidas por padrão e podem ser definidas por guilda ou por canal.
7. Conversas diretas: seguras por padrão via `channels.discord.dm.policy` (padrão: `"pairing"`). Remetentes desconhecidos recebem um código de pareamento (expira após 1 hora); aprove via `openclaw pairing approve discord <code>`.
   - Para manter o comportamento antigo “aberto a qualquer um”: defina `channels.discord.dm.policy="open"` e `channels.discord.dm.allowFrom=["*"]`.
   - Para allowlist rígida: defina `channels.discord.dm.policy="allowlist"` e liste remetentes em `channels.discord.dm.allowFrom`.
   - Para ignorar todas as Mensagens diretas: defina `channels.discord.dm.enabled=false` ou `channels.discord.dm.policy="disabled"`.
8. DMs em grupo são ignoradas por padrão; habilite via `channels.discord.dm.groupEnabled` e, opcionalmente, restrinja por `channels.discord.dm.groupChannels`.
9. Regras opcionais de guilda: defina `channels.discord.guilds` com chave pelo id da guilda (preferido) ou slug, com regras por canal.
10. Comandos nativos opcionais: `commands.native` usa `"auto"` por padrão (ligado para Discord/Telegram, desligado para Slack). Substitua com `channels.discord.commands.native: true|false|"auto"`; `false` limpa comandos registrados anteriormente. Comandos de texto são controlados por `commands.text` e devem ser enviados como mensagens `/...` independentes. Use `commands.useAccessGroups: false` para ignorar verificações de grupos de acesso para comandos.
    - Lista completa de comandos + config: [Slash commands](/tools/slash-commands)
11. Histórico de contexto opcional da guilda: defina `channels.discord.historyLimit` (padrão 20, fallback para `messages.groupChat.historyLimit`) para incluir as últimas N mensagens da guilda como contexto ao responder a uma menção. Defina `0` para desabilitar.
12. Reações: o agente pode disparar reações via a ferramenta `discord` (controlada por `channels.discord.actions.*`).
    - Semântica de remoção de reações: veja [/tools/reactions](/tools/reactions).
    - A ferramenta `discord` só é exposta quando o canal atual é Discord.
13. Comandos nativos usam chaves de sessao isoladas (`agent:<agentId>:discord:slash:<userId>`) em vez da sessao compartilhada `main`.

Nota: A resolução de nome → id usa a busca de membros da guilda e requer Server Members Intent; se o bot não puder buscar membros, use ids ou menções `<@id>`.
Nota: Slugs são minúsculos com espaços substituídos por `-`. Nomes de canais são transformados em slug sem o `#` inicial.
Nota: Linhas de contexto da guilda `[from:]` incluem `author.tag` + `id` para facilitar respostas prontas para ping.

## Escritas de config

Por padrão, o Discord tem permissão para escrever atualizações de config disparadas por `/config set|unset` (requer `commands.config: true`).

Desative com:

```json5
{
  channels: { discord: { configWrites: false } },
}
```

## Como criar seu próprio bot

Este é o setup do “Discord Developer Portal” para executar o OpenClaw em um canal de servidor (guilda) como `#help`.

### 1) Criar o app do Discord + usuário bot

1. Discord Developer Portal → **Applications** → **New Application**
2. No seu app:
   - **Bot** → **Add Bot**
   - Copie o **Bot Token** (é isso que você coloca em `DISCORD_BOT_TOKEN`)

### 2) Habilitar os gateway intents que o OpenClaw precisa

O Discord bloqueia “intents privilegiados” a menos que você os habilite explicitamente.

Em **Bot** → **Privileged Gateway Intents**, habilite:

- **Message Content Intent** (obrigatório para ler o texto das mensagens na maioria das guildas; sem isso você verá “Used disallowed intents” ou o bot conectará mas não reagirá às mensagens)
- **Server Members Intent** (recomendado; necessário para algumas buscas de membros/usuários e correspondência de allowlist em guildas)

Normalmente você **não** precisa de **Presence Intent**. Definir a própria presença do bot (ação `setPresence`) usa o gateway OP3 e não requer esse intent; ele só é necessário se você quiser receber atualizações de presença de outros membros da guilda.

### 3) Gerar uma URL de convite (OAuth2 URL Generator)

No seu app: **OAuth2** → **URL Generator**

**Scopes**

- ✅ `bot`
- ✅ `applications.commands` (obrigatório para comandos nativos)

**Permissões do Bot** (linha de base mínima)

- ✅ Ver Canais
- ✅ Enviar Mensagens
- ✅ Ler Histórico de Mensagens
- ✅ Incorporar Links
- ✅ Anexar Arquivos
- ✅ Adicionar Reações (opcional, mas recomendado)
- ✅ Usar Emojis / Stickers Externos (opcional; apenas se você quiser)

Evite **Administrator** a menos que você esteja depurando e confie totalmente no bot.

Copie a URL gerada, abra-a, escolha seu servidor e instale o bot.

### 4) Obter os ids (guilda/usuário/canal)

O Discord usa ids numéricos em todos os lugares; a config do OpenClaw prefere ids.

1. Discord (desktop/web) → **User Settings** → **Advanced** → habilite **Developer Mode**
2. Clique com o botão direito:
   - Nome do servidor → **Copy Server ID** (id da guilda)
   - Canal (por exemplo, `#help`) → **Copy Channel ID**
   - Seu usuário → **Copy User ID**

### 5) Configurar o OpenClaw

#### Token

Defina o token do bot via env var (recomendado em servidores):

- `DISCORD_BOT_TOKEN=...`

Ou via config:

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "YOUR_BOT_TOKEN",
    },
  },
}
```

Suporte a múltiplas contas: use `channels.discord.accounts` com tokens por conta e `name` opcional. Veja [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) para o padrão compartilhado.

#### Allowlist + roteamento de canais

Exemplo “um único servidor, permitir só eu, permitir só #help”:

```json5
{
  channels: {
    discord: {
      enabled: true,
      dm: { enabled: false },
      guilds: {
        YOUR_GUILD_ID: {
          users: ["YOUR_USER_ID"],
          requireMention: true,
          channels: {
            help: { allow: true, requireMention: true },
          },
        },
      },
      retry: {
        attempts: 3,
        minDelayMs: 500,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
  },
}
```

Notas:

- `requireMention: true` significa que o bot só responde quando é mencionado (recomendado para canais compartilhados).
- `agents.list[].groupChat.mentionPatterns` (ou `messages.groupChat.mentionPatterns`) também contam como menções para mensagens de guilda.
- Substituição multi-agente: defina padrões por agente em `agents.list[].groupChat.mentionPatterns`.
- Se `channels` estiver presente, qualquer canal não listado é negado por padrão.
- Use uma entrada de canal `"*"` para aplicar padrões a todos os canais; entradas explícitas de canal substituem o curinga.
- Tópicos herdam a config do canal pai (allowlist, `requireMention`, skills, prompts etc.) a menos que você adicione explicitamente o id do canal do tópico.
- Dica de owner: quando uma allowlist `users` por guilda ou por canal corresponde ao remetente, o OpenClaw trata esse remetente como owner no prompt do sistema. Para um owner global entre canais, defina `commands.ownerAllowFrom`.
- Mensagens do próprio bot são ignoradas por padrão; defina `channels.discord.allowBots=true` para permiti-las (mensagens próprias continuam filtradas).
- Aviso: Se você permitir respostas a outros bots (`channels.discord.allowBots=true`), evite loops de bot-para-bot com `requireMention`, allowlists `channels.discord.guilds.*.channels.<id>.users` e/ou limpe guardrails em `AGENTS.md` e `SOUL.md`.

### 6) Verificar se funciona

1. Inicie o Gateway.
2. No canal do seu servidor, envie: `@Krill hello` (ou o nome do seu bot).
3. Se nada acontecer: verifique **Solucao de problemas** abaixo.

### Solucao de problemas

- Primeiro: execute `openclaw doctor` e `openclaw channels status --probe` (avisos acionáveis + auditorias rápidas).
- **“Used disallowed intents”**: habilite **Message Content Intent** (e provavelmente **Server Members Intent**) no Developer Portal e reinicie o Gateway.
- **O bot conecta mas nunca responde em um canal de guilda**:
  - Falta **Message Content Intent**, ou
  - O bot não tem permissões do canal (Ver/Enviar/Ler Histórico), ou
  - Sua config exige menções e você não mencionou, ou
  - Sua allowlist de guilda/canal nega o canal/usuário.
- **`requireMention: false` mas ainda sem respostas**:
- `channels.discord.groupPolicy` usa **allowlist** por padrão; defina para `"open"` ou adicione uma entrada de guilda em `channels.discord.guilds` (opcionalmente liste canais em `channels.discord.guilds.<id>.channels` para restringir).
  - Se você só definir `DISCORD_BOT_TOKEN` e nunca criar uma seção `channels.discord`, o runtime
    define `groupPolicy` como `open`. Adicione `channels.discord.groupPolicy`,
    `channels.defaults.groupPolicy`, ou uma allowlist de guilda/canal para restringir.
- `requireMention` deve ficar sob `channels.discord.guilds` (ou um canal específico). `channels.discord.requireMention` no nível superior é ignorado.
- **Auditorias de permissões** (`channels status --probe`) só verificam IDs numéricos de canais. Se você usar slugs/nomes como chaves `channels.discord.guilds.*.channels`, a auditoria não consegue verificar permissões.
- **Mensagens diretas não funcionam**: `channels.discord.dm.enabled=false`, `channels.discord.dm.policy="disabled"`, ou você ainda não foi aprovado (`channels.discord.dm.policy="pairing"`).
- **Aprovações de exec no Discord**: o Discord oferece uma **UI de botões** para aprovações de exec em Mensagens diretas (Permitir uma vez / Permitir sempre / Negar). `/approve <id> ...` é apenas para aprovações encaminhadas e não resolve os prompts de botões do Discord. Se você vir `❌ Failed to submit approval: Error: unknown approval id` ou a UI nunca aparecer, verifique:
  - `channels.discord.execApprovals.enabled: true` na sua config.
  - Seu ID de usuário do Discord está listado em `channels.discord.execApprovals.approvers` (a UI só é enviada para aprovadores).
  - Use os botões no prompt de DM (**Permitir uma vez**, **Permitir sempre**, **Negar**).
  - Veja [Exec approvals](/tools/exec-approvals) e [Slash commands](/tools/slash-commands) para o fluxo mais amplo de aprovações e comandos.

## Capacidades e limites

- Mensagens diretas e canais de texto de guilda (tópicos são tratados como canais separados; voz não é suportada).
- Indicadores de digitação enviados em melhor esforço; o fracionamento de mensagens usa `channels.discord.textChunkLimit` (padrão 2000) e divide respostas longas por contagem de linhas (`channels.discord.maxLinesPerMessage`, padrão 17).
- Fracionamento opcional por nova linha: defina `channels.discord.chunkMode="newline"` para dividir em linhas em branco (limites de parágrafo) antes do fracionamento por comprimento.
- Upload de arquivos suportado até o `channels.discord.mediaMaxMb` configurado (padrão 8 MB).
- Respostas em guilda com menção obrigatória por padrão para evitar bots barulhentos.
- Contexto de resposta é injetado quando uma mensagem referencia outra mensagem (conteúdo citado + ids).
- Threading nativo de respostas é **desligado por padrão**; habilite com `channels.discord.replyToMode` e reply tags.

## Política de retry

Chamadas de saída da API do Discord fazem retry em limites de taxa (429) usando `retry_after` do Discord quando disponível, com backoff exponencial e jitter. Configure via `channels.discord.retry`. Veja [Retry policy](/concepts/retry).

## Config

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "abc.123",
      groupPolicy: "allowlist",
      guilds: {
        "*": {
          channels: {
            general: { allow: true },
          },
        },
      },
      mediaMaxMb: 8,
      actions: {
        reactions: true,
        stickers: true,
        emojiUploads: true,
        stickerUploads: true,
        polls: true,
        permissions: true,
        messages: true,
        threads: true,
        pins: true,
        search: true,
        memberInfo: true,
        roleInfo: true,
        roles: false,
        channelInfo: true,
        channels: true,
        voiceStatus: true,
        events: true,
        moderation: false,
        presence: false,
      },
      replyToMode: "off",
      dm: {
        enabled: true,
        policy: "pairing", // pairing | allowlist | open | disabled
        allowFrom: ["123456789012345678", "steipete"],
        groupEnabled: false,
        groupChannels: ["openclaw-dm"],
      },
      guilds: {
        "*": { requireMention: true },
        "123456789012345678": {
          slug: "friends-of-openclaw",
          requireMention: false,
          reactionNotifications: "own",
          users: ["987654321098765432", "steipete"],
          channels: {
            general: { allow: true },
            help: {
              allow: true,
              requireMention: true,
              users: ["987654321098765432"],
              skills: ["search", "docs"],
              systemPrompt: "Keep answers short.",
            },
          },
        },
      },
    },
  },
}
```

Reações de ack são controladas globalmente via `messages.ackReaction` +
`messages.ackReactionScope`. Use `messages.removeAckAfterReply` para limpar a
reação de ack depois que o bot responde.

- `dm.enabled`: defina `false` para ignorar todas as Mensagens diretas (padrão `true`).
- `dm.policy`: controle de acesso a Mensagens diretas (`pairing` recomendado). `"open"` requer `dm.allowFrom=["*"]`.
- `dm.allowFrom`: allowlist de Mensagens diretas (ids ou nomes de usuário). Usada por `dm.policy="allowlist"` e para validação de `dm.policy="open"`. O assistente aceita nomes de usuário e os resolve para ids quando o bot pode buscar membros.
- `dm.groupEnabled`: habilitar DMs em grupo (padrão `false`).
- `dm.groupChannels`: allowlist opcional para ids ou slugs de canais de DM em grupo.
- `groupPolicy`: controla o tratamento de canais de guilda (`open|disabled|allowlist`); `allowlist` requer allowlists de canais.
- `guilds`: regras por guilda com chave por id de guilda (preferido) ou slug.
- `guilds."*"`: configurações padrão por guilda aplicadas quando não existe entrada explícita.
- `guilds.<id>.slug`: slug amigável opcional usado para nomes exibidos.
- `guilds.<id>.users`: allowlist opcional de usuários por guilda (ids ou nomes).
- `guilds.<id>.tools`: substituições opcionais de política de ferramentas por guilda (`allow`/`deny`/`alsoAllow`) usadas quando a substituição do canal está ausente.
- `guilds.<id>.toolsBySender`: substituições opcionais de política de ferramentas por remetente no nível da guilda (aplica-se quando a substituição do canal está ausente; curinga `"*"` suportado).
- `guilds.<id>.channels.<channel>.allow`: permitir/negar o canal quando `groupPolicy="allowlist"`.
- `guilds.<id>.channels.<channel>.requireMention`: controle de menção para o canal.
- `guilds.<id>.channels.<channel>.tools`: substituições opcionais de política de ferramentas por canal (`allow`/`deny`/`alsoAllow`).
- `guilds.<id>.channels.<channel>.toolsBySender`: substituições opcionais de política de ferramentas por remetente dentro do canal (curinga `"*"` suportado).
- `guilds.<id>.channels.<channel>.users`: allowlist opcional de usuários por canal.
- `guilds.<id>.channels.<channel>.skills`: filtro de skills (omitir = todas as skills, vazio = nenhuma).
- `guilds.<id>.channels.<channel>.systemPrompt`: prompt de sistema extra para o canal. Tópicos de canais do Discord são injetados como contexto **não confiável** (não como prompt de sistema).
- `guilds.<id>.channels.<channel>.enabled`: defina `false` para desabilitar o canal.
- `guilds.<id>.channels`: regras de canal (chaves são slugs ou ids de canal).
- `guilds.<id>.requireMention`: exigência de menção por guilda (substituível por canal).
- `guilds.<id>.reactionNotifications`: modo de eventos do sistema de reações (`off`, `own`, `all`, `allowlist`).
- `textChunkLimit`: tamanho de chunk de texto de saída (chars). Padrão: 2000.
- `chunkMode`: `length` (padrão) divide apenas ao exceder `textChunkLimit`; `newline` divide em linhas em branco (limites de parágrafo) antes do fracionamento por comprimento.
- `maxLinesPerMessage`: limite suave de linhas por mensagem. Padrão: 17.
- `mediaMaxMb`: limitar mídia de entrada salva em disco.
- `historyLimit`: número de mensagens recentes da guilda a incluir como contexto ao responder a uma menção (padrão 20; fallback para `messages.groupChat.historyLimit`; `0` desabilita).
- `dmHistoryLimit`: limite de histórico de DMs em turnos de usuário. Substituições por usuário: `dms["<user_id>"].historyLimit`.
- `retry`: política de retry para chamadas de saída da API do Discord (tentativas, minDelayMs, maxDelayMs, jitter).
- `pluralkit`: resolver mensagens proxied do PluralKit para que membros do sistema apareçam como remetentes distintos.
- `actions`: gates de ferramentas por ação; omitir para permitir todas (defina `false` para desabilitar).
  - `reactions` (cobre reagir + ler reações)
  - `stickers`, `emojiUploads`, `stickerUploads`, `polls`, `permissions`, `messages`, `threads`, `pins`, `search`
  - `memberInfo`, `roleInfo`, `channelInfo`, `voiceStatus`, `events`
  - `channels` (criar/editar/deletar canais + categorias + permissões)
  - `roles` (adicionar/remover cargos, padrão `false`)
  - `moderation` (timeout/kick/ban, padrão `false`)
  - `presence` (status/atividade do bot, padrão `false`)
- `execApprovals`: DMs de aprovação de exec apenas do Discord (UI de botões). Suporta `enabled`, `approvers`, `agentFilter`, `sessionFilter`.

Notificações de reações usam `guilds.<id>.reactionNotifications`:

- `off`: sem eventos de reação.
- `own`: reações nas próprias mensagens do bot (padrão).
- `all`: todas as reações em todas as mensagens.
- `allowlist`: reações de `guilds.<id>.users` em todas as mensagens (lista vazia desabilita).

### Suporte ao PluralKit (PK)

Habilite consultas PK para que mensagens proxied resolvam para o sistema + membro subjacentes.
Quando habilitado, o OpenClaw usa a identidade do membro para allowlists e rotula o
remetente como `Member (PK:System)` para evitar pings acidentais no Discord.

```json5
{
  channels: {
    discord: {
      pluralkit: {
        enabled: true,
        token: "pk_live_...", // optional; required for private systems
      },
    },
  },
}
```

Notas de allowlist (com PK habilitado):

- Use `pk:<memberId>` em `dm.allowFrom`, `guilds.<id>.users`, ou `users` por canal.
- Nomes de exibição de membros também são correspondidos por nome/slug.
- As consultas usam o ID da mensagem **original** do Discord (a mensagem pré-proxy), então
  a API do PK só a resolve dentro de sua janela de 30 minutos.
- Se as consultas PK falharem (por exemplo, sistema privado sem token), mensagens proxied
  são tratadas como mensagens de bot e descartadas, a menos que `channels.discord.allowBots=true`.

### Padrões de ações de ferramentas

| Grupo de ação  | Padrão   | Notas                                 |
| -------------- | -------- | ------------------------------------- |
| reactions      | enabled  | Reagir + listar reações + emojiList   |
| stickers       | enabled  | Enviar stickers                       |
| emojiUploads   | enabled  | Upload de emojis                      |
| stickerUploads | enabled  | Upload de stickers                    |
| polls          | enabled  | Criar enquetes                        |
| permissions    | enabled  | Snapshot de permissões do canal       |
| messages       | enabled  | Ler/enviar/editar/deletar             |
| threads        | enabled  | Criar/listar/responder                |
| pins           | enabled  | Fixar/desafixar/listar                |
| search         | enabled  | Busca de mensagens (recurso preview)  |
| memberInfo     | enabled  | Informações de membros                |
| roleInfo       | enabled  | Lista de cargos                       |
| channelInfo    | enabled  | Informações + lista de canais         |
| channels       | enabled  | Gerenciamento de canais/categorias    |
| voiceStatus    | enabled  | Consulta de estado de voz             |
| events         | enabled  | Listar/criar eventos agendados        |
| roles          | disabled | Adicionar/remover cargos              |
| moderation     | disabled | Timeout/kick/ban                      |
| presence       | disabled | Status/atividade do bot (setPresence) |

- `replyToMode`: `off` (padrão), `first`, ou `all`. Aplica-se apenas quando o modelo inclui uma reply tag.

## Reply tags

Para solicitar uma resposta em thread, o modelo pode incluir uma tag na sua saída:

- `[[reply_to_current]]` — responder à mensagem do Discord que disparou.
- `[[reply_to:<id>]]` — responder a um id de mensagem específico do contexto/histórico.
  Os ids de mensagens atuais são anexados aos prompts como `[message_id: …]`; entradas de histórico já incluem ids.

O comportamento é controlado por `channels.discord.replyToMode`:

- `off`: ignorar tags.
- `first`: apenas o primeiro chunk/anexo de saída é uma resposta.
- `all`: todo chunk/anexo de saída é uma resposta.

Notas de correspondência de allowlist:

- `allowFrom`/`users`/`groupChannels` aceitam ids, nomes, tags ou menções como `<@id>`.
- Prefixos como `discord:`/`user:` (usuários) e `channel:` (DMs em grupo) são suportados.
- Use `*` para permitir qualquer remetente/canal.
- Quando `guilds.<id>.channels` está presente, canais não listados são negados por padrão.
- Quando `guilds.<id>.channels` é omitido, todos os canais na guilda allowlisted são permitidos.
- Para permitir **nenhum canal**, defina `channels.discord.groupPolicy: "disabled"` (ou mantenha uma allowlist vazia).
- O assistente de configuração aceita nomes `Guild/Channel` (públicos + privados) e os resolve para IDs quando possível.
- Na inicialização, o OpenClaw resolve nomes de canais/usuários em allowlists para IDs (quando o bot pode buscar membros)
  e registra o mapeamento; entradas não resolvidas são mantidas como digitadas.

Notas sobre comandos nativos:

- Os comandos registrados espelham os comandos de chat do OpenClaw.
- Comandos nativos respeitam as mesmas allowlists que DMs/mensagens de guilda (`channels.discord.dm.allowFrom`, `channels.discord.guilds`, regras por canal).
- Slash commands ainda podem ficar visíveis na UI do Discord para usuários que não estão na allowlist; o OpenClaw aplica allowlists na execução e responde “não autorizado”.

## Ações de ferramentas

O agente pode chamar `discord` com ações como:

- `react` / `reactions` (adicionar ou listar reações)
- `sticker`, `poll`, `permissions`
- `readMessages`, `sendMessage`, `editMessage`, `deleteMessage`
- Payloads de leitura/busca/fixação incluem `timestampMs` normalizado (UTC epoch ms) e `timestampUtc` junto com o `timestamp` bruto do Discord.
- `threadCreate`, `threadList`, `threadReply`
- `pinMessage`, `unpinMessage`, `listPins`
- `searchMessages`, `memberInfo`, `roleInfo`, `roleAdd`, `roleRemove`, `emojiList`
- `channelInfo`, `channelList`, `voiceStatus`, `eventList`, `eventCreate`
- `timeout`, `kick`, `ban`
- `setPresence` (atividade do bot e status online)

IDs de mensagens do Discord são expostos no contexto injetado (`[discord message id: …]` e linhas de histórico) para que o agente possa direcioná-los.
Emojis podem ser unicode (por exemplo, `✅`) ou sintaxe de emoji customizado como `<:party_blob:1234567890>`.

## Segurança e operacoes

- Trate o token do bot como uma senha; prefira a env var `DISCORD_BOT_TOKEN` em hosts supervisionados ou restrinja as permissões do arquivo de config.
- Conceda ao bot apenas as permissões necessárias (tipicamente Ler/Enviar Mensagens).
- Se o bot travar ou ficar limitado por taxa, reinicie o Gateway (`openclaw gateway --force`) após confirmar que nenhum outro processo possui a sessão do Discord.
