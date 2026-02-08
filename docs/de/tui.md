---
summary: "Terminal-UI (TUI): Verbindung zum Gateway von jedem Rechner aus"
read_when:
  - Sie moechten eine einsteigerfreundliche Einfuehrung in die TUI
  - Sie benoetigen die vollstaendige Liste der TUI-Funktionen, -Befehle und -Tastenkombinationen
title: "TUI"
x-i18n:
  source_path: tui.md
  source_hash: 1eb111456fe0aab6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:00Z
---

# TUI (Terminal UI)

## Schnellstart

1. Starten Sie das Gateway.

```bash
openclaw gateway
```

2. Oeffnen Sie die TUI.

```bash
openclaw tui
```

3. Geben Sie eine Nachricht ein und druecken Sie Enter.

Remote-Gateway:

```bash
openclaw tui --url ws://<host>:<port> --token <gateway-token>
```

Verwenden Sie `--password`, wenn Ihr Gateway Passwort-Authentifizierung nutzt.

## Was Sie sehen

- Kopfzeile: Verbindungs-URL, aktueller Agent, aktuelle Sitzung.
- Chatprotokoll: Benutzernachrichten, Assistentenantworten, Systemhinweise, Werkzeugkarten.
- Statuszeile: Verbindungs-/Ausfuehrungsstatus (connecting, running, streaming, idle, error).
- Fusszeile: Verbindungsstatus + Agent + Sitzung + Modell + Think/Verbose/Reasoning + Tokenzaehler + Deliver.
- Eingabe: Texteditor mit Autovervollstaendigung.

## Mentales Modell: Agenten + Sitzungen

- Agenten sind eindeutige Slugs (z. B. `main`, `research`). Das Gateway stellt die Liste bereit.
- Sitzungen gehoeren zum aktuellen Agenten.
- Sitzungsschluessel werden als `agent:<agentId>:<sessionKey>` gespeichert.
  - Wenn Sie `/session main` eingeben, erweitert die TUI dies zu `agent:<currentAgent>:main`.
  - Wenn Sie `/session agent:other:main` eingeben, wechseln Sie explizit zu dieser Agenten-Sitzung.
- Sitzungsscope:
  - `per-sender` (Standard): Jeder Agent hat viele Sitzungen.
  - `global`: Die TUI verwendet immer die Sitzung `global` (der Picker kann leer sein).
- Der aktuelle Agent + die aktuelle Sitzung sind immer in der Fusszeile sichtbar.

## Senden + Auslieferung

- Nachrichten werden an das Gateway gesendet; die Auslieferung an Anbieter ist standardmaessig deaktiviert.
- Auslieferung aktivieren:
  - `/deliver on`
  - oder ueber das Einstellungs-Panel
  - oder Start mit `openclaw tui --deliver`

## Picker + Overlays

- Modell-Picker: Verfuegbare Modelle auflisten und Sitzungs-Override setzen.
- Agenten-Picker: Einen anderen Agenten waehlen.
- Sitzungs-Picker: Zeigt nur Sitzungen fuer den aktuellen Agenten.
- Einstellungen: Deliver, Anzeige von Werkzeugausgaben und Sichtbarkeit des Denkens umschalten.

## Tastenkombinationen

- Enter: Nachricht senden
- Esc: Aktiven Lauf abbrechen
- Ctrl+C: Eingabe leeren (zweimal druecken zum Beenden)
- Ctrl+D: Beenden
- Ctrl+L: Modell-Picker
- Ctrl+G: Agenten-Picker
- Ctrl+P: Sitzungs-Picker
- Ctrl+O: Anzeige der Werkzeugausgaben umschalten
- Ctrl+T: Sichtbarkeit des Denkens umschalten (laedt Verlauf neu)

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

- `/new` oder `/reset` (setzt die Sitzung zurueck)
- `/abort` (bricht den aktiven Lauf ab)
- `/settings`
- `/exit`

Weitere Gateway-Slash-Befehle (z. B. `/context`) werden an das Gateway weitergeleitet und als Systemausgabe angezeigt. Siehe [Slash commands](/tools/slash-commands).

## Lokale Shell-Befehle

- Stellen Sie einer Zeile `!` voran, um einen lokalen Shell-Befehl auf dem TUI-Host auszufuehren.
- Die TUI fragt einmal pro Sitzung nach, ob lokale Ausfuehrung erlaubt ist; bei Ablehnung bleibt `!` fuer die Sitzung deaktiviert.
- Befehle laufen in einer frischen, nicht-interaktiven Shell im TUI-Arbeitsverzeichnis (keine persistenten `cd`/env).
- Ein einzelnes `!` wird als normale Nachricht gesendet; fuehrende Leerzeichen loesen keine lokale Ausfuehrung aus.

## Werkzeugausgabe

- Werkzeugaufrufe erscheinen als Karten mit Argumenten + Ergebnissen.
- Ctrl+O schaltet zwischen eingeklappter/ausgeklappter Ansicht um.
- Waehren Werkzeuge laufen, werden partielle Updates in dieselbe Karte gestreamt.

## Verlauf + Streaming

- Beim Verbinden laedt die TUI den neuesten Verlauf (Standard: 200 Nachrichten).
- Streaming-Antworten werden bis zum Abschluss direkt aktualisiert.
- Die TUI hoert ausserdem auf Agenten-Werkzeugereignisse fuer reichhaltigere Werkzeugkarten.

## Verbindungsdetails

- Die TUI registriert sich beim Gateway als `mode: "tui"`.
- Wiederverbindungen zeigen eine Systemnachricht; Ereignisluecken werden im Protokoll angezeigt.

## Optionen

- `--url <url>`: Gateway-WebSocket-URL (Standard: Konfiguration oder `ws://127.0.0.1:<port>`)
- `--token <token>`: Gateway-Token (falls erforderlich)
- `--password <password>`: Gateway-Passwort (falls erforderlich)
- `--session <key>`: Sitzungsschluessel (Standard: `main` oder `global` bei globalem Scope)
- `--deliver`: Assistentenantworten an den Anbieter ausliefern (Standard: aus)
- `--thinking <level>`: Thinking-Level fuer Sends ueberschreiben
- `--timeout-ms <ms>`: Agenten-Timeout in ms (Standard: `agents.defaults.timeoutSeconds`)

Hinweis: Wenn Sie `--url` setzen, faellt die TUI nicht auf Konfigurations- oder Umgebungsanmeldeinformationen zurueck.
Uebergeben Sie `--token` oder `--password` explizit. Fehlende explizite Anmeldeinformationen sind ein Fehler.

## Fehlerbehebung

Keine Ausgabe nach dem Senden einer Nachricht:

- Fuehren Sie `/status` in der TUI aus, um zu bestaetigen, dass das Gateway verbunden und idle/busy ist.
- Pruefen Sie die Gateway-Logs: `openclaw logs --follow`.
- Bestaetigen Sie, dass der Agent ausfuehren kann: `openclaw status` und `openclaw models status`.
- Wenn Sie Nachrichten in einem Chat-Kanal erwarten, aktivieren Sie die Auslieferung (`/deliver on` oder `--deliver`).
- `--history-limit <n>`: Anzahl der zu ladenden Verlaufseintraege (Standard: 200)

## Fehlerbehebung

- `disconnected`: Stellen Sie sicher, dass das Gateway laeuft und Ihre `--url/--token/--password` korrekt sind.
- Keine Agenten im Picker: Pruefen Sie `openclaw agents list` und Ihre Routing-Konfiguration.
- Leerer Sitzungs-Picker: Moeglicherweise befinden Sie sich im globalen Scope oder haben noch keine Sitzungen.
