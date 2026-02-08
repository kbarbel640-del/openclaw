---
summary: "CLI-Referenz für `openclaw plugins` (list, install, enable/disable, doctor)"
read_when:
  - Sie möchten In-Process-Gateway-Plugins installieren oder verwalten
  - Sie möchten Fehler beim Laden von Plugins debuggen
title: "Plugins"
x-i18n:
  source_path: cli/plugins.md
  source_hash: c6bf76b1e766b912
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:45Z
---

# `openclaw plugins`

Gateway-Plugins/-Erweiterungen verwalten (in-process geladen).

Verwandt:

- Plugin-System: [Plugins](/plugin)
- Plugin-Manifest + Schema: [Plugin manifest](/plugins/manifest)
- Sicherheits-Härtung: [Security](/gateway/security)

## Befehle

```bash
openclaw plugins list
openclaw plugins info <id>
openclaw plugins enable <id>
openclaw plugins disable <id>
openclaw plugins doctor
openclaw plugins update <id>
openclaw plugins update --all
```

Mitgelieferte Plugins werden mit OpenClaw ausgeliefert, starten jedoch deaktiviert. Verwenden Sie `plugins enable`, um sie zu aktivieren.

Alle Plugins müssen eine `openclaw.plugin.json`-Datei mit einem Inline-JSON-Schema (`configSchema`, auch wenn leer) mitliefern. Fehlende/ungültige Manifeste oder Schemata verhindern das Laden des Plugins und lassen die Konfigurationsvalidierung fehlschlagen.

### Installieren

```bash
openclaw plugins install <path-or-spec>
```

Sicherheitshinweis: Behandeln Sie Plugin-Installationen wie das Ausführen von Code. Bevorzugen Sie angeheftete Versionen.

Unterstützte Archive: `.zip`, `.tgz`, `.tar.gz`, `.tar`.

Verwenden Sie `--link`, um das Kopieren eines lokalen Verzeichnisses zu vermeiden (fügt es zu `plugins.load.paths` hinzu):

```bash
openclaw plugins install -l ./my-plugin
```

### Aktualisieren

```bash
openclaw plugins update <id>
openclaw plugins update --all
openclaw plugins update <id> --dry-run
```

Aktualisierungen gelten nur für Plugins, die aus npm installiert wurden (verfolgt in `plugins.installs`).
