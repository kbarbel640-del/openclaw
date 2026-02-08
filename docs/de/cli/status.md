---
summary: "CLI-Referenz für `openclaw status` (Diagnose, Probes, Nutzungs-Snapshots)"
read_when:
  - Sie möchten eine schnelle Diagnose des Kanalzustands + der jüngsten Sitzungsempfänger
  - Sie möchten einen einfügbaren „all“-Status für die Fehlersuche
title: "Status"
x-i18n:
  source_path: cli/status.md
  source_hash: 2bbf5579c48034fc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:52Z
---

# `openclaw status`

Diagnosen für Kanäle + Sitzungen.

```bash
openclaw status
openclaw status --all
openclaw status --deep
openclaw status --usage
```

Hinweise:

- `--deep` führt Live-Prüfungen aus (WhatsApp Web + Telegram + Discord + Google Chat + Slack + Signal).
- Die Ausgabe enthält Sitzungsspeicher pro Agent, wenn mehrere Agenten konfiguriert sind.
- Die Übersicht enthält den Installations- und Laufzeitstatus von Gateway- und Node-Host-Dienst, sofern verfügbar.
- Die Übersicht enthält Update-Kanal + Git-SHA (für Quellcode-Checkouts).
- Update-Informationen erscheinen in der Übersicht; ist ein Update verfügbar, gibt der Status einen Hinweis aus, `openclaw update` auszuführen (siehe [Updating](/install/updating)).
