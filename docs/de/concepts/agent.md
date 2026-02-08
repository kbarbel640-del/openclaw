---
summary: "Agent-Laufzeit (eingebettetes pi-mono), Workspace-Vertrag und Sitzungs-Bootstrap"
read_when:
  - Beim Ändern der Agent-Laufzeit, des Workspace-Bootstraps oder des Sitzungsverhaltens
title: "Agent-Laufzeit"
x-i18n:
  source_path: concepts/agent.md
  source_hash: 04b4e0bc6345d2af
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:01Z
---

# Agent-Laufzeit 🤖

OpenClaw betreibt eine einzelne eingebettete Agent-Laufzeit, abgeleitet von **pi-mono**.

## Workspace (erforderlich)

OpenClaw verwendet ein einzelnes Agent-Workspace-Verzeichnis (`agents.defaults.workspace`) als **einziges** Arbeitsverzeichnis (`cwd`) des Agenten für Werkzeuge und Kontext.

Empfohlen: Verwenden Sie `openclaw setup`, um `~/.openclaw/openclaw.json` zu erstellen, falls es fehlt, und die Workspace-Dateien zu initialisieren.

Vollständiges Workspace-Layout + Backup-Anleitung: [Agent workspace](/concepts/agent-workspace)

Wenn `agents.defaults.sandbox` aktiviert ist, können Nicht-Hauptsitzungen dies mit
sitzungsspezifischen Workspaces unter `agents.defaults.sandbox.workspaceRoot` überschreiben (siehe
[Gateway configuration](/gateway/configuration)).

## Bootstrap-Dateien (injiziert)

Innerhalb von `agents.defaults.workspace` erwartet OpenClaw diese benutzerbearbeitbaren Dateien:

- `AGENTS.md` — Betriebsanweisungen + „Gedächtnis“
- `SOUL.md` — Persona, Grenzen, Tonfall
- `TOOLS.md` — vom Benutzer gepflegte Werkzeugnotizen (z. B. `imsg`, `sag`, Konventionen)
- `BOOTSTRAP.md` — einmaliges Erststart-Ritual (wird nach Abschluss gelöscht)
- `IDENTITY.md` — Agentenname/-vibe/-Emoji
- `USER.md` — Benutzerprofil + bevorzugte Anrede

Im ersten Zug einer neuen Sitzung injiziert OpenClaw den Inhalt dieser Dateien direkt in den Agentenkontext.

Leere Dateien werden übersprungen. Große Dateien werden gekürzt und mit einer Markierung abgeschnitten, damit Prompts schlank bleiben (lesen Sie die Datei für den vollständigen Inhalt).

Fehlt eine Datei, injiziert OpenClaw eine einzelne „missing file“-Markierungszeile (und `openclaw setup` erstellt eine sichere Standardvorlage).

`BOOTSTRAP.md` wird nur für einen **brandneuen Workspace** erstellt (keine anderen Bootstrap-Dateien vorhanden). Wenn Sie sie nach Abschluss des Rituals löschen, sollte sie bei späteren Neustarts nicht erneut erstellt werden.

Um die Erstellung von Bootstrap-Dateien vollständig zu deaktivieren (für vorab bestückte Workspaces), setzen Sie:

```json5
{ agent: { skipBootstrap: true } }
```

## Integrierte Werkzeuge

Kernwerkzeuge (read/exec/edit/write und zugehörige Systemwerkzeuge) sind immer verfügbar,
vorbehaltlich der Werkzeugrichtlinie. `apply_patch` ist optional und durch
`tools.exec.applyPatch` eingeschränkt. `TOOLS.md` steuert **nicht**, welche Werkzeuge existieren; es ist eine Anleitung, wie _Sie_ deren Nutzung wünschen.

## Skills

OpenClaw lädt Skills aus drei Orten (bei Namenskonflikten gewinnt der Workspace):

- Gebündelt (mit der Installation ausgeliefert)
- Verwaltet/lokal: `~/.openclaw/skills`
- Workspace: `<workspace>/skills`

Skills können per Konfiguration/Env eingeschränkt werden (siehe `skills` in der [Gateway configuration](/gateway/configuration)).

## pi-mono-Integration

OpenClaw nutzt Teile der pi-mono-Codebasis (Modelle/Werkzeuge) wieder, aber **Sitzungsverwaltung, Erkennung und Werkzeug-Verdrahtung gehören OpenClaw**.

- Keine pi-coding Agent-Laufzeit.
- Es werden keine `~/.pi/agent`- oder `<workspace>/.pi`-Einstellungen berücksichtigt.

## Sitzungen

Sitzungsprotokolle werden als JSONL gespeichert unter:

- `~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl`

Die Sitzungs-ID ist stabil und wird von OpenClaw gewählt.
Legacy-Pi/Tau-Sitzungsordner werden **nicht** gelesen.

## Steuern während des Streamings

Wenn der Queue-Modus `steer` ist, werden eingehende Nachrichten in den aktuellen Lauf injiziert.
Die Queue wird **nach jedem Werkzeugaufruf** geprüft; ist eine wartende Nachricht vorhanden,
werden verbleibende Werkzeugaufrufe aus der aktuellen Assistant-Nachricht übersprungen (Fehler-Werkzeugergebnisse mit „Skipped due to queued user message.“), dann wird die wartende Benutzernachricht vor der nächsten Assistant-Antwort injiziert.

Wenn der Queue-Modus `followup` oder `collect` ist, werden eingehende Nachrichten gehalten, bis der
aktuelle Zug endet; danach startet ein neuer Agenten-Zug mit den wartenden Payloads. Siehe
[Queue](/concepts/queue) fuer alle Details zu Modus + Debounce/Cap-Verhalten.

Block-Streaming sendet abgeschlossene Assistant-Blöcke, sobald sie fertig sind; es ist
**standardmäßig deaktiviert** (`agents.defaults.blockStreamingDefault: "off"`).
Passen Sie die Grenze über `agents.defaults.blockStreamingBreak` an (`text_end` vs. `message_end`; Standard: text_end).
Steuern Sie das weiche Block-Chunking mit `agents.defaults.blockStreamingChunk` (Standard:
800–1200 Zeichen; bevorzugt Absatzumbrüche, dann Zeilenumbrüche; zuletzt Sätze).
Fassen Sie gestreamte Chunks mit `agents.defaults.blockStreamingCoalesce` zusammen, um
Einzeilen-Spam zu reduzieren (inaktivitätsbasiertes Zusammenführen vor dem Senden). Nicht-Telegram-Kanäle erfordern
explizit `*.blockStreaming: true`, um Block-Antworten zu aktivieren.
Ausführliche Werkzeugzusammenfassungen werden beim Werkzeugstart ausgegeben (kein Debounce); die Control-UI
streamt Werkzeugausgaben über Agenten-Events, sofern verfügbar.
Weitere Details: [Streaming + chunking](/concepts/streaming).

## Modell-Refs

Modell-Refs in der Konfiguration (zum Beispiel `agents.defaults.model` und `agents.defaults.models`) werden geparst, indem am **ersten** `/` getrennt wird.

- Verwenden Sie `provider/model` beim Konfigurieren von Modellen.
- Wenn die Modell-ID selbst `/` enthält (OpenRouter-Stil), schließen Sie das Anbieterpräfix ein (Beispiel: `openrouter/moonshotai/kimi-k2`).
- Wenn Sie den Anbieter weglassen, behandelt OpenClaw die Eingabe als Alias oder als Modell für den **Standardanbieter** (funktioniert nur, wenn es kein `/` in der Modell-ID gibt).

## Konfiguration (minimal)

Mindestens zu setzen:

- `agents.defaults.workspace`
- `channels.whatsapp.allowFrom` (dringend empfohlen)

---

_Next: [Group Chats](/concepts/group-messages)_ 🦞
