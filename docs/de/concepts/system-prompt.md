---
summary: „Was der OpenClaw-System-Prompt enthält und wie er zusammengestellt wird“
read_when:
  - Bearbeiten von System-Prompt-Text, Werkzeugliste oder Zeit-/Heartbeat-Abschnitten
  - Ändern des Workspace-Bootstraps oder des Verhaltens bei der Skills-Injektion
title: „System-Prompt“
x-i18n:
  source_path: concepts/system-prompt.md
  source_hash: bef4b2674ba0414c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:15Z
---

# System-Prompt

OpenClaw erstellt für jeden Agentenlauf einen benutzerdefinierten System-Prompt. Der Prompt ist **OpenClaw-eigen** und verwendet nicht den Standard-Prompt von p-coding-agent.

Der Prompt wird von OpenClaw zusammengestellt und in jeden Agentenlauf injiziert.

## Struktur

Der Prompt ist bewusst kompakt gehalten und verwendet feste Abschnitte:

- **Tooling**: aktuelle Werkzeugliste + kurze Beschreibungen.
- **Safety**: kurze Guardrail-Erinnerung, um machtorientiertes Verhalten oder das Umgehen von Aufsicht zu vermeiden.
- **Skills** (falls verfügbar): weist das Modell an, Skill-Anweisungen bei Bedarf zu laden.
- **OpenClaw Self-Update**: wie `config.apply` und `update.run` auszuführen sind.
- **Workspace**: Arbeitsverzeichnis (`agents.defaults.workspace`).
- **Documentation**: lokaler Pfad zu den OpenClaw-Dokumenten (Repo oder npm-Paket) und wann diese zu lesen sind.
- **Workspace Files (injected)**: zeigt an, dass Bootstrap-Dateien unten enthalten sind.
- **Sandbox** (wenn aktiviert): weist auf eine in einer Sandbox laufende Runtime hin, Sandbox-Pfade und ob erhöhte Ausführung verfügbar ist.
- **Current Date & Time**: benutzerlokale Zeit, Zeitzone und Zeitformat.
- **Reply Tags**: optionale Antwort-Tag-Syntax für unterstützte Anbieter.
- **Heartbeats**: Heartbeat-Prompt und Ack-Verhalten.
- **Runtime**: Host, OS, Node, Modell, Repo-Root (wenn erkannt), Thinking-Level (eine Zeile).
- **Reasoning**: aktuelles Sichtbarkeitsniveau + Hinweis zum Umschalten mit /reasoning.

Safety-Guardrails im System-Prompt sind beratend. Sie steuern das Modellverhalten, setzen jedoch keine Richtlinien durch. Nutzen Sie Tool-Richtlinien, Exec-Freigaben, Sandboxing und Kanal-Allowlisten für harte Durchsetzung; Betreiber können diese bewusst deaktivieren.

## Prompt-Modi

OpenClaw kann kleinere System-Prompts für Subagenten rendern. Die Runtime setzt dafür pro Lauf ein
`promptMode` (keine benutzerseitige Konfiguration):

- `full` (Standard): enthält alle oben genannten Abschnitte.
- `minimal`: wird für Subagenten verwendet; lässt **Skills**, **Memory Recall**, **OpenClaw
  Self-Update**, **Model Aliases**, **User Identity**, **Reply Tags**,
  **Messaging**, **Silent Replies** und **Heartbeats** weg. Tooling, **Safety**,
  Workspace, Sandbox, Current Date & Time (falls bekannt), Runtime sowie injizierter
  Kontext bleiben verfügbar.
- `none`: gibt nur die Basis-Identitätszeile zurück.

Wenn `promptMode=minimal`, werden zusätzlich injizierte Prompts als **Subagent
Context** statt **Group Chat Context** gekennzeichnet.

## Workspace-Bootstrap-Injektion

Bootstrap-Dateien werden gekürzt und unter **Project Context** angehängt, sodass das Modell Identitäts- und Profilkontext sieht, ohne explizite Lesevorgänge:

- `AGENTS.md`
- `SOUL.md`
- `TOOLS.md`
- `IDENTITY.md`
- `USER.md`
- `HEARTBEAT.md`
- `BOOTSTRAP.md` (nur bei brandneuen Workspaces)

Große Dateien werden mit einer Markierung abgeschnitten. Die maximale Größe pro Datei wird durch
`agents.defaults.bootstrapMaxChars` gesteuert (Standard: 20000). Fehlende Dateien injizieren eine
kurze Fehlend-Datei-Markierung.

Interne Hooks können diesen Schritt über `agent:bootstrap` abfangen, um die
injizierten Bootstrap-Dateien zu verändern oder zu ersetzen (zum Beispiel das Austauschen von `SOUL.md` gegen eine alternative Persona).

Um zu prüfen, wie viel jede injizierte Datei beiträgt (roh vs. injiziert, Trunkierung sowie Tool-Schema-Overhead), verwenden Sie `/context list` oder `/context detail`. Siehe [Context](/concepts/context).

## Zeitbehandlung

Der System-Prompt enthält einen eigenen Abschnitt **Current Date & Time**, wenn die
Benutzerzeitzone bekannt ist. Um den Prompt cache-stabil zu halten, enthält er nun nur noch die **Zeitzone** (keine dynamische Uhr oder Zeitformat).

Verwenden Sie `session_status`, wenn der Agent die aktuelle Zeit benötigt; die Statuskarte
enthält eine Zeitstempelzeile.

Konfiguration über:

- `agents.defaults.userTimezone`
- `agents.defaults.timeFormat` (`auto` | `12` | `24`)

Siehe [Date & Time](/date-time) fuer alle Details zum Verhalten.

## Skills

Wenn geeignete Skills vorhanden sind, injiziert OpenClaw eine kompakte **Liste verfügbarer Skills**
(`formatSkillsForPrompt`), die den **Dateipfad** für jeden Skill enthält. Der
Prompt weist das Modell an, `read` zu verwenden, um die SKILL.md am aufgeführten
Ort (Workspace, verwaltet oder gebündelt) zu laden. Wenn keine Skills geeignet sind, wird der
Skills-Abschnitt weggelassen.

```
<available_skills>
  <skill>
    <name>...</name>
    <description>...</description>
    <location>...</location>
  </skill>
</available_skills>
```

Dies hält den Basis-Prompt klein und ermöglicht dennoch eine gezielte Nutzung von Skills.

## Documentation

Wenn verfügbar, enthält der System-Prompt einen Abschnitt **Documentation**, der auf das
lokale OpenClaw-Dokumentationsverzeichnis verweist (entweder `docs/` im Repo-Workspace oder die gebündelten npm-
Paket-Dokumente) und außerdem den öffentlichen Mirror, das Source-Repo, den Community-Discord und
ClawHub (https://clawhub.com) zur Skill-Erkennung nennt. Der Prompt weist das Modell an, bei
OpenClaw-Verhalten, -Befehlen, -Konfiguration oder -Architektur zuerst die lokalen Dokumente zu konsultieren und
`openclaw status` nach Möglichkeit selbst auszuführen (den Benutzer nur zu fragen, wenn kein Zugriff besteht).
