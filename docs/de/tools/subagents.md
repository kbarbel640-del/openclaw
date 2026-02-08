---
summary: "Sub-Agents: Starten isolierter Agentenläufe, die Ergebnisse an den anfordernden Chat zurückmelden"
read_when:
  - Sie moechten Hintergrund-/Parallelarbeit ueber den Agenten ausfuehren
  - Sie aendern sessions_spawn oder die Tool-Richtlinie fuer Sub-Agents
title: "Sub-Agents"
x-i18n:
  source_path: tools/subagents.md
  source_hash: 3c83eeed69a65dbb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:01Z
---

# Sub-Agents

Sub-Agents sind im Hintergrund laufende Agentenlaeufe, die aus einem bestehenden Agentenlauf gestartet werden. Sie laufen in ihrer eigenen Sitzung (`agent:<agentId>:subagent:<uuid>`) und **kuendigen** nach Abschluss ihr Ergebnis im anfordernden Chat-Kanal an.

## Slash-Befehl

Verwenden Sie `/subagents`, um Sub-Agentenlaeufe fuer die **aktuelle Sitzung** zu inspizieren oder zu steuern:

- `/subagents list`
- `/subagents stop <id|#|all>`
- `/subagents log <id|#> [limit] [tools]`
- `/subagents info <id|#>`
- `/subagents send <id|#> <message>`

`/subagents info` zeigt Lauf-Metadaten an (Status, Zeitstempel, Sitzungs-ID, Transkriptpfad, Bereinigung).

Primaere Ziele:

- Parallelisierung von „Recherche-/Langzeitaufgaben/langsamen Werkzeugen“, ohne den Hauptlauf zu blockieren.
- Standardmaessige Isolation von Sub-Agents (Sitzungstrennung + optionales Sandboxing).
- Eine schwer missbrauchbare Tool-Oberflaeche: Sub-Agents erhalten standardmaessig **keine** Sitzungstools.
- Vermeidung verschachtelter Fan-outs: Sub-Agents koennen keine Sub-Agents starten.

Kostenhinweis: Jeder Sub-Agent hat seinen **eigenen** Kontext und Tokenverbrauch. Fuer schwere oder wiederholte
Aufgaben setzen Sie ein guenstigeres Modell fuer Sub-Agents ein und behalten Sie Ihren Hauptagenten auf einem hoeherwertigen Modell.
Sie koennen dies ueber `agents.defaults.subagents.model` oder ueber agentenspezifische Overrides konfigurieren.

## Tool

Verwenden Sie `sessions_spawn`:

- Startet einen Sub-Agentenlauf (`deliver: false`, globale Lane: `subagent`)
- Fuehrt anschliessend einen Announce-Schritt aus und postet die Announce-Antwort in den anfordernden Chat-Kanal
- Standardmodell: erbt vom Aufrufer, es sei denn, Sie setzen `agents.defaults.subagents.model` (oder agentenspezifisch `agents.list[].subagents.model`); ein explizites `sessions_spawn.model` hat weiterhin Vorrang.
- Standarddenken: erbt vom Aufrufer, es sei denn, Sie setzen `agents.defaults.subagents.thinking` (oder agentenspezifisch `agents.list[].subagents.thinking`); ein explizites `sessions_spawn.thinking` hat weiterhin Vorrang.

Tool-Parameter:

- `task` (erforderlich)
- `label?` (optional)
- `agentId?` (optional; Start unter einer anderen Agenten-ID, falls erlaubt)
- `model?` (optional; ueberschreibt das Sub-Agentenmodell; ungueltige Werte werden uebersprungen und der Sub-Agent laeuft mit dem Standardmodell mit einer Warnung im Tool-Ergebnis)
- `thinking?` (optional; ueberschreibt die Denkstufe fuer den Sub-Agentenlauf)
- `runTimeoutSeconds?` (Standard `0`; wenn gesetzt, wird der Sub-Agentenlauf nach N Sekunden abgebrochen)
- `cleanup?` (`delete|keep`, Standard `keep`)

Zulaessigkeitsliste:

- `agents.list[].subagents.allowAgents`: Liste von Agenten-IDs, die ueber `agentId` anvisiert werden koennen (`["*"]`, um alle zu erlauben). Standard: nur der anfordernde Agent.

Erkennung:

- Verwenden Sie `agents_list`, um zu sehen, welche Agenten-IDs aktuell fuer `sessions_spawn` erlaubt sind.

Automatische Archivierung:

- Sub-Agenten-Sitzungen werden automatisch nach `agents.defaults.subagents.archiveAfterMinutes` archiviert (Standard: 60).
- Die Archivierung verwendet `sessions.delete` und benennt das Transkript in `*.deleted.<timestamp>` um (gleicher Ordner).
- `cleanup: "delete"` archiviert unmittelbar nach der Ankuendigung (behaelt das Transkript weiterhin durch Umbenennung).
- Die automatische Archivierung erfolgt nach bestem Bemuehen; ausstehende Timer gehen verloren, wenn der Gateway neu startet.
- `runTimeoutSeconds` archiviert **nicht** automatisch; es stoppt nur den Lauf. Die Sitzung bleibt bis zur automatischen Archivierung bestehen.

## Authentifizierung

Die Sub-Agenten-Authentifizierung wird nach **Agenten-ID** aufgeloest, nicht nach Sitzungstyp:

- Der Sub-Agenten-Sitzungsschluessel ist `agent:<agentId>:subagent:<uuid>`.
- Der Auth-Speicher wird aus dem `agentDir` dieses Agenten geladen.
- Die Auth-Profile des Hauptagenten werden als **Fallback** zusammengefuehrt; Agentenprofile ueberschreiben bei Konflikten die Hauptprofile.

Hinweis: Die Zusammenfuehrung ist additiv, sodass Hauptprofile stets als Fallback verfuegbar sind. Vollstaendig isolierte Authentifizierung pro Agent wird derzeit noch nicht unterstuetzt.

## Ankuendigung

Sub-Agents melden sich ueber einen Announce-Schritt zurueck:

- Der Announce-Schritt laeuft innerhalb der Sub-Agenten-Sitzung (nicht der anfordernden Sitzung).
- Antwortet der Sub-Agent exakt mit `ANNOUNCE_SKIP`, wird nichts gepostet.
- Andernfalls wird die Announce-Antwort ueber einen nachfolgenden `agent`-Aufruf (`deliver=true`) in den anfordernden Chat-Kanal gepostet.
- Announce-Antworten bewahren, sofern verfuegbar, die Thread-/Themenzuordnung (Slack-Threads, Telegram-Themen, Matrix-Threads).
- Announce-Nachrichten werden auf eine stabile Vorlage normalisiert:
  - `Status:` abgeleitet aus dem Laufergebnis (`success`, `error`, `timeout` oder `unknown`).
  - `Result:` der Zusammenfassungsinhalt aus dem Announce-Schritt (oder `(not available)`, falls fehlend).
  - `Notes:` Fehlerdetails und weiterer nuetzlicher Kontext.
- `Status` wird nicht aus der Modellausgabe abgeleitet; es stammt aus Laufzeit-Ergebnissignalen.

Announce-Payloads enthalten am Ende eine Statistikzeile (auch wenn umbrochen):

- Laufzeit (z. B. `runtime 5m12s`)
- Tokenverbrauch (Eingabe/Ausgabe/Gesamt)
- Geschaetzte Kosten, wenn Modellpreise konfiguriert sind (`models.providers.*.models[].cost`)
- `sessionKey`, `sessionId` und Transkriptpfad (damit der Hauptagent den Verlauf ueber `sessions_history` abrufen oder die Datei auf der Festplatte einsehen kann)

## Tool-Richtlinie (Sub-Agenten-Tools)

Standardmaessig erhalten Sub-Agents **alle Tools ausser Sitzungstools**:

- `sessions_list`
- `sessions_history`
- `sessions_send`
- `sessions_spawn`

Ueberschreiben per Konfiguration:

```json5
{
  agents: {
    defaults: {
      subagents: {
        maxConcurrent: 1,
      },
    },
  },
  tools: {
    subagents: {
      tools: {
        // deny wins
        deny: ["gateway", "cron"],
        // if allow is set, it becomes allow-only (deny still wins)
        // allow: ["read", "exec", "process"]
      },
    },
  },
}
```

## Nebenlaeufigkeit

Sub-Agents verwenden eine dedizierte In-Process-Warteschlangen-Lane:

- Lane-Name: `subagent`
- Nebenlaeufigkeit: `agents.defaults.subagents.maxConcurrent` (Standard `8`)

## Stoppen

- Das Senden von `/stop` im anfordernden Chat bricht die anfordernde Sitzung ab und stoppt alle daraus gestarteten aktiven Sub-Agentenlaeufe.

## Einschraenkungen

- Die Ankuendigung von Sub-Agents erfolgt nach **bestem Bemuehen**. Wenn der Gateway neu startet, gehen ausstehende „Rueckankuendigungen“ verloren.
- Sub-Agents teilen weiterhin dieselben Gateway-Prozessressourcen; betrachten Sie `maxConcurrent` als Sicherheitsventil.
- `sessions_spawn` ist stets nicht blockierend: Es gibt sofort `{ status: "accepted", runId, childSessionKey }` zurueck.
- Der Sub-Agenten-Kontext injiziert nur `AGENTS.md` + `TOOLS.md` (kein `SOUL.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md` oder `BOOTSTRAP.md`).
