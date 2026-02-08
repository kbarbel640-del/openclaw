---
summary: "CLI-Referenz für `openclaw directory` (self, peers, groups)"
read_when:
  - Sie möchten Kontakt-/Gruppen-/Self-IDs für einen Kanal nachschlagen
  - Sie entwickeln einen Kanalverzeichnis-Adapter
title: "Verzeichnis"
x-i18n:
  source_path: cli/directory.md
  source_hash: 7c878d9013aeaa22
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:40Z
---

# `openclaw directory`

Verzeichnisabfragen für Kanäle, die dies unterstützen (Kontakte/Peers, Gruppen und „ich“).

## Allgemeine Flags

- `--channel <name>`: Kanal-ID/Alias (erforderlich, wenn mehrere Kanäle konfiguriert sind; automatisch, wenn nur einer konfiguriert ist)
- `--account <id>`: Konto-ID (Standard: Kanalstandard)
- `--json`: JSON-Ausgabe

## Hinweise

- `directory` soll Ihnen helfen, IDs zu finden, die Sie in andere Befehle einfügen können (insbesondere `openclaw message send --target ...`).
- Für viele Kanäle sind die Ergebnisse konfigurationsbasiert (Allowlists / konfigurierte Gruppen) und kein Live-Verzeichnis des Anbieters.
- Die Standardausgabe ist `id` (und manchmal `name`), getrennt durch einen Tab; verwenden Sie `--json` für Skripting.

## Verwendung der Ergebnisse mit `message send`

```bash
openclaw directory peers list --channel slack --query "U0"
openclaw message send --channel slack --target user:U012ABCDEF --message "hello"
```

## ID-Formate (nach Kanal)

- WhatsApp: `+15551234567` (DM), `1234567890-1234567890@g.us` (Gruppe)
- Telegram: `@username` oder numerische Chat-ID; Gruppen sind numerische IDs
- Slack: `user:U…` und `channel:C…`
- Discord: `user:<id>` und `channel:<id>`
- Matrix (Plugin): `user:@user:server`, `room:!roomId:server` oder `#alias:server`
- Microsoft Teams (Plugin): `user:<id>` und `conversation:<id>`
- Zalo (Plugin): Benutzer-ID (Bot-API)
- Zalo Personal / `zalouser` (Plugin): Thread-ID (DM/Gruppe) aus `zca` (`me`, `friend list`, `group list`)

## Self („ich“)

```bash
openclaw directory self --channel zalouser
```

## Peers (Kontakte/Benutzer)

```bash
openclaw directory peers list --channel zalouser
openclaw directory peers list --channel zalouser --query "name"
openclaw directory peers list --channel zalouser --limit 50
```

## Gruppen

```bash
openclaw directory groups list --channel zalouser
openclaw directory groups list --channel zalouser --query "work"
openclaw directory groups members --channel zalouser --group-id <id>
```
