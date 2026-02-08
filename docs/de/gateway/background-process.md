---
summary: "Ausführung im Hintergrund und Prozessverwaltung"
read_when:
  - Hinzufügen oder Ändern des Verhaltens von Hintergrundausführungen
  - Debugging von lang laufenden exec-Aufgaben
title: "Background Exec- und Process-Werkzeug"
x-i18n:
  source_path: gateway/background-process.md
  source_hash: e11a7d74a75000d6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:18Z
---

# Background Exec + Process Tool

OpenClaw führt Shell-Befehle über das Werkzeug `exec` aus und hält lang laufende Aufgaben im Speicher. Das Werkzeug `process` verwaltet diese Hintergrundsitzungen.

## exec tool

Zentrale Parameter:

- `command` (erforderlich)
- `yieldMs` (Standard 10000): automatisches Verschieben in den Hintergrund nach dieser Verzögerung
- `background` (bool): sofort im Hintergrund starten
- `timeout` (Sekunden, Standard 1800): Prozess nach diesem Timeout beenden
- `elevated` (bool): auf dem Host ausführen, wenn der erhöhte Modus aktiviert/erlaubt ist
- Benötigen Sie ein echtes TTY? Setzen Sie `pty: true`.
- `workdir`, `env`

Verhalten:

- Vordergrundausführungen geben die Ausgabe direkt zurück.
- Bei Ausführung im Hintergrund (explizit oder durch Timeout) gibt das Werkzeug `status: "running"` + `sessionId` sowie ein kurzes Ende der Ausgabe zurück.
- Die Ausgabe wird im Speicher gehalten, bis die Sitzung abgefragt oder gelöscht wird.
- Wenn das Werkzeug `process` nicht erlaubt ist, läuft `exec` synchron und ignoriert `yieldMs`/`background`.

## Child-Process-Bridging

Wenn lang laufende Child-Prozesse außerhalb der exec-/process-Werkzeuge gestartet werden (z. B. bei CLI-Neustarts oder Gateway-Hilfsprozessen), binden Sie den Child-Process-Bridge-Helfer ein, damit Terminierungssignale weitergeleitet und Listener beim Exit/Fehler sauber getrennt werden. Dies verhindert verwaiste Prozesse unter systemd und sorgt für konsistentes Shutdown-Verhalten über alle Plattformen hinweg.

Umgebungsüberschreibungen:

- `PI_BASH_YIELD_MS`: Standard-Yield (ms)
- `PI_BASH_MAX_OUTPUT_CHARS`: In-Memory-Ausgabeobergrenze (Zeichen)
- `OPENCLAW_BASH_PENDING_MAX_OUTPUT_CHARS`: Obergrenze für ausstehendes stdout/stderr pro Stream (Zeichen)
- `PI_BASH_JOB_TTL_MS`: TTL für abgeschlossene Sitzungen (ms, begrenzt auf 1 min–3 h)

Konfiguration (bevorzugt):

- `tools.exec.backgroundMs` (Standard 10000)
- `tools.exec.timeoutSec` (Standard 1800)
- `tools.exec.cleanupMs` (Standard 1800000)
- `tools.exec.notifyOnExit` (Standard true): ein Systemereignis einreihen + Heartbeat anfordern, wenn eine im Hintergrund ausgeführte exec endet.

## process tool

Aktionen:

- `list`: laufende + abgeschlossene Sitzungen
- `poll`: neue Ausgabe für eine Sitzung abholen (meldet auch den Exit-Status)
- `log`: aggregierte Ausgabe lesen (unterstützt `offset` + `limit`)
- `write`: stdin senden (`data`, optional `eof`)
- `kill`: eine Hintergrundsitzung terminieren
- `clear`: eine abgeschlossene Sitzung aus dem Speicher entfernen
- `remove`: bei laufender Sitzung beenden, andernfalls bei abgeschlossener Sitzung löschen

Hinweise:

- Nur im Hintergrund gestartete Sitzungen werden aufgelistet und im Speicher gehalten.
- Sitzungen gehen bei einem Prozessneustart verloren (keine Persistenz auf Datenträger).
- Sitzungslogs werden nur im Chatverlauf gespeichert, wenn Sie `process poll/log` ausführen und das Werkzeugergebnis aufgezeichnet wird.
- `process` ist pro Agent begrenzt; es sieht nur Sitzungen, die von diesem Agenten gestartet wurden.
- `process list` enthält ein abgeleitetes `name` (Befehlsverb + Ziel) für schnelle Übersichten.
- `process log` verwendet zeilenbasiertes `offset`/`limit` (lassen Sie `offset` weg, um die letzten N Zeilen zu erhalten).

## Beispiele

Eine lange Aufgabe ausführen und später abfragen:

```json
{ "tool": "exec", "command": "sleep 5 && echo done", "yieldMs": 1000 }
```

```json
{ "tool": "process", "action": "poll", "sessionId": "<id>" }
```

Sofort im Hintergrund starten:

```json
{ "tool": "exec", "command": "npm run build", "background": true }
```

stdin senden:

```json
{ "tool": "process", "action": "write", "sessionId": "<id>", "data": "y\n" }
```
