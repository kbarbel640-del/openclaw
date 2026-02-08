---
summary: "OpenProse: .prose-Workflows, Slash-Befehle und Zustand in OpenClaw"
read_when:
  - Sie moechten .prose-Workflows ausfuehren oder schreiben
  - Sie moechten das OpenProse-Plugin aktivieren
  - Sie muessen die Zustandspeicherung verstehen
title: "OpenProse"
x-i18n:
  source_path: prose.md
  source_hash: cf7301e927b9a463
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:13Z
---

# OpenProse

OpenProse ist ein portables, Markdown-first-Workflowformat zur Orchestrierung von KI-Sitzungen. In OpenClaw wird es als Plugin ausgeliefert, das ein OpenProse-Skill-Paket sowie einen `/prose`-Slash-Befehl installiert. Programme liegen in `.prose`-Dateien und koennen mehrere Sub-Agenten mit explizitem Kontrollfluss starten.

Offizielle Website: https://www.prose.md

## Was es kann

- Multi-Agenten-Recherche und -Synthese mit expliziter Parallelitaet.
- Wiederholbare, freigabesichere Workflows (Code-Review, Incident-Triage, Content-Pipelines).
- Wiederverwendbare `.prose`-Programme, die Sie ueber unterstuetzte Agent-Runtimes hinweg ausfuehren koennen.

## Installieren + aktivieren

Gebundelte Plugins sind standardmaessig deaktiviert. Aktivieren Sie OpenProse:

```bash
openclaw plugins enable open-prose
```

Starten Sie das Gateway nach dem Aktivieren des Plugins neu.

Dev-/lokaler Checkout: `openclaw plugins install ./extensions/open-prose`

Zugehoerige Dokumente: [Plugins](/plugin), [Plugin-Manifest](/plugins/manifest), [Skills](/tools/skills).

## Slash-Befehl

OpenProse registriert `/prose` als vom Benutzer aufrufbaren Skill-Befehl. Er leitet an die OpenProse-VM-Anweisungen weiter und nutzt unter der Haube OpenClaw-Werkzeuge.

Gaengige Befehle:

```
/prose help
/prose run <file.prose>
/prose run <handle/slug>
/prose run <https://example.com/file.prose>
/prose compile <file.prose>
/prose examples
/prose update
```

## Beispiel: eine einfache `.prose`-Datei

```prose
# Research + synthesis with two agents running in parallel.

input topic: "What should we research?"

agent researcher:
  model: sonnet
  prompt: "You research thoroughly and cite sources."

agent writer:
  model: opus
  prompt: "You write a concise summary."

parallel:
  findings = session: researcher
    prompt: "Research {topic}."
  draft = session: writer
    prompt: "Summarize {topic}."

session "Merge the findings + draft into a final answer."
context: { findings, draft }
```

## Dateiablagen

OpenProse speichert den Zustand unter `.prose/` in Ihrem Workspace:

```
.prose/
├── .env
├── runs/
│   └── {YYYYMMDD}-{HHMMSS}-{random}/
│       ├── program.prose
│       ├── state.md
│       ├── bindings/
│       └── agents/
└── agents/
```

Persistente Agenten auf Benutzerebene befinden sich unter:

```
~/.prose/agents/
```

## Zustandsmodi

OpenProse unterstuetzt mehrere Zustands-Backends:

- **filesystem** (Standard): `.prose/runs/...`
- **in-context**: temporaer, fuer kleine Programme
- **sqlite** (experimentell): erfordert die `sqlite3`-Binary
- **postgres** (experimentell): erfordert `psql` und eine Verbindungszeichenfolge

Hinweise:

- sqlite/postgres sind optional und experimentell.
- Postgres-Zugangsdaten fliessen in Sub-Agenten-Logs; verwenden Sie eine dedizierte DB mit minimalen Rechten.

## Remote-Programme

`/prose run <handle/slug>` wird zu `https://p.prose.md/<handle>/<slug>` aufgeloest.
Direkte URLs werden unveraendert abgerufen. Dies verwendet das `web_fetch`-Werkzeug (oder `exec` fuer POST).

## OpenClaw-Runtime-Zuordnung

OpenProse-Programme werden OpenClaw-Primitiven zugeordnet:

| OpenProse-Konzept               | OpenClaw-Werkzeug |
| ------------------------------- | ----------------- |
| Sitzung starten / Task-Werkzeug | `sessions_spawn`  |
| Datei lesen/schreiben           | `read` / `write`  |
| Web-Abruf                       | `web_fetch`       |

Wenn Ihre Tool-Allowlist diese Werkzeuge blockiert, schlagen OpenProse-Programme fehl. Siehe [Skills-Konfiguration](/tools/skills-config).

## Sicherheit + Freigaben

Behandeln Sie `.prose`-Dateien wie Code. Pruefen Sie sie vor der Ausfuehrung. Verwenden Sie OpenClaw-Tool-Allowlists und Freigabe-Gates, um Seiteneffekte zu kontrollieren.

Fuer deterministische, freigabegesteuerte Workflows vergleichen Sie mit [Lobster](/tools/lobster).
