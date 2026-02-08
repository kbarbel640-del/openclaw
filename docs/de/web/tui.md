---
summary: "Terminal-UI (TUI): Verbindung zum Gateway von jedem Rechner aus"
read_when:
  - Sie möchten eine einsteigerfreundliche Einführung in die TUI
  - Sie benötigen die vollständige Liste der TUI-Funktionen, -Befehle und -Tastenkürzel
title: "TUI"
x-i18n:
  source_path: web/tui.md
  source_hash: 6ab8174870e4722d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:16:02Z
---

# TUI (Terminal UI)

## Schnellstart

1. Starten Sie das Gateway.

```bash
openclaw gateway
```

2. Öffnen Sie die TUI.

```bash
openclaw tui
```

3. Geben Sie eine Nachricht ein und drücken Sie Enter.

Remote-Gateway:

```bash
openclaw tui --url ws://<host>:<port> --token <gateway-token>
```

Verwenden Sie `--password`, wenn Ihr Gateway Passwortauthentifizierung verwendet.

## Was Sie sehen

- Kopfzeile: Verbindungs-URL, aktueller Agent, aktuelle Sitzung.
- Chatprotokoll: Benutzernachrichten, Assistentenantworten, Systemhinweise, Werkzeugkarten.
- Statuszeile: Verbindungs-/Ausführungsstatus (connecting, running, streaming, idle, error).
- Fußzeile: Verbindungsstatus + Agent + Sitzung + Modell + think/verbose/reasoning + Token-Zähler + Deliver.
- Eingabe: Texteditor mit Autovervollständigung.

## Mentales Modell: Agenten + Sitzungen

- Agenten sind eindeutige Slugs (z. B. `main`, `research`). Das Gateway stellt die Liste bereit.
- Sitzungen gehören zum aktuellen Agenten.
- Sitzungsschlüssel werden als `agent:<agentId>:<sessionKey>` gespeichert.
  - Wenn Sie `/session main` eingeben, erweitert die TUI dies zu `agent:<currentAgent>:main`.
  - Wenn Sie `/session agent:other:main` eingeben, wechseln Sie explizit zu dieser Agenten-Sitzung.
- Sitzungsbereich:
  - `per-sender` (Standard): Jeder Agent hat viele Sitzungen.
  - `global`: Die TUI verwendet immer die Sitzung `global` (der Picker kann leer sein).
- Der aktuelle Agent + die aktuelle Sitzung sind stets in der Fußzeile sichtbar.

## Senden + Zustellung

- Nachrichten werden an das Gateway gesendet; die Zustellung an Anbieter ist standardmäßig deaktiviert.
- Aktivieren Sie die Zustellung:
  - `/deliver on`
  - oder über das Einstellungs-Panel
  - oder starten Sie mit `openclaw tui --deliver`

## Picker + Overlays

- Modell-Picker: Verfügbare Modelle auflisten und Sitzungs-Override setzen.
- Agent-Picker: Anderen Agenten auswählen.
- Sitzungs-Picker: Zeigt nur Sitzungen für den aktuellen Agenten.
- Einstellungen: Zustellung, Erweiterung der Werkzeugausgabe und Sichtbarkeit des Denkens umschalten.

## Tastenkürzel

- Enter: Nachricht senden
- Esc: Aktive Ausführung abbrechen
- Ctrl+C: Eingabe löschen (zweimal drücken zum Beenden)
- Ctrl+D: Beenden
- Ctrl+L: Modell-Picker
- Ctrl+G: Agent-Picker
- Ctrl+P: Sitzungs-Picker
- Ctrl+O: Erweiterung der Werkzeugausgabe umschalten
- Ctrl+T: Sichtbarkeit des Denkens umschalten (lädt den Verlauf neu)

## Slash-Befehle

Kern:

- `/help`
- `/status`
- `/agent <id>` (oder `/agents`)
- `/session <key>` (oder `/sessions`)
- `/model <provider/model>` (oder `/models`)

Sitzungssteuerung:

- `/think <off|minimal|low|medium|high>`
- `/verbose <on|full|off>`
- `/reasoning <on|off|stream>`
- `/usage <off|tokens|full>`
- `/elevated <on|off|ask|full>` (Alias: `/elev`)
- `/activation <mention|always>`
- `/deliver <on|off>`

Sitzungslebenszyklus:

- `/new` oder `/reset` (setzt die Sitzung zurück)
- `/abort` (bricht die aktive Ausführung ab)
- `/settings`
- `/exit`

Andere Gateway-Slash-Befehle (zum Beispiel `/context`) werden an das Gateway weitergeleitet und als Systemausgabe angezeigt. Siehe [Slash commands](/tools/slash-commands).

## Lokale Shell-Befehle

- Stellen Sie einer Zeile `!` voran, um einen lokalen Shell-Befehl auf dem TUI-Host auszuführen.
- Die TUI fragt pro Sitzung einmal nach der Erlaubnis zur lokalen Ausführung; bei Ablehnung bleibt `!` für die Sitzung deaktiviert.
- Befehle laufen in einer frischen, nicht-interaktiven Shell im TUI-Arbeitsverzeichnis (keine persistente `cd`/env).
- Ein einzelnes `!` wird als normale Nachricht gesendet; führende Leerzeichen lösen keine lokale Ausführung aus.

## Werkzeugausgabe

- Werkzeugaufrufe werden als Karten mit Argumenten + Ergebnissen angezeigt.
- Ctrl+O schaltet zwischen reduzierter und erweiterter Ansicht um.
- Während Werkzeuge laufen, werden Teil-Updates in dieselbe Karte gestreamt.

## Verlauf + Streaming

- Beim Verbinden lädt die TUI den neuesten Verlauf (standardmäßig 200 Nachrichten).
- Streaming-Antworten aktualisieren sich an Ort und Stelle, bis sie finalisiert sind.
- Die TUI hört außerdem auf Agenten-Werkzeugereignisse für umfangreichere Werkzeugkarten.

## Verbindungsdetails

- Die TUI registriert sich beim Gateway als `mode: "tui"`.
- Wiederverbindungen zeigen eine Systemmeldung; Ereignislücken werden im Protokoll angezeigt.

## Optionen

- `--url <url>`: Gateway-WebSocket-URL (Standard: aus der Konfiguration oder `ws://127.0.0.1:<port>`)
- `--token <token>`: Gateway-Token (falls erforderlich)
- `--password <password>`: Gateway-Passwort (falls erforderlich)
- `--session <key>`: Sitzungsschlüssel (Standard: `main` oder `global` bei globalem Bereich)
- `--deliver`: Assistentenantworten an den Anbieter zustellen (standardmäßig aus)
- `--thinking <level>`: Denkstufe für Sendungen überschreiben
- `--timeout-ms <ms>`: Agenten-Timeout in ms (Standard: `agents.defaults.timeoutSeconds`)

Hinweis: Wenn Sie `--url` setzen, greift die TUI nicht auf Konfigurations- oder Umgebungsanmeldeinformationen zurück.
Übergeben Sie `--token` oder `--password` explizit. Fehlende explizite Anmeldedaten sind ein Fehler.

## Fehlerbehebung

Keine Ausgabe nach dem Senden einer Nachricht:

- Führen Sie `/status` in der TUI aus, um zu bestätigen, dass das Gateway verbunden und idle/busy ist.
- Prüfen Sie die Gateway-Logs: `openclaw logs --follow`.
- Bestätigen Sie, dass der Agent laufen kann: `openclaw status` und `openclaw models status`.
- Wenn Sie Nachrichten in einem Chat-Kanal erwarten, aktivieren Sie die Zustellung (`/deliver on` oder `--deliver`).
- `--history-limit <n>`: Anzahl der zu ladenden Verlaufseinträge (Standard: 200)

## Fehlerbehebung bei Verbindungen

- `disconnected`: Stellen Sie sicher, dass das Gateway läuft und Ihre `--url/--token/--password` korrekt sind.
- Keine Agenten im Picker: Prüfen Sie `openclaw agents list` und Ihre Routing-Konfiguration.
- Leerer Sitzungs-Picker: Möglicherweise befinden Sie sich im globalen Bereich oder haben noch keine Sitzungen.
