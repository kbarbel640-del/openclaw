---
summary: "Die ACP-Bridge für IDE-Integrationen ausführen"
read_when:
  - Einrichten von ACP-basierten IDE-Integrationen
  - Debugging der ACP-Sitzungsweiterleitung zum Gateway
title: "acp"
x-i18n:
  source_path: cli/acp.md
  source_hash: 0c09844297da250b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:36Z
---

# acp

Führen Sie die ACP-Bridge (Agent Client Protocol) aus, die mit einem OpenClaw Gateway kommuniziert.

Dieser Befehl spricht ACP über stdio für IDEs und leitet Prompts über WebSocket an das Gateway weiter.
Er hält ACP-Sitzungen den Gateway-Sitzungsschlüsseln zugeordnet.

## Usage

```bash
openclaw acp

# Remote Gateway
openclaw acp --url wss://gateway-host:18789 --token <token>

# Attach to an existing session key
openclaw acp --session agent:main:main

# Attach by label (must already exist)
openclaw acp --session-label "support inbox"

# Reset the session key before the first prompt
openclaw acp --session agent:main:main --reset-session
```

## ACP client (debug)

Verwenden Sie den integrierten ACP-Client, um die Bridge ohne IDE zu prüfen.
Er startet die ACP-Bridge und ermöglicht es Ihnen, Prompts interaktiv einzugeben.

```bash
openclaw acp client

# Point the spawned bridge at a remote Gateway
openclaw acp client --server-args --url wss://gateway-host:18789 --token <token>

# Override the server command (default: openclaw)
openclaw acp client --server "node" --server-args openclaw.mjs acp --url ws://127.0.0.1:19001
```

## How to use this

Verwenden Sie ACP, wenn eine IDE (oder ein anderer Client) das Agent Client Protocol spricht und
eine OpenClaw-Gateway-Sitzung steuern soll.

1. Stellen Sie sicher, dass das Gateway läuft (lokal oder remote).
2. Konfigurieren Sie das Gateway-Ziel (Konfiguration oder Flags).
3. Richten Sie Ihre IDE so ein, dass `openclaw acp` über stdio ausgeführt wird.

Beispielkonfiguration (persistiert):

```bash
openclaw config set gateway.remote.url wss://gateway-host:18789
openclaw config set gateway.remote.token <token>
```

Beispiel für direkten Aufruf (keine Konfigurationsdatei):

```bash
openclaw acp --url wss://gateway-host:18789 --token <token>
```

## Selecting agents

ACP wählt Agenten nicht direkt aus. Das Routing erfolgt über den Gateway-Sitzungsschlüssel.

Verwenden Sie agentenspezifische Sitzungsschlüssel, um einen bestimmten Agenten anzusprechen:

```bash
openclaw acp --session agent:main:main
openclaw acp --session agent:design:main
openclaw acp --session agent:qa:bug-123
```

Jede ACP-Sitzung ist einem einzelnen Gateway-Sitzungsschlüssel zugeordnet. Ein Agent kann viele
Sitzungen haben; ACP verwendet standardmäßig eine isolierte `acp:<uuid>`-Sitzung, sofern Sie
den Schlüssel oder das Label nicht überschreiben.

## Zed editor setup

Fügen Sie in `~/.config/zed/settings.json` einen benutzerdefinierten ACP-Agenten hinzu (oder verwenden Sie Zeds Einstellungs-UI):

```json
{
  "agent_servers": {
    "OpenClaw ACP": {
      "type": "custom",
      "command": "openclaw",
      "args": ["acp"],
      "env": {}
    }
  }
}
```

Um ein bestimmtes Gateway oder einen Agenten anzusprechen:

```json
{
  "agent_servers": {
    "OpenClaw ACP": {
      "type": "custom",
      "command": "openclaw",
      "args": [
        "acp",
        "--url",
        "wss://gateway-host:18789",
        "--token",
        "<token>",
        "--session",
        "agent:design:main"
      ],
      "env": {}
    }
  }
}
```

Öffnen Sie in Zed das Agent-Panel und wählen Sie „OpenClaw ACP“, um einen Thread zu starten.

## Session mapping

Standardmäßig erhalten ACP-Sitzungen einen isolierten Gateway-Sitzungsschlüssel mit einem `acp:`-Präfix.
Um eine bekannte Sitzung wiederzuverwenden, übergeben Sie einen Sitzungsschlüssel oder ein Label:

- `--session <key>`: einen bestimmten Gateway-Sitzungsschlüssel verwenden.
- `--session-label <label>`: eine bestehende Sitzung per Label auflösen.
- `--reset-session`: eine neue Sitzungs-ID für diesen Schlüssel erzeugen (gleicher Schlüssel, neues Transkript).

Wenn Ihr ACP-Client Metadaten unterstützt, können Sie dies pro Sitzung überschreiben:

```json
{
  "_meta": {
    "sessionKey": "agent:main:main",
    "sessionLabel": "support inbox",
    "resetSession": true
  }
}
```

Erfahren Sie mehr über Sitzungsschlüssel unter [/concepts/session](/concepts/session).

## Options

- `--url <url>`: Gateway-WebSocket-URL (Standard: gateway.remote.url, wenn konfiguriert).
- `--token <token>`: Gateway-Authentifizierungstoken.
- `--password <password>`: Gateway-Authentifizierungspasswort.
- `--session <key>`: Standard-Sitzungsschlüssel.
- `--session-label <label>`: Standard-Sitzungslabel zur Auflösung.
- `--require-existing`: fehlschlagen, wenn der Sitzungsschlüssel/das Label nicht existiert.
- `--reset-session`: den Sitzungsschlüssel vor der ersten Verwendung zurücksetzen.
- `--no-prefix-cwd`: Prompts nicht mit dem Arbeitsverzeichnis präfixieren.
- `--verbose, -v`: ausführliche Protokollierung nach stderr.

### `acp client` options

- `--cwd <dir>`: Arbeitsverzeichnis für die ACP-Sitzung.
- `--server <command>`: ACP-Server-Befehl (Standard: `openclaw`).
- `--server-args <args...>`: zusätzliche Argumente, die an den ACP-Server übergeben werden.
- `--server-verbose`: ausführliche Protokollierung auf dem ACP-Server aktivieren.
- `--verbose, -v`: ausführliche Client-Protokollierung.
