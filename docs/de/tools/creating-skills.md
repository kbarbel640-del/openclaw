---
title: „Skills erstellen“
x-i18n:
  source_path: tools/creating-skills.md
  source_hash: ad801da34fe361ff
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:40Z
---

# Eigene Skills erstellen 🛠

OpenClaw ist so konzipiert, dass es sich leicht erweitern lässt. „Skills“ sind der primäre Weg, um Ihrem Assistenten neue Fähigkeiten hinzuzufügen.

## Was ist ein Skill?

Ein Skill ist ein Verzeichnis, das eine Datei `SKILL.md` enthält (die Anweisungen und Werkzeugdefinitionen für das LLM bereitstellt) und optional einige Skripte oder Ressourcen.

## Schritt für Schritt: Ihr erster Skill

### 1. Verzeichnis erstellen

Skills befinden sich in Ihrem Workspace, normalerweise `~/.openclaw/workspace/skills/`. Erstellen Sie einen neuen Ordner für Ihren Skill:

```bash
mkdir -p ~/.openclaw/workspace/skills/hello-world
```

### 2. Die `SKILL.md` definieren

Erstellen Sie in diesem Verzeichnis eine Datei `SKILL.md`. Diese Datei verwendet YAML-Frontmatter für Metadaten und Markdown für Anweisungen.

```markdown
---
name: hello_world
description: A simple skill that says hello.
---

# Hello World Skill

When the user asks for a greeting, use the `echo` tool to say "Hello from your custom skill!".
```

### 3. Werkzeuge hinzufügen (optional)

Sie können im Frontmatter eigene Werkzeuge definieren oder den Agenten anweisen, bestehende Systemwerkzeuge zu verwenden (wie `bash` oder `browser`).

### 4. OpenClaw aktualisieren

Bitten Sie Ihren Agenten, „refresh skills“ auszuführen, oder starten Sie das Gateway neu. OpenClaw erkennt das neue Verzeichnis und indiziert die `SKILL.md`.

## Bewährte Praktiken

- **Konzise bleiben**: Weisen Sie das Modell an, _was_ zu tun ist, nicht, wie es ein KI-Modell sein soll.
- **Sicherheit zuerst**: Wenn Ihr Skill `bash` verwendet, stellen Sie sicher, dass die Prompts keine beliebige Command-Injection aus nicht vertrauenswürdigem Benutzereingaben zulassen.
- **Lokal testen**: Verwenden Sie `openclaw agent --message "use my new skill"` zum Testen.

## Geteilte Skills

Sie können Skills auch auf [ClawHub](https://clawhub.com) durchsuchen und dazu beitragen.
