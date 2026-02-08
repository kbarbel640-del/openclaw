---
summary: „CLI-Referenz für `openclaw system` (Systemereignisse, Heartbeat, Präsenz)“
read_when:
  - Sie möchten ein Systemereignis einreihen, ohne einen Cron-Job zu erstellen
  - Sie müssen Heartbeats aktivieren oder deaktivieren
  - Sie möchten System-Präsenzeinträge prüfen
title: „System“
x-i18n:
  source_path: cli/system.md
  source_hash: 36ae5dbdec327f5a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:49Z
---

# `openclaw system`

Systemweite Hilfsfunktionen für den Gateway: Systemereignisse einreihen, Heartbeats steuern
und Präsenz anzeigen.

## Common commands

```bash
openclaw system event --text "Check for urgent follow-ups" --mode now
openclaw system heartbeat enable
openclaw system heartbeat last
openclaw system presence
```

## `system event`

Reiht ein Systemereignis in der **Haupt**-Sitzung ein. Der nächste Heartbeat injiziert es
als eine `System:`-Zeile in den Prompt. Verwenden Sie `--mode now`, um den Heartbeat
sofort auszulösen; `next-heartbeat` wartet auf den nächsten geplanten Tick.

Flags:

- `--text <text>`: erforderlicher Text für das Systemereignis.
- `--mode <mode>`: `now` oder `next-heartbeat` (Standard).
- `--json`: maschinenlesbare Ausgabe.

## `system heartbeat last|enable|disable`

Heartbeat-Steuerung:

- `last`: zeigt das letzte Heartbeat-Ereignis an.
- `enable`: schaltet Heartbeats wieder ein (verwenden Sie dies, wenn sie deaktiviert waren).
- `disable`: pausiert Heartbeats.

Flags:

- `--json`: maschinenlesbare Ausgabe.

## `system presence`

Listet die aktuellen System-Präsenzeinträge auf, die dem Gateway bekannt sind (Knoten,
Instanzen und ähnliche Statuszeilen).

Flags:

- `--json`: maschinenlesbare Ausgabe.

## Hinweise

- Erfordert einen laufenden Gateway, der über Ihre aktuelle Konfiguration erreichbar ist (lokal oder remote).
- Systemereignisse sind flüchtig und werden nicht über Neustarts hinweg persistiert.
