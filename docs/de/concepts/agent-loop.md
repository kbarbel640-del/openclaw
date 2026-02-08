---
summary: "Lebenszyklus der Agent-Schleife, Streams und Wartesemantik"
read_when:
  - Sie benötigen eine exakte Schritt-für-Schritt-Erklärung der Agent-Schleife oder der Lebenszyklusereignisse
title: "Agent-Schleife"
x-i18n:
  source_path: concepts/agent-loop.md
  source_hash: 0775b96eb3451e13
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:05Z
---

# Agent-Schleife (OpenClaw)

Eine agentische Schleife ist der vollständige „echte“ Lauf eines Agenten: Eingang → Kontextaufbau → Modellinferenz →
Werkzeugausführung → Streaming-Antworten → Persistenz. Sie ist der maßgebliche Pfad, der eine Nachricht
in Aktionen und eine finale Antwort umsetzt und dabei den Sitzungszustand konsistent hält.

In OpenClaw ist eine Schleife ein einzelner, serialisierter Lauf pro Sitzung, der Lebenszyklus- und Stream-Ereignisse
emittiert, während das Modell nachdenkt, Werkzeuge aufruft und Ausgabe streamt. Dieses Dokument erklärt, wie diese
authentische Schleife Ende-zu-Ende verdrahtet ist.

## Einstiegspunkte

- Gateway RPC: `agent` und `agent.wait`.
- CLI: Befehl `agent`.

## Funktionsweise (auf hoher Ebene)

1. `agent` RPC validiert Parameter, löst die Sitzung auf (sessionKey/sessionId), persistiert Sitzungsmetadaten und gibt `{ runId, acceptedAt }` sofort zurück.
2. `agentCommand` führt den Agenten aus:
   - löst Modell- sowie thinking/verbose-Standardwerte auf
   - lädt den Skills-Snapshot
   - ruft `runEmbeddedPiAgent` (pi-agent-core Runtime) auf
   - emittiert **lifecycle end/error**, falls die eingebettete Schleife keines emittiert
3. `runEmbeddedPiAgent`:
   - serialisiert Läufe über sitzungsbezogene + globale Warteschlangen
   - löst Modell + Authentifizierungsprofil auf und baut die Pi-Sitzung
   - abonniert Pi-Ereignisse und streamt Assistant-/Tool-Deltas
   - erzwingt ein Timeout → bricht den Lauf ab, wenn überschritten
   - gibt Nutzlasten + Nutzungsmetadaten zurück
4. `subscribeEmbeddedPiSession` überbrückt pi-agent-core-Ereignisse in den OpenClaw-`agent`-Stream:
   - Tool-Ereignisse ⇒ `stream: "tool"`
   - Assistant-Deltas ⇒ `stream: "assistant"`
   - Lebenszyklusereignisse ⇒ `stream: "lifecycle"` (`phase: "start" | "end" | "error"`)
5. `agent.wait` verwendet `waitForAgentJob`:
   - wartet auf **lifecycle end/error** für `runId`
   - gibt `{ status: ok|error|timeout, startedAt, endedAt, error? }` zurück

## Warteschlangen + Nebenläufigkeit

- Läufe werden pro Sitzungsschlüssel (Sitzungsspur) serialisiert und optional über eine globale Spur geführt.
- Dies verhindert Werkzeug-/Sitzungs-Race-Conditions und hält den Sitzungsverlauf konsistent.
- Messaging-Kanäle können Warteschlangenmodi wählen (collect/steer/followup), die dieses Spurensystem speisen.
  Siehe [Command Queue](/concepts/queue).

## Sitzung + Workspace-Vorbereitung

- Der Workspace wird aufgelöst und erstellt; in einer Sandbox ausgeführte Läufe können auf ein Sandbox-Workspace-Root umleiten.
- Skills werden geladen (oder aus einem Snapshot wiederverwendet) und in Umgebung und Prompt injiziert.
- Bootstrap-/Kontextdateien werden aufgelöst und in den System-Prompt-Bericht injiziert.
- Eine Schreibsperre für die Sitzung wird erworben; `SessionManager` wird geöffnet und vor dem Streaming vorbereitet.

## Prompt-Zusammenbau + System-Prompt

- Der System-Prompt wird aus dem Basis-Prompt von OpenClaw, dem Skills-Prompt, dem Bootstrap-Kontext und laufbezogenen Überschreibungen aufgebaut.
- Modellspezifische Limits und Kompaktierungs-Reservetoken werden durchgesetzt.
- Siehe [System prompt](/concepts/system-prompt) für das, was das Modell sieht.

## Hook-Punkte (wo Sie abfangen können)

OpenClaw hat zwei Hook-Systeme:

- **Interne Hooks** (Gateway-Hooks): ereignisgesteuerte Skripte für Befehle und Lebenszyklusereignisse.
- **Plugin-Hooks**: Erweiterungspunkte innerhalb des Agent-/Werkzeug-Lebenszyklus und der Gateway-Pipeline.

### Interne Hooks (Gateway-Hooks)

- **`agent:bootstrap`**: läuft beim Erstellen der Bootstrap-Dateien, bevor der System-Prompt finalisiert ist.
  Verwenden Sie dies, um Bootstrap-Kontextdateien hinzuzufügen oder zu entfernen.
- **Command-Hooks**: `/new`, `/reset`, `/stop` und andere Befehlereignisse (siehe Hooks-Dokument).

Siehe [Hooks](/hooks) für Einrichtung und Beispiele.

### Plugin-Hooks (Agent- + Gateway-Lebenszyklus)

Diese laufen innerhalb der Agent-Schleife oder der Gateway-Pipeline:

- **`before_agent_start`**: injiziert Kontext oder überschreibt den System-Prompt, bevor der Lauf startet.
- **`agent_end`**: inspiziert die finale Nachrichtenliste und Laufmetadaten nach Abschluss.
- **`before_compaction` / `after_compaction`**: beobachten oder annotieren Kompaktierungszyklen.
- **`before_tool_call` / `after_tool_call`**: fangen Tool-Parameter/-Ergebnisse ab.
- **`tool_result_persist`**: transformiert Tool-Ergebnisse synchron, bevor sie in das Sitzungsprotokoll geschrieben werden.
- **`message_received` / `message_sending` / `message_sent`**: eingehende + ausgehende Nachrichten-Hooks.
- **`session_start` / `session_end`**: Grenzen des Sitzungslebenszyklus.
- **`gateway_start` / `gateway_stop`**: Gateway-Lebenszyklusereignisse.

Siehe [Plugins](/plugin#plugin-hooks) für die Hook-API und Registrierungsdetails.

## Streaming + partielle Antworten

- Assistant-Deltas werden aus pi-agent-core gestreamt und als `assistant`-Ereignisse emittiert.
- Block-Streaming kann partielle Antworten entweder auf `text_end` oder `message_end` emittieren.
- Reasoning-Streaming kann als separater Stream oder als Block-Antworten emittiert werden.
- Siehe [Streaming](/concepts/streaming) für Chunking- und Block-Antwort-Verhalten.

## Werkzeugausführung + Messaging-Werkzeuge

- Tool-Start-/Update-/Ende-Ereignisse werden im `tool`-Stream emittiert.
- Tool-Ergebnisse werden vor dem Protokollieren/Emittieren hinsichtlich Größe und Bild-Payloads bereinigt.
- Sendevorgänge von Messaging-Werkzeugen werden verfolgt, um doppelte Assistant-Bestätigungen zu unterdrücken.

## Antwortformung + Unterdrückung

- Finale Nutzlasten werden zusammengestellt aus:
  - Assistant-Text (und optionalem Reasoning)
  - Inline-Tool-Zusammenfassungen (wenn verbose + erlaubt)
  - Assistant-Fehlertext, wenn das Modell fehlschlägt
- `NO_REPLY` wird als stummes Token behandelt und aus ausgehenden Nutzlasten gefiltert.
- Duplikate von Messaging-Werkzeugen werden aus der finalen Nutzlastliste entfernt.
- Wenn keine darstellbaren Nutzlasten verbleiben und ein Tool einen Fehler hatte, wird eine Fallback-Tool-Fehlerantwort emittiert
  (es sei denn, ein Messaging-Werkzeug hat bereits eine für Benutzer sichtbare Antwort gesendet).

## Kompaktierung + Wiederholungen

- Auto-Kompaktierung emittiert `compaction`-Stream-Ereignisse und kann eine Wiederholung auslösen.
- Bei einer Wiederholung werden In-Memory-Puffer und Tool-Zusammenfassungen zurückgesetzt, um doppelte Ausgabe zu vermeiden.
- Siehe [Compaction](/concepts/compaction) für die Kompaktierungspipeline.

## Ereignis-Streams (heute)

- `lifecycle`: emittiert von `subscribeEmbeddedPiSession` (und als Fallback von `agentCommand`)
- `assistant`: gestreamte Deltas aus pi-agent-core
- `tool`: gestreamte Tool-Ereignisse aus pi-agent-core

## Chat-Kanal-Verarbeitung

- Assistant-Deltas werden in Chat-`delta`-Nachrichten gepuffert.
- Eine Chat-`final` wird bei **lifecycle end/error** emittiert.

## Timeouts

- `agent.wait` Standard: 30 s (nur das Warten). Parameter `timeoutMs` überschreibt.
- Agent-Runtime: `agents.defaults.timeoutSeconds` Standard 600 s; durchgesetzt im `runEmbeddedPiAgent`-Abbruch-Timer.

## Wo Dinge vorzeitig enden können

- Agent-Timeout (Abbruch)
- AbortSignal (Abbrechen)
- Gateway-Trennung oder RPC-Timeout
- `agent.wait`-Timeout (nur Warten, stoppt den Agenten nicht)
