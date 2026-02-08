---
summary: "CLI-Referenz fuer `openclaw message` (Senden + Kanalaktionen)"
read_when:
  - Hinzufuegen oder Aendern von Message-CLI-Aktionen
  - Aendern des ausgehenden Kanalverhaltens
title: "message"
x-i18n:
  source_path: cli/message.md
  source_hash: 35159baf1ef71362
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:57Z
---

# `openclaw message`

Ein einzelner ausgehender Befehl zum Senden von Nachrichten und fuer Kanalaktionen
(Discord/Google Chat/Slack/Mattermost (Plugin)/Telegram/WhatsApp/Signal/iMessage/MS Teams).

## Usage

```
openclaw message <subcommand> [flags]
```

Kanalauswahl:

- `--channel` erforderlich, wenn mehr als ein Kanal konfiguriert ist.
- Wenn genau ein Kanal konfiguriert ist, wird er zum Standard.
- Werte: `whatsapp|telegram|discord|googlechat|slack|mattermost|signal|imessage|msteams` (Mattermost erfordert ein Plugin)

Zielformate (`--target`):

- WhatsApp: E.164 oder Gruppen-JID
- Telegram: Chat-ID oder `@username`
- Discord: `channel:<id>` oder `user:<id>` (oder `<@id>`-Erwaehnung; rohe numerische IDs werden als Kanaele behandelt)
- Google Chat: `spaces/<spaceId>` oder `users/<userId>`
- Slack: `channel:<id>` oder `user:<id>` (rohe Kanal-ID wird akzeptiert)
- Mattermost (Plugin): `channel:<id>`, `user:<id>` oder `@username` (nackte IDs werden als Kanaele behandelt)
- Signal: `+E.164`, `group:<id>`, `signal:+E.164`, `signal:group:<id>` oder `username:<name>`/`u:<name>`
- iMessage: Handle, `chat_id:<id>`, `chat_guid:<guid>` oder `chat_identifier:<id>`
- MS Teams: Konversations-ID (`19:...@thread.tacv2`) oder `conversation:<id>` oder `user:<aad-object-id>`

Namensauflosung:

- Fuer unterstuetzte Anbieter (Discord/Slack/usw.) werden Kanalnamen wie `Help` oder `#help` ueber den Verzeichnis-Cache aufgeloest.
- Bei einem Cache-Miss versucht OpenClaw eine Live-Verzeichnisabfrage, sofern der Anbieter dies unterstuetzt.

## Common flags

- `--channel <name>`
- `--account <id>`
- `--target <dest>` (Zielkanal oder Benutzer fuer send/poll/read/etc)
- `--targets <name>` (Wiederholung; nur Broadcast)
- `--json`
- `--dry-run`
- `--verbose`

## Actions

### Core

- `send`
  - Kanaele: WhatsApp/Telegram/Discord/Google Chat/Slack/Mattermost (Plugin)/Signal/iMessage/MS Teams
  - Erforderlich: `--target`, plus `--message` oder `--media`
  - Optional: `--media`, `--reply-to`, `--thread-id`, `--gif-playback`
  - Nur Telegram: `--buttons` (erfordert `channels.telegram.capabilities.inlineButtons`, um dies zu erlauben)
  - Nur Telegram: `--thread-id` (Forum-Topic-ID)
  - Nur Slack: `--thread-id` (Thread-Zeitstempel; `--reply-to` verwendet dasselbe Feld)
  - Nur WhatsApp: `--gif-playback`

- `poll`
  - Kanaele: WhatsApp/Discord/MS Teams
  - Erforderlich: `--target`, `--poll-question`, `--poll-option` (Wiederholung)
  - Optional: `--poll-multi`
  - Nur Discord: `--poll-duration-hours`, `--message`

- `react`
  - Kanaele: Discord/Google Chat/Slack/Telegram/WhatsApp/Signal
  - Erforderlich: `--message-id`, `--target`
  - Optional: `--emoji`, `--remove`, `--participant`, `--from-me`, `--target-author`, `--target-author-uuid`
  - Hinweis: `--remove` erfordert `--emoji` (lassen Sie `--emoji` weg, um eigene Reaktionen zu entfernen, wo unterstuetzt; siehe /tools/reactions)
  - Nur WhatsApp: `--participant`, `--from-me`
  - Signal-Gruppenreaktionen: `--target-author` oder `--target-author-uuid` erforderlich

- `reactions`
  - Kanaele: Discord/Google Chat/Slack
  - Erforderlich: `--message-id`, `--target`
  - Optional: `--limit`

- `read`
  - Kanaele: Discord/Slack
  - Erforderlich: `--target`
  - Optional: `--limit`, `--before`, `--after`
  - Nur Discord: `--around`

- `edit`
  - Kanaele: Discord/Slack
  - Erforderlich: `--message-id`, `--message`, `--target`

- `delete`
  - Kanaele: Discord/Slack/Telegram
  - Erforderlich: `--message-id`, `--target`

- `pin` / `unpin`
  - Kanaele: Discord/Slack
  - Erforderlich: `--message-id`, `--target`

- `pins` (Liste)
  - Kanaele: Discord/Slack
  - Erforderlich: `--target`

- `permissions`
  - Kanaele: Discord
  - Erforderlich: `--target`

- `search`
  - Kanaele: Discord
  - Erforderlich: `--guild-id`, `--query`
  - Optional: `--channel-id`, `--channel-ids` (Wiederholung), `--author-id`, `--author-ids` (Wiederholung), `--limit`

### Threads

- `thread create`
  - Kanaele: Discord
  - Erforderlich: `--thread-name`, `--target` (Kanal-ID)
  - Optional: `--message-id`, `--auto-archive-min`

- `thread list`
  - Kanaele: Discord
  - Erforderlich: `--guild-id`
  - Optional: `--channel-id`, `--include-archived`, `--before`, `--limit`

- `thread reply`
  - Kanaele: Discord
  - Erforderlich: `--target` (Thread-ID), `--message`
  - Optional: `--media`, `--reply-to`

### Emojis

- `emoji list`
  - Discord: `--guild-id`
  - Slack: keine zusaetzlichen Flags

- `emoji upload`
  - Kanaele: Discord
  - Erforderlich: `--guild-id`, `--emoji-name`, `--media`
  - Optional: `--role-ids` (Wiederholung)

### Sticker

- `sticker send`
  - Kanaele: Discord
  - Erforderlich: `--target`, `--sticker-id` (Wiederholung)
  - Optional: `--message`

- `sticker upload`
  - Kanaele: Discord
  - Erforderlich: `--guild-id`, `--sticker-name`, `--sticker-desc`, `--sticker-tags`, `--media`

### Rollen / Kanaele / Mitglieder / Voice

- `role info` (Discord): `--guild-id`
- `role add` / `role remove` (Discord): `--guild-id`, `--user-id`, `--role-id`
- `channel info` (Discord): `--target`
- `channel list` (Discord): `--guild-id`
- `member info` (Discord/Slack): `--user-id` (+ `--guild-id` fuer Discord)
- `voice status` (Discord): `--guild-id`, `--user-id`

### Events

- `event list` (Discord): `--guild-id`
- `event create` (Discord): `--guild-id`, `--event-name`, `--start-time`
  - Optional: `--end-time`, `--desc`, `--channel-id`, `--location`, `--event-type`

### Moderation (Discord)

- `timeout`: `--guild-id`, `--user-id` (optional `--duration-min` oder `--until`; lassen Sie beide weg, um das Timeout zu loeschen)
- `kick`: `--guild-id`, `--user-id` (+ `--reason`)
- `ban`: `--guild-id`, `--user-id` (+ `--delete-days`, `--reason`)
  - `timeout` unterstuetzt auch `--reason`

### Broadcast

- `broadcast`
  - Kanaele: jeder konfigurierte Kanal; verwenden Sie `--channel all`, um alle Anbieter anzusprechen
  - Erforderlich: `--targets` (Wiederholung)
  - Optional: `--message`, `--media`, `--dry-run`

## Examples

Eine Discord-Antwort senden:

```
openclaw message send --channel discord \
  --target channel:123 --message "hi" --reply-to 456
```

Eine Discord-Umfrage erstellen:

```
openclaw message poll --channel discord \
  --target channel:123 \
  --poll-question "Snack?" \
  --poll-option Pizza --poll-option Sushi \
  --poll-multi --poll-duration-hours 48
```

Eine proaktive Teams-Nachricht senden:

```
openclaw message send --channel msteams \
  --target conversation:19:abc@thread.tacv2 --message "hi"
```

Eine Teams-Umfrage erstellen:

```
openclaw message poll --channel msteams \
  --target conversation:19:abc@thread.tacv2 \
  --poll-question "Lunch?" \
  --poll-option Pizza --poll-option Sushi
```

In Slack reagieren:

```
openclaw message react --channel slack \
  --target C123 --message-id 456 --emoji "✅"
```

In einer Signal-Gruppe reagieren:

```
openclaw message react --channel signal \
  --target signal:group:abc123 --message-id 1737630212345 \
  --emoji "✅" --target-author-uuid 123e4567-e89b-12d3-a456-426614174000
```

Telegram-Inline-Buttons senden:

```
openclaw message send --channel telegram --target @mychat --message "Choose:" \
  --buttons '[ [{"text":"Yes","callback_data":"cmd:yes"}], [{"text":"No","callback_data":"cmd:no"}] ]'
```
