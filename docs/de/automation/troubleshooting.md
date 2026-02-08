---
summary: "Fehlerbehebung bei Cron- und Heartbeat-Planung sowie Zustellung"
read_when:
  - Cron wurde nicht ausgeführt
  - Cron wurde ausgeführt, aber es wurde keine Nachricht zugestellt
  - Heartbeat wirkt stumm oder übersprungen
title: "Fehlerbehebung für Automatisierung"
x-i18n:
  source_path: automation/troubleshooting.md
  source_hash: 10eca4a59119910f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:45Z
---

# Fehlerbehebung für Automatisierung

Verwenden Sie diese Seite bei Problemen mit Planung und Zustellung (`cron` + `heartbeat`).

## Befehlsleiter

```bash
openclaw status
openclaw gateway status
openclaw logs --follow
openclaw doctor
openclaw channels status --probe
```

Führen Sie anschließend Automatisierungsprüfungen aus:

```bash
openclaw cron status
openclaw cron list
openclaw system heartbeat last
```

## Cron wird nicht ausgelöst

```bash
openclaw cron status
openclaw cron list
openclaw cron runs --id <jobId> --limit 20
openclaw logs --follow
```

Gute Ausgabe sieht so aus:

- `cron status` meldet „aktiviert“ und ein zukünftiges `nextWakeAtMs`.
- Job ist aktiviert und hat einen gültigen Zeitplan/Zeitzone.
- `cron runs` zeigt `ok` oder einen expliziten Grund für das Überspringen.

Häufige Signaturen:

- `cron: scheduler disabled; jobs will not run automatically` → Cron in Konfiguration/Umgebungsvariablen deaktiviert.
- `cron: timer tick failed` → Scheduler-Tick abgestürzt; untersuchen Sie den umgebenden Stack-/Log-Kontext.
- `reason: not-due` in der Ausführungsausgabe → manuelle Ausführung ohne `--force` aufgerufen und Job noch nicht fällig.

## Cron ausgelöst, aber keine Zustellung

```bash
openclaw cron runs --id <jobId> --limit 20
openclaw cron list
openclaw channels status --probe
openclaw logs --follow
```

Gute Ausgabe sieht so aus:

- Ausführungsstatus ist `ok`.
- Zustellmodus/-ziel sind für isolierte Jobs gesetzt.
- Kanalprüfung meldet Zielkanal als verbunden.

Häufige Signaturen:

- Ausführung erfolgreich, aber Zustellmodus ist `none` → es wird keine externe Nachricht erwartet.
- Zustellziel fehlt/ist ungültig (`channel`/`to`) → Ausführung kann intern erfolgreich sein, überspringt aber den Versand nach außen.
- Kanal-Auth-Fehler (`unauthorized`, `missing_scope`, `Forbidden`) → Zustellung durch Kanal-Anmeldedaten/Berechtigungen blockiert.

## Heartbeat unterdrückt oder übersprungen

```bash
openclaw system heartbeat last
openclaw logs --follow
openclaw config get agents.defaults.heartbeat
openclaw channels status --probe
```

Gute Ausgabe sieht so aus:

- Heartbeat aktiviert mit einem Intervall größer als null.
- Letztes Heartbeat-Ergebnis ist `ran` (oder der Grund für das Überspringen ist bekannt).

Häufige Signaturen:

- `heartbeat skipped` mit `reason=quiet-hours` → außerhalb von `activeHours`.
- `requests-in-flight` → Hauptspur ausgelastet; Heartbeat verzögert.
- `empty-heartbeat-file` → `HEARTBEAT.md` existiert, hat aber keinen verwertbaren Inhalt.
- `alerts-disabled` → Sichtbarkeitseinstellungen unterdrücken ausgehende Heartbeat-Nachrichten.

## Zeitzone und activeHours – Stolperfallen

```bash
openclaw config get agents.defaults.heartbeat.activeHours
openclaw config get agents.defaults.heartbeat.activeHours.timezone
openclaw config get agents.defaults.userTimezone || echo "agents.defaults.userTimezone not set"
openclaw cron list
openclaw logs --follow
```

Kurzregeln:

- `Config path not found: agents.defaults.userTimezone` bedeutet, dass der Schlüssel nicht gesetzt ist; der Heartbeat fällt auf die Host-Zeitzone zurück (oder `activeHours.timezone`, falls gesetzt).
- Cron ohne `--tz` verwendet die Zeitzone des Gateway-Hosts.
- Heartbeat `activeHours` verwendet die konfigurierte Zeitzonenauflösung (`user`, `local` oder explizite IANA-Zeitzone).
- ISO-Zeitstempel ohne Zeitzone werden für Cron-`at`-Zeitpläne als UTC behandelt.

Häufige Signaturen:

- Jobs laufen nach Änderungen der Host-Zeitzone zur falschen Uhrzeit.
- Heartbeat wird tagsüber immer übersprungen, weil `activeHours.timezone` falsch ist.

Verwandt:

- [/automation/cron-jobs](/automation/cron-jobs)
- [/gateway/heartbeat](/gateway/heartbeat)
- [/automation/cron-vs-heartbeat](/automation/cron-vs-heartbeat)
- [/concepts/timezone](/concepts/timezone)
