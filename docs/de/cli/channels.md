---
summary: "CLI-Referenz fuer `openclaw channels` (Accounts, Status, Login/Logout, Logs)"
read_when:
  - Sie moechten Kanal-Accounts hinzufuegen/entfernen (WhatsApp/Telegram/Discord/Google Chat/Slack/Mattermost (Plugin)/Signal/iMessage)
  - Sie moechten den Kanalstatus pruefen oder Kanallogs verfolgen
title: "channels"
x-i18n:
  source_path: cli/channels.md
  source_hash: 16ab1642f247bfa9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:35Z
---

# `openclaw channels`

Verwalten Sie Chat-Kanal-Accounts und deren Laufzeitstatus auf dem Gateway.

Zugehoerige Dokumente:

- Kanal-Anleitungen: [Channels](/channels/index)
- Gateway-Konfiguration: [Configuration](/gateway/configuration)

## Gemeinsame Befehle

```bash
openclaw channels list
openclaw channels status
openclaw channels capabilities
openclaw channels capabilities --channel discord --target channel:123
openclaw channels resolve --channel slack "#general" "@jane"
openclaw channels logs --channel all
```

## Accounts hinzufuegen / entfernen

```bash
openclaw channels add --channel telegram --token <bot-token>
openclaw channels remove --channel telegram --delete
```

Tipp: `openclaw channels add --help` zeigt kanalspezifische Flags (Token, App-Token, signal-cli-Pfade usw.).

## Login / Logout (interaktiv)

```bash
openclaw channels login --channel whatsapp
openclaw channels logout --channel whatsapp
```

## Fehlerbehebung

- Fuehren Sie `openclaw status --deep` fuer eine breite Analyse aus.
- Verwenden Sie `openclaw doctor` fuer angeleitete Korrekturen.
- `openclaw channels list` gibt `Claude: HTTP 403 ... user:profile` aus → Der Nutzungssnapshot erfordert den Scope `user:profile`. Verwenden Sie `--no-usage` oder stellen Sie einen claude.ai-Sitzungsschluessel bereit (`CLAUDE_WEB_SESSION_KEY` / `CLAUDE_WEB_COOKIE`) oder authentifizieren Sie sich erneut ueber die Claude Code CLI.

## Faehigkeiten-Pruefung

Rufen Sie Anbieter-Faehigkeitshinweise (Intents/Scopes, wo verfuegbar) sowie statische Funktionsunterstuetzung ab:

```bash
openclaw channels capabilities
openclaw channels capabilities --channel discord --target channel:123
```

Hinweise:

- `--channel` ist optional; lassen Sie es weg, um jeden Kanal aufzulisten (einschliesslich Erweiterungen).
- `--target` akzeptiert `channel:<id>` oder eine rohe numerische Kanal-ID und gilt nur fuer Discord.
- Pruefungen sind anbieterspezifisch: Discord-Intents + optionale Kanalberechtigungen; Slack-Bot- + User-Scopes; Telegram-Bot-Flags + Webhook; Signal-Daemon-Version; MS Teams App-Token + Graph-Rollen/Scopes (wo bekannt, annotiert). Kanaele ohne Pruefung melden `Probe: unavailable`.

## Namen in IDs aufloesen

Loesen Sie Kanal-/Benutzernamen mithilfe des Anbieter-Verzeichnisses in IDs auf:

```bash
openclaw channels resolve --channel slack "#general" "@jane"
openclaw channels resolve --channel discord "My Server/#support" "@someone"
openclaw channels resolve --channel matrix "Project Room"
```

Hinweise:

- Verwenden Sie `--kind user|group|auto`, um den Zieltyp zu erzwingen.
- Bei mehreren Eintraegen mit demselben Namen wird die aktive Uebereinstimmung bevorzugt.
