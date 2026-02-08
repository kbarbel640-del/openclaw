---
summary: „SOUL Evil Hook (SOUL.md gegen SOUL_EVIL.md austauschen)“
read_when:
  - Sie möchten den SOUL Evil Hook aktivieren oder feinjustieren
  - Sie möchten ein Purge-Fenster oder einen zufallsbasierten Persona-Wechsel
title: „SOUL Evil Hook“
x-i18n:
  source_path: hooks/soul-evil.md
  source_hash: cc32c1e207f2b692
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:36Z
---

# SOUL Evil Hook

Der SOUL Evil Hook tauscht den **injizierten** `SOUL.md`-Inhalt während
eines Purge-Fensters oder per Zufall gegen `SOUL_EVIL.md` aus. Er verändert **keine**
Dateien auf dem Datenträger.

## Funktionsweise

Wenn `agent:bootstrap` ausgeführt wird, kann der Hook den `SOUL.md`-Inhalt im Speicher ersetzen,
bevor der System-Prompt zusammengesetzt wird. Fehlt `SOUL_EVIL.md` oder ist er leer,
protokolliert OpenClaw eine Warnung und behält den normalen `SOUL.md` bei.

Ausführungen von Sub-Agenten enthalten `SOUL.md` **nicht** in ihren Bootstrap-Dateien,
daher hat dieser Hook keine Wirkung auf Sub-Agenten.

## Aktivieren

```bash
openclaw hooks enable soul-evil
```

Setzen Sie dann die Konfiguration:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "soul-evil": {
          "enabled": true,
          "file": "SOUL_EVIL.md",
          "chance": 0.1,
          "purge": { "at": "21:00", "duration": "15m" }
        }
      }
    }
  }
}
```

Erstellen Sie `SOUL_EVIL.md` im Arbeitsbereichs-Stamm des Agenten (neben `SOUL.md`).

## Optionen

- `file` (String): alternativer SOUL-Dateiname (Standard: `SOUL_EVIL.md`)
- `chance` (Zahl 0–1): zufällige Wahrscheinlichkeit pro Lauf, `SOUL_EVIL.md` zu verwenden
- `purge.at` (HH:mm): täglicher Purge-Start (24-Stunden-Format)
- `purge.duration` (Dauer): Fensterlänge (z. B. `30s`, `10m`, `1h`)

**Priorität:** Das Purge-Fenster hat Vorrang vor der Zufallschance.

**Zeitzone:** Verwendet `agents.defaults.userTimezone`, wenn gesetzt; andernfalls die Zeitzone des Hosts.

## Hinweise

- Es werden keine Dateien auf dem Datenträger geschrieben oder verändert.
- Wenn `SOUL.md` nicht in der Bootstrap-Liste enthalten ist, tut der Hook nichts.

## Siehe auch

- [Hooks](/hooks)
