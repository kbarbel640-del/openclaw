---
summary: "Direkte Ausfuehrungen des `openclaw agent`-CLI (mit optionaler Zustellung)"
read_when:
  - Hinzufuegen oder Aendern des Agent-CLI-Einstiegspunkts
title: "Agent senden"
x-i18n:
  source_path: tools/agent-send.md
  source_hash: a84d6a304333eebe
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:41Z
---

# `openclaw agent` (direkte Agent-Ausfuehrungen)

`openclaw agent` fuehrt einen einzelnen Agenten-Zug aus, ohne dass eine eingehende Chat-Nachricht erforderlich ist.
Standardmaessig laeuft dies **ueber das Gateway**; fuegen Sie `--local` hinzu, um die eingebettete
Laufzeit auf der aktuellen Maschine zu erzwingen.

## Verhalten

- Erforderlich: `--message <text>`
- Sitzungswahl:
  - `--to <dest>` leitet den Sitzungsschluessel ab (Gruppen-/Kanalziele bewahren die Isolation; Direktchats werden zu `main` zusammengefuehrt), **oder**
  - `--session-id <id>` verwendet eine bestehende Sitzung per ID wieder, **oder**
  - `--agent <id>` zielt direkt auf einen konfigurierten Agenten (verwendet den `main`-Sitzungsschluessel dieses Agenten)
- Fuehrt dieselbe eingebettete Agenten-Laufzeit aus wie normale eingehende Antworten.
- Thinking-/Verbose-Flags werden im Sitzungsspeicher beibehalten.
- Ausgabe:
  - Standard: gibt den Antworttext aus (zuzueglich `MEDIA:<url>`-Zeilen)
  - `--json`: gibt eine strukturierte Nutzlast + Metadaten aus
- Optionale Zustellung zurueck an einen Kanal mit `--deliver` + `--channel` (Zielformate entsprechen `openclaw message --target`).
- Verwenden Sie `--reply-channel`/`--reply-to`/`--reply-account`, um die Zustellung zu ueberschreiben, ohne die Sitzung zu aendern.

Wenn das Gateway nicht erreichbar ist, **faellt** das CLI auf die eingebettete lokale Ausfuehrung zurueck.

## Beispiele

```bash
openclaw agent --to +15555550123 --message "status update"
openclaw agent --agent ops --message "Summarize logs"
openclaw agent --session-id 1234 --message "Summarize inbox" --thinking medium
openclaw agent --to +15555550123 --message "Trace logs" --verbose on --json
openclaw agent --to +15555550123 --message "Summon reply" --deliver
openclaw agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"
```

## Flags

- `--local`: lokal ausfuehren (erfordert API-Schluessel des Modellanbieters in Ihrer Shell)
- `--deliver`: die Antwort an den ausgewaehlten Kanal senden
- `--channel`: Zustellkanal (`whatsapp|telegram|discord|googlechat|slack|signal|imessage`, Standard: `whatsapp`)
- `--reply-to`: Ueberschreibung des Zustellziels
- `--reply-channel`: Ueberschreibung des Zustellkanals
- `--reply-account`: Ueberschreibung der Zustellkonto-ID
- `--thinking <off|minimal|low|medium|high|xhigh>`: Thinking-Stufe beibehalten (nur GPT-5.2- und Codex-Modelle)
- `--verbose <on|full|off>`: Verbose-Stufe beibehalten
- `--timeout <seconds>`: Agenten-Timeout ueberschreiben
- `--json`: strukturierte JSON-Ausgabe
