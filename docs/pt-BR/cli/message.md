---
summary: "Referencia da CLI para `openclaw message` (envio + acoes de canal)"
read_when:
  - Adicionando ou modificando acoes da CLI de mensagens
  - Alterando o comportamento de canais de saida
title: "mensagem"
x-i18n:
  source_path: cli/message.md
  source_hash: 35159baf1ef71362
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:52Z
---

# `openclaw message`

Comando unico de saida para enviar mensagens e acoes de canal
(Discord/Google Chat/Slack/Mattermost (plugin)/Telegram/WhatsApp/Signal/iMessage/MS Teams).

## Uso

```
openclaw message <subcommand> [flags]
```

Selecao de canal:

- `--channel` obrigatorio se mais de um canal estiver configurado.
- Se exatamente um canal estiver configurado, ele se torna o padrao.
- Valores: `whatsapp|telegram|discord|googlechat|slack|mattermost|signal|imessage|msteams` (Mattermost requer plugin)

Formatos de destino (`--target`):

- WhatsApp: E.164 ou JID de grupo
- Telegram: id do chat ou `@username`
- Discord: `channel:<id>` ou `user:<id>` (ou mencao `<@id>`; ids numericos brutos sao tratados como canais)
- Google Chat: `spaces/<spaceId>` ou `users/<userId>`
- Slack: `channel:<id>` ou `user:<id>` (id de canal bruto e aceito)
- Mattermost (plugin): `channel:<id>`, `user:<id>`, ou `@username` (ids simples sao tratados como canais)
- Signal: `+E.164`, `group:<id>`, `signal:+E.164`, `signal:group:<id>`, ou `username:<name>`/`u:<name>`
- iMessage: identificador, `chat_id:<id>`, `chat_guid:<guid>`, ou `chat_identifier:<id>`
- MS Teams: id de conversa (`19:...@thread.tacv2`) ou `conversation:<id>` ou `user:<aad-object-id>`

Busca por nome:

- Para provedores com suporte (Discord/Slack/etc), nomes de canais como `Help` ou `#help` sao resolvidos via o cache de diretorio.
- Em caso de falha no cache, o OpenClaw tentara uma busca ao vivo no diretorio quando o provedor oferecer suporte.

## Flags comuns

- `--channel <name>`
- `--account <id>`
- `--target <dest>` (canal ou usuario alvo para send/poll/read/etc)
- `--targets <name>` (repetir; somente broadcast)
- `--json`
- `--dry-run`
- `--verbose`

## Acoes

### Nucleo

- `send`
  - Canais: WhatsApp/Telegram/Discord/Google Chat/Slack/Mattermost (plugin)/Signal/iMessage/MS Teams
  - Obrigatorio: `--target`, mais `--message` ou `--media`
  - Opcional: `--media`, `--reply-to`, `--thread-id`, `--gif-playback`
  - Apenas Telegram: `--buttons` (requer `channels.telegram.capabilities.inlineButtons` para permitir)
  - Apenas Telegram: `--thread-id` (id do topico do forum)
  - Apenas Slack: `--thread-id` (timestamp da thread; `--reply-to` usa o mesmo campo)
  - Apenas WhatsApp: `--gif-playback`

- `poll`
  - Canais: WhatsApp/Discord/MS Teams
  - Obrigatorio: `--target`, `--poll-question`, `--poll-option` (repetir)
  - Opcional: `--poll-multi`
  - Apenas Discord: `--poll-duration-hours`, `--message`

- `react`
  - Canais: Discord/Google Chat/Slack/Telegram/WhatsApp/Signal
  - Obrigatorio: `--message-id`, `--target`
  - Opcional: `--emoji`, `--remove`, `--participant`, `--from-me`, `--target-author`, `--target-author-uuid`
  - Nota: `--remove` requer `--emoji` (omita `--emoji` para limpar suas proprias reacoes quando suportado; veja /tools/reactions)
  - Apenas WhatsApp: `--participant`, `--from-me`
  - Reacoes em grupo do Signal: `--target-author` ou `--target-author-uuid` obrigatorio

- `reactions`
  - Canais: Discord/Google Chat/Slack
  - Obrigatorio: `--message-id`, `--target`
  - Opcional: `--limit`

- `read`
  - Canais: Discord/Slack
  - Obrigatorio: `--target`
  - Opcional: `--limit`, `--before`, `--after`
  - Apenas Discord: `--around`

- `edit`
  - Canais: Discord/Slack
  - Obrigatorio: `--message-id`, `--message`, `--target`

- `delete`
  - Canais: Discord/Slack/Telegram
  - Obrigatorio: `--message-id`, `--target`

- `pin` / `unpin`
  - Canais: Discord/Slack
  - Obrigatorio: `--message-id`, `--target`

- `pins` (lista)
  - Canais: Discord/Slack
  - Obrigatorio: `--target`

- `permissions`
  - Canais: Discord
  - Obrigatorio: `--target`

- `search`
  - Canais: Discord
  - Obrigatorio: `--guild-id`, `--query`
  - Opcional: `--channel-id`, `--channel-ids` (repetir), `--author-id`, `--author-ids` (repetir), `--limit`

### Threads

- `thread create`
  - Canais: Discord
  - Obrigatorio: `--thread-name`, `--target` (id do canal)
  - Opcional: `--message-id`, `--auto-archive-min`

- `thread list`
  - Canais: Discord
  - Obrigatorio: `--guild-id`
  - Opcional: `--channel-id`, `--include-archived`, `--before`, `--limit`

- `thread reply`
  - Canais: Discord
  - Obrigatorio: `--target` (id da thread), `--message`
  - Opcional: `--media`, `--reply-to`

### Emojis

- `emoji list`
  - Discord: `--guild-id`
  - Slack: sem flags extras

- `emoji upload`
  - Canais: Discord
  - Obrigatorio: `--guild-id`, `--emoji-name`, `--media`
  - Opcional: `--role-ids` (repetir)

### Figurinhas

- `sticker send`
  - Canais: Discord
  - Obrigatorio: `--target`, `--sticker-id` (repetir)
  - Opcional: `--message`

- `sticker upload`
  - Canais: Discord
  - Obrigatorio: `--guild-id`, `--sticker-name`, `--sticker-desc`, `--sticker-tags`, `--media`

### Funcoes / Canais / Membros / Voz

- `role info` (Discord): `--guild-id`
- `role add` / `role remove` (Discord): `--guild-id`, `--user-id`, `--role-id`
- `channel info` (Discord): `--target`
- `channel list` (Discord): `--guild-id`
- `member info` (Discord/Slack): `--user-id` (+ `--guild-id` para Discord)
- `voice status` (Discord): `--guild-id`, `--user-id`

### Eventos

- `event list` (Discord): `--guild-id`
- `event create` (Discord): `--guild-id`, `--event-name`, `--start-time`
  - Opcional: `--end-time`, `--desc`, `--channel-id`, `--location`, `--event-type`

### Moderacao (Discord)

- `timeout`: `--guild-id`, `--user-id` (opcional `--duration-min` ou `--until`; omita ambos para limpar o timeout)
- `kick`: `--guild-id`, `--user-id` (+ `--reason`)
- `ban`: `--guild-id`, `--user-id` (+ `--delete-days`, `--reason`)
  - `timeout` tambem oferece suporte a `--reason`

### Broadcast

- `broadcast`
  - Canais: qualquer canal configurado; use `--channel all` para atingir todos os provedores
  - Obrigatorio: `--targets` (repetir)
  - Opcional: `--message`, `--media`, `--dry-run`

## Exemplos

Enviar uma resposta no Discord:

```
openclaw message send --channel discord \
  --target channel:123 --message "hi" --reply-to 456
```

Criar uma enquete no Discord:

```
openclaw message poll --channel discord \
  --target channel:123 \
  --poll-question "Snack?" \
  --poll-option Pizza --poll-option Sushi \
  --poll-multi --poll-duration-hours 48
```

Enviar uma mensagem proativa no Teams:

```
openclaw message send --channel msteams \
  --target conversation:19:abc@thread.tacv2 --message "hi"
```

Criar uma enquete no Teams:

```
openclaw message poll --channel msteams \
  --target conversation:19:abc@thread.tacv2 \
  --poll-question "Lunch?" \
  --poll-option Pizza --poll-option Sushi
```

Reagir no Slack:

```
openclaw message react --channel slack \
  --target C123 --message-id 456 --emoji "✅"
```

Reagir em um grupo do Signal:

```
openclaw message react --channel signal \
  --target signal:group:abc123 --message-id 1737630212345 \
  --emoji "✅" --target-author-uuid 123e4567-e89b-12d3-a456-426614174000
```

Enviar botoes inline do Telegram:

```
openclaw message send --channel telegram --target @mychat --message "Choose:" \
  --buttons '[ [{"text":"Yes","callback_data":"cmd:yes"}], [{"text":"No","callback_data":"cmd:no"}] ]'
```
