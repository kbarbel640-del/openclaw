---
summary: "CLI-Referenz für `openclaw cron` (Planen und Ausführen von Hintergrundjobs)"
read_when:
  - Sie möchten geplante Jobs und Wake-ups
  - Sie debuggen die Ausführung von Cron und Protokolle
title: "cron"
x-i18n:
  source_path: cli/cron.md
  source_hash: cef64f2ac4a648d4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:37Z
---

# `openclaw cron`

Verwalten Sie Cron-Jobs für den Gateway-Scheduler.

Verwandt:

- Cron-Jobs: [Cron jobs](/automation/cron-jobs)

Tipp: Führen Sie `openclaw cron --help` aus, um die vollständige Befehlsoberfläche zu sehen.

Hinweis: Isolierte `cron add`-Jobs verwenden standardmäßig die Zustellung `--announce`. Verwenden Sie `--no-deliver`, um
die Ausgabe intern zu halten. `--deliver` bleibt als veralteter Alias für `--announce` erhalten.

Hinweis: Einmalige (`--at`) Jobs werden standardmäßig nach erfolgreichem Abschluss gelöscht. Verwenden Sie `--keep-after-run`, um sie zu behalten.

## Häufige Änderungen

Aktualisieren Sie Zustellungseinstellungen, ohne die Nachricht zu ändern:

```bash
openclaw cron edit <job-id> --announce --channel telegram --to "123456789"
```

Deaktivieren Sie die Zustellung für einen isolierten Job:

```bash
openclaw cron edit <job-id> --no-deliver
```

Ankündigung in einem bestimmten Kanal:

```bash
openclaw cron edit <job-id> --announce --channel slack --to "channel:C1234567890"
```
