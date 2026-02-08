---
summary: "Direktivsyntax fuer /think + /verbose und wie sie das Modell-Denken beeinflussen"
read_when:
  - Anpassen der Verarbeitung oder Standardwerte von Think- oder Verbose-Direktiven
title: "Denkstufen"
x-i18n:
  source_path: tools/thinking.md
  source_hash: 0ae614147675be32
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:00Z
---

# Denkstufen (/think-Direktiven)

## Zweck

- Inline-Direktive in jedem eingehenden Text: `/t <level>`, `/think:<level>` oder `/thinking <level>`.
- Stufen (Aliase): `off | minimal | low | medium | high | xhigh` (nur GPT-5.2- und Codex-Modelle)
  - minimal → „think“
  - low → „think hard“
  - medium → „think harder“
  - high → „ultrathink“ (maximales Budget)
  - xhigh → „ultrathink+“ (nur GPT-5.2- und Codex-Modelle)
  - `x-high`, `x_high`, `extra-high`, `extra high` und `extra_high` werden auf `xhigh` abgebildet.
  - `highest`, `max` werden auf `high` abgebildet.
- Anbieterhinweise:
  - Z.AI (`zai/*`) unterstuetzt nur binaeres Denken (`on`/`off`). Jede Nicht-`off`-Stufe wird als `on` behandelt (abgebildet auf `low`).

## Aufloesungsreihenfolge

1. Inline-Direktive in der Nachricht (gilt nur fuer diese Nachricht).
2. Sitzungs-Ueberschreibung (gesetzt durch Senden einer reinen Direktiven-Nachricht).
3. Globaler Standard (`agents.defaults.thinkingDefault` in der Konfiguration).
4. Fallback: low fuer reasoning-faehige Modelle; sonst off.

## Festlegen eines Sitzungsstandards

- Senden Sie eine Nachricht, die **nur** aus der Direktive besteht (Leerzeichen erlaubt), z. B. `/think:medium` oder `/t high`.
- Diese Einstellung gilt fuer die aktuelle Sitzung (standardmaessig pro Absender); sie wird durch `/think:off` oder durch einen Sitzungs-Idle-Reset geloescht.
- Eine Bestaetigungsantwort wird gesendet (`Thinking level set to high.` / `Thinking disabled.`). Ist die Stufe ungueltig (z. B. `/thinking big`), wird der Befehl mit einem Hinweis abgelehnt und der Sitzungsstatus bleibt unveraendert.
- Senden Sie `/think` (oder `/think:`) ohne Argument, um die aktuelle Denkstufe anzuzeigen.

## Anwendung durch den Agenten

- **Embedded Pi**: Die aufgeloeste Stufe wird an die In-Process-Pi-Agent-Runtime uebergeben.

## Verbose-Direktiven (/verbose oder /v)

- Stufen: `on` (minimal) | `full` | `off` (Standard).
- Eine reine Direktiven-Nachricht schaltet den Sitzungs-Verbose-Modus um und antwortet mit `Verbose logging enabled.` / `Verbose logging disabled.`; ungueltige Stufen liefern einen Hinweis, ohne den Status zu aendern.
- `/verbose off` speichert eine explizite Sitzungs-Ueberschreibung; loeschen Sie diese ueber die Sitzungs-UI, indem Sie `inherit` waehlen.
- Eine Inline-Direktive betrifft nur diese Nachricht; andernfalls gelten Sitzungs-/globale Standards.
- Senden Sie `/verbose` (oder `/verbose:`) ohne Argument, um die aktuelle Verbose-Stufe anzuzeigen.
- Wenn Verbose aktiviert ist, senden Agenten mit strukturierten Werkzeugergebnissen (Pi, andere JSON-Agenten) jeden Tool-Aufruf als eigene reine Metadaten-Nachricht, sofern verfuegbar mit `<emoji> <tool-name>: <arg>` (Pfad/Befehl) praefixiert. Diese Tool-Zusammenfassungen werden gesendet, sobald jedes Tool startet (separate Bubbles), nicht als Streaming-Deltas.
- Wenn Verbose auf `full` steht, werden Tool-Ausgaben nach Abschluss ebenfalls weitergeleitet (separate Bubble, auf eine sichere Laenge gekuerzt). Wenn Sie waehrend eines laufenden Durchlaufs auf `/verbose on|full|off` umschalten, beruecksichtigen nachfolgende Tool-Bubbles die neue Einstellung.

## Sichtbarkeit des Denkens (/reasoning)

- Stufen: `on|off|stream`.
- Eine reine Direktiven-Nachricht schaltet um, ob Denkblöcke in Antworten angezeigt werden.
- Wenn aktiviert, wird das Reasoning als **separate Nachricht** gesendet, praefixiert mit `Reasoning:`.
- `stream` (nur Telegram): Streamt das Reasoning waehrend der Antwortgenerierung in die Telegram-Entwurfsblase und sendet anschliessend die finale Antwort ohne Reasoning.
- Alias: `/reason`.
- Senden Sie `/reasoning` (oder `/reasoning:`) ohne Argument, um die aktuelle Reasoning-Stufe anzuzeigen.

## Verwandtes

- Dokumentation zum Elevated Mode finden Sie unter [Elevated mode](/tools/elevated).

## Heartbeats

- Der Heartbeat-Probe-Body ist der konfigurierte Heartbeat-Prompt (Standard: `Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`). Inline-Direktiven in einer Heartbeat-Nachricht gelten wie gewohnt (vermeiden Sie jedoch, Sitzungsstandards durch Heartbeats zu aendern).
- Die Heartbeat-Zustellung erfolgt standardmaessig nur mit der finalen Payload. Um zusaetzlich die separate `Reasoning:`-Nachricht (falls verfuegbar) zu senden, setzen Sie `agents.defaults.heartbeat.includeReasoning: true` oder pro Agent `agents.list[].heartbeat.includeReasoning: true`.

## Web-Chat-UI

- Der Denkstufen-Selektor im Web-Chat spiegelt beim Laden der Seite die in der eingehenden Sitzungsablage/Konfiguration gespeicherte Stufe wider.
- Die Auswahl einer anderen Stufe gilt nur fuer die naechste Nachricht (`thinkingOnce`); nach dem Senden springt der Selektor zurueck auf die gespeicherte Sitzungsstufe.
- Um den Sitzungsstandard zu aendern, senden Sie eine `/think:<level>`-Direktive (wie zuvor); der Selektor spiegelt dies nach dem naechsten Neuladen wider.
