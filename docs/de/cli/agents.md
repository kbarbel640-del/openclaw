---
summary: "CLI-Referenz für `openclaw agents` (auflisten/hinzufügen/löschen/Identität festlegen)"
read_when:
  - Sie möchten mehrere isolierte Agenten (Arbeitsbereiche + Routing + Authentifizierung)
title: "Agenten"
x-i18n:
  source_path: cli/agents.md
  source_hash: 30556d81636a9ad8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:33Z
---

# `openclaw agents`

Verwalten Sie isolierte Agenten (Arbeitsbereiche + Authentifizierung + Routing).

Verwandt:

- Multi-Agent-Routing: [Multi-Agent Routing](/concepts/multi-agent)
- Agenten-Arbeitsbereich: [Agent workspace](/concepts/agent-workspace)

## Beispiele

```bash
openclaw agents list
openclaw agents add work --workspace ~/.openclaw/workspace-work
openclaw agents set-identity --workspace ~/.openclaw/workspace --from-identity
openclaw agents set-identity --agent main --avatar avatars/openclaw.png
openclaw agents delete work
```

## Identitätsdateien

Jeder Agenten-Arbeitsbereich kann eine `IDENTITY.md` im Stammverzeichnis des Arbeitsbereichs enthalten:

- Beispielpfad: `~/.openclaw/workspace/IDENTITY.md`
- `set-identity --from-identity` liest aus dem Stammverzeichnis des Arbeitsbereichs (oder einer expliziten `--identity-file`)

Avatar-Pfade werden relativ zum Stammverzeichnis des Arbeitsbereichs aufgelöst.

## Identität festlegen

`set-identity` schreibt Felder in `agents.list[].identity`:

- `name`
- `theme`
- `emoji`
- `avatar` (arbeitsbereichsrelativer Pfad, http(s)-URL oder Data-URI)

Laden aus `IDENTITY.md`:

```bash
openclaw agents set-identity --workspace ~/.openclaw/workspace --from-identity
```

Felder explizit überschreiben:

```bash
openclaw agents set-identity --agent main --name "OpenClaw" --emoji "🦞" --avatar avatars/openclaw.png
```

Konfigurationsbeispiel:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "OpenClaw",
          theme: "space lobster",
          emoji: "🦞",
          avatar: "avatars/openclaw.png",
        },
      },
    ],
  },
}
```
