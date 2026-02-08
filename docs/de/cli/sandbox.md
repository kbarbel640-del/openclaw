---
title: Sandbox-CLI
summary: „Sandbox-Container verwalten und effektive Sandbox-Richtlinien prüfen“
read_when: „Sie verwalten Sandbox-Container oder debuggen das Verhalten von Sandbox-/Tool-Richtlinien.“
status: active
x-i18n:
  source_path: cli/sandbox.md
  source_hash: 6e1186f26c77e188
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:47Z
---

# Sandbox CLI

Verwalten Sie Docker-basierte Sandbox-Container für die isolierte Agent-Ausführung.

## Overview

OpenClaw kann Agenten aus Sicherheitsgründen in isolierten Docker-Containern ausführen. Die `sandbox`-Befehle helfen Ihnen, diese Container zu verwalten, insbesondere nach Updates oder Konfigurationsänderungen.

## Commands

### `openclaw sandbox explain`

Prüfen Sie den **effektiven** Sandbox-Modus/-Scope/-Workspace-Zugriff, die Sandbox-Tool-Richtlinie sowie erhöhte Gates (mit Fix-it-Konfigurationsschlüsselpfaden).

```bash
openclaw sandbox explain
openclaw sandbox explain --session agent:main:main
openclaw sandbox explain --agent work
openclaw sandbox explain --json
```

### `openclaw sandbox list`

Listen Sie alle Sandbox-Container mit ihrem Status und ihrer Konfiguration auf.

```bash
openclaw sandbox list
openclaw sandbox list --browser  # List only browser containers
openclaw sandbox list --json     # JSON output
```

**Die Ausgabe umfasst:**

- Containername und Status (running/stopped)
- Docker-Image und ob es der Konfiguration entspricht
- Alter (Zeit seit Erstellung)
- Idle-Zeit (Zeit seit letzter Nutzung)
- Zugeordnete Sitzung/Agent

### `openclaw sandbox recreate`

Entfernen Sie Sandbox-Container, um eine Neuerstellung mit aktualisierten Images/Konfigurationen zu erzwingen.

```bash
openclaw sandbox recreate --all                # Recreate all containers
openclaw sandbox recreate --session main       # Specific session
openclaw sandbox recreate --agent mybot        # Specific agent
openclaw sandbox recreate --browser            # Only browser containers
openclaw sandbox recreate --all --force        # Skip confirmation
```

**Optionen:**

- `--all`: Alle Sandbox-Container neu erstellen
- `--session <key>`: Container für eine bestimmte Sitzung neu erstellen
- `--agent <id>`: Container für einen bestimmten Agenten neu erstellen
- `--browser`: Nur Browser-Container neu erstellen
- `--force`: Bestätigungsabfrage überspringen

**Wichtig:** Container werden automatisch neu erstellt, wenn der Agent das nächste Mal verwendet wird.

## Use Cases

### Nach dem Aktualisieren von Docker-Images

```bash
# Pull new image
docker pull openclaw-sandbox:latest
docker tag openclaw-sandbox:latest openclaw-sandbox:bookworm-slim

# Update config to use new image
# Edit config: agents.defaults.sandbox.docker.image (or agents.list[].sandbox.docker.image)

# Recreate containers
openclaw sandbox recreate --all
```

### Nach dem Ändern der Sandbox-Konfiguration

```bash
# Edit config: agents.defaults.sandbox.* (or agents.list[].sandbox.*)

# Recreate to apply new config
openclaw sandbox recreate --all
```

### Nach dem Ändern von setupCommand

```bash
openclaw sandbox recreate --all
# or just one agent:
openclaw sandbox recreate --agent family
```

### Nur für einen bestimmten Agenten

```bash
# Update only one agent's containers
openclaw sandbox recreate --agent alfred
```

## Why is this needed?

**Problem:** Wenn Sie Sandbox-Docker-Images oder die Konfiguration aktualisieren:

- Bestehende Container laufen mit alten Einstellungen weiter
- Container werden erst nach 24 h Inaktivität bereinigt
- Regelmäßig verwendete Agenten behalten alte Container unbegrenzt bei

**Lösung:** Verwenden Sie `openclaw sandbox recreate`, um das Entfernen alter Container zu erzwingen. Sie werden automatisch mit den aktuellen Einstellungen neu erstellt, sobald sie wieder benötigt werden.

Tipp: Bevorzugen Sie `openclaw sandbox recreate` gegenüber manuellem `docker rm`. Es nutzt die Container-Benennung des Gateway und vermeidet Abweichungen, wenn sich Scope-/Sitzungsschlüssel ändern.

## Configuration

Sandbox-Einstellungen befinden sich in `~/.openclaw/openclaw.json` unter `agents.defaults.sandbox` (Agent-spezifische Überschreibungen kommen in `agents.list[].sandbox`):

```jsonc
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "all", // off, non-main, all
        "scope": "agent", // session, agent, shared
        "docker": {
          "image": "openclaw-sandbox:bookworm-slim",
          "containerPrefix": "openclaw-sbx-",
          // ... more Docker options
        },
        "prune": {
          "idleHours": 24, // Auto-prune after 24h idle
          "maxAgeDays": 7, // Auto-prune after 7 days
        },
      },
    },
  },
}
```

## See Also

- [Sandbox Documentation](/gateway/sandboxing)
- [Agent Configuration](/concepts/agent-workspace)
- [Doctor Command](/gateway/doctor) – Sandbox-Einrichtung prüfen
