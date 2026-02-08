---
summary: "Kontext: was das Modell sieht, wie er aufgebaut ist und wie er inspiziert werden kann"
read_when:
  - Sie moechten verstehen, was „Kontext“ in OpenClaw bedeutet
  - Sie debuggen, warum das Modell etwas „weiss“ (oder vergessen hat)
  - Sie moechten den Kontext-Overhead reduzieren (/context, /status, /compact)
title: "Kontext"
x-i18n:
  source_path: concepts/context.md
  source_hash: b32867b9b93254fd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:05Z
---

# Kontext

„Kontext“ ist **alles, was OpenClaw fuer einen Lauf an das Modell sendet**. Er ist durch das **Kontextfenster** des Modells (Token-Limit) begrenzt.

Mentales Modell fuer Einsteiger:

- **System-Prompt** (von OpenClaw erstellt): Regeln, Werkzeuge, Skills-Liste, Zeit/Laufzeit und injizierte Workspace-Dateien.
- **Gesprächsverlauf**: Ihre Nachrichten + die Antworten des Assistenten fuer diese Sitzung.
- **Werkzeugaufrufe/-ergebnisse + Anhaenge**: Kommandoausgaben, Dateizugriffe, Bilder/Audio usw.

Kontext ist _nicht dasselbe_ wie „Speicher“: Speicher kann auf der Festplatte abgelegt und spaeter wieder geladen werden; Kontext ist das, was sich aktuell im Fenster des Modells befindet.

## Schnellstart (Kontext inspizieren)

- `/status` → schnelle Ansicht „wie voll ist mein Fenster?“ + Sitzungseinstellungen.
- `/context list` → was injiziert wird + grobe Groessen (pro Datei + Summen).
- `/context detail` → tiefere Aufschluesselung: pro Datei, pro Werkzeug-Schema, pro Skill-Eintrag sowie Groesse des System-Prompts.
- `/usage tokens` → fuegt normalen Antworten eine Fusszeile zur Nutzung pro Antwort hinzu.
- `/compact` → fasst aelteren Verlauf zu einem kompakten Eintrag zusammen, um Fensterplatz freizugeben.

Siehe auch: [Slash commands](/tools/slash-commands), [Token use & costs](/token-use), [Compaction](/concepts/compaction).

## Beispielausgabe

Werte variieren je nach Modell, Anbieter, Werkzeugrichtlinie und dem Inhalt Ihres Workspace.

### `/context list`

```
🧠 Context breakdown
Workspace: <workspaceDir>
Bootstrap max/file: 20,000 chars
Sandbox: mode=non-main sandboxed=false
System prompt (run): 38,412 chars (~9,603 tok) (Project Context 23,901 chars (~5,976 tok))

Injected workspace files:
- AGENTS.md: OK | raw 1,742 chars (~436 tok) | injected 1,742 chars (~436 tok)
- SOUL.md: OK | raw 912 chars (~228 tok) | injected 912 chars (~228 tok)
- TOOLS.md: TRUNCATED | raw 54,210 chars (~13,553 tok) | injected 20,962 chars (~5,241 tok)
- IDENTITY.md: OK | raw 211 chars (~53 tok) | injected 211 chars (~53 tok)
- USER.md: OK | raw 388 chars (~97 tok) | injected 388 chars (~97 tok)
- HEARTBEAT.md: MISSING | raw 0 | injected 0
- BOOTSTRAP.md: OK | raw 0 chars (~0 tok) | injected 0 chars (~0 tok)

Skills list (system prompt text): 2,184 chars (~546 tok) (12 skills)
Tools: read, edit, write, exec, process, browser, message, sessions_send, …
Tool list (system prompt text): 1,032 chars (~258 tok)
Tool schemas (JSON): 31,988 chars (~7,997 tok) (counts toward context; not shown as text)
Tools: (same as above)

Session tokens (cached): 14,250 total / ctx=32,000
```

### `/context detail`

```
🧠 Context breakdown (detailed)
…
Top skills (prompt entry size):
- frontend-design: 412 chars (~103 tok)
- oracle: 401 chars (~101 tok)
… (+10 more skills)

Top tools (schema size):
- browser: 9,812 chars (~2,453 tok)
- exec: 6,240 chars (~1,560 tok)
… (+N more tools)
```

## Was zum Kontextfenster zaehlt

Alles, was das Modell erhaelt, zaehlt, einschliesslich:

- System-Prompt (alle Abschnitte).
- Gesprächsverlauf.
- Werkzeugaufrufe + Werkzeugergebnisse.
- Anhaenge/Transkripte (Bilder/Audio/Dateien).
- Kompaktionszusammenfassungen und Pruning-Artefakte.
- Anbieter-„Wrapper“ oder versteckte Header (nicht sichtbar, zaehlen trotzdem).

## Wie OpenClaw den System-Prompt aufbaut

Der System-Prompt ist **OpenClaw-eigen** und wird bei jedem Lauf neu erstellt. Er enthaelt:

- Werkzeugliste + kurze Beschreibungen.
- Skills-Liste (nur Metadaten; siehe unten).
- Workspace-Speicherort.
- Zeit (UTC + konvertierte Benutzerzeit, falls konfiguriert).
- Laufzeit-Metadaten (Host/OS/Modell/Thinking).
- Injizierte Workspace-Bootstrap-Dateien unter **Project Context**.

Vollstaendige Aufschluesselung: [System Prompt](/concepts/system-prompt).

## Injizierte Workspace-Dateien (Project Context)

Standardmaessig injiziert OpenClaw eine feste Menge an Workspace-Dateien (falls vorhanden):

- `AGENTS.md`
- `SOUL.md`
- `TOOLS.md`
- `IDENTITY.md`
- `USER.md`
- `HEARTBEAT.md`
- `BOOTSTRAP.md` (nur beim ersten Lauf)

Grosse Dateien werden pro Datei mit `agents.defaults.bootstrapMaxChars` gekuerzt (Standard `20000` Zeichen). `/context` zeigt **roh vs. injiziert**e Groessen und ob eine Kuerzung stattgefunden hat.

## Skills: was injiziert wird vs. on-demand geladen

Der System-Prompt enthaelt eine kompakte **Skills-Liste** (Name + Beschreibung + Speicherort). Diese Liste verursacht realen Overhead.

Skill-Anweisungen sind standardmaessig _nicht_ enthalten. Vom Modell wird erwartet, den Skill `read` und die `SKILL.md` **nur bei Bedarf** zu laden.

## Werkzeuge: es gibt zwei Kosten

Werkzeuge beeinflussen den Kontext auf zwei Arten:

1. **Werkzeuglisten-Text** im System-Prompt (das, was Sie als „Tooling“ sehen).
2. **Werkzeug-Schemata** (JSON). Diese werden an das Modell gesendet, damit es Werkzeuge aufrufen kann. Sie zaehlen zum Kontext, auch wenn Sie sie nicht als Klartext sehen.

`/context detail` schluesselt die groessten Werkzeug-Schemata auf, damit Sie sehen koennen, was dominiert.

## Befehle, Direktiven und „Inline-Shortcuts“

Slash-Befehle werden vom Gateway verarbeitet. Es gibt einige unterschiedliche Verhaltensweisen:

- **Eigenstaendige Befehle**: Eine Nachricht, die nur aus `/...` besteht, wird als Befehl ausgefuehrt.
- **Direktiven**: `/think`, `/verbose`, `/reasoning`, `/elevated`, `/model`, `/queue` werden entfernt, bevor das Modell die Nachricht sieht.
  - Nur-Direktiven-Nachrichten persistieren Sitzungseinstellungen.
  - Inline-Direktiven in einer normalen Nachricht wirken als Hinweise pro Nachricht.
- **Inline-Shortcuts** (nur erlaubte Absender): Bestimmte `/...`-Tokens innerhalb einer normalen Nachricht koennen sofort ausgefuehrt werden (Beispiel: „hey /status“) und werden entfernt, bevor das Modell den restlichen Text sieht.

Details: [Slash commands](/tools/slash-commands).

## Sitzungen, Kompaktion und Pruning (was persistiert)

Was ueber Nachrichten hinweg persistiert, haengt vom Mechanismus ab:

- **Normaler Verlauf** persistiert im Sitzungsprotokoll, bis er durch Richtlinien kompakt/pruned wird.
- **Kompaktion** persistiert eine Zusammenfassung im Protokoll und behaelt aktuelle Nachrichten unveraendert.
- **Pruning** entfernt alte Werkzeugergebnisse aus dem _im Speicher befindlichen_ Prompt fuer einen Lauf, schreibt das Protokoll jedoch nicht um.

Dokumentation: [Session](/concepts/session), [Compaction](/concepts/compaction), [Session pruning](/concepts/session-pruning).

## Was `/context` tatsaechlich meldet

`/context` bevorzugt den neuesten **laufbasiert erstellten** System-Prompt-Bericht, sofern verfuegbar:

- `System prompt (run)` = aus dem letzten eingebetteten (werkzeugfaehigen) Lauf erfasst und im Sitzungsspeicher persistiert.
- `System prompt (estimate)` = bei Bedarf berechnet, wenn kein Laufbericht existiert (oder wenn ueber ein CLI-Backend ausgefuehrt wird, das keinen Bericht erzeugt).

In beiden Faellen meldet es Groessen und die groessten Beitraege; es gibt **nicht** den vollstaendigen System-Prompt oder Werkzeug-Schemata aus.
