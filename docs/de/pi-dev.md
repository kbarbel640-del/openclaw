---
title: "Pi-Entwicklungsworkflow"
x-i18n:
  source_path: pi-dev.md
  source_hash: 65bd0580dd03df05
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:52Z
---

# Pi-Entwicklungsworkflow

Dieser Leitfaden fasst einen sinnvollen Workflow für die Arbeit an der Pi-Integration in OpenClaw zusammen.

## Typprüfung und Linting

- Typprüfung und Build: `pnpm build`
- Lint: `pnpm lint`
- Formatprüfung: `pnpm format`
- Vollständiges Gate vor dem Pushen: `pnpm lint && pnpm build && pnpm test`

## Ausführen von Pi-Tests

Verwenden Sie das dedizierte Skript für den Pi-Integrationstest-Satz:

```bash
scripts/pi/run-tests.sh
```

Um den Live-Test einzuschließen, der reales Anbieter-Verhalten ausübt:

```bash
scripts/pi/run-tests.sh --live
```

Das Skript führt alle Pi-bezogenen Unit-Tests über diese Globs aus:

- `src/agents/pi-*.test.ts`
- `src/agents/pi-embedded-*.test.ts`
- `src/agents/pi-tools*.test.ts`
- `src/agents/pi-settings.test.ts`
- `src/agents/pi-tool-definition-adapter.test.ts`
- `src/agents/pi-extensions/*.test.ts`

## Manuelles Testen

Empfohlener Ablauf:

- Gateway im Dev-Modus starten:
  - `pnpm gateway:dev`
- Den Agent direkt auslösen:
  - `pnpm openclaw agent --message "Hello" --thinking low`
- Das TUI für interaktives Debugging verwenden:
  - `pnpm tui`

Für Tool-Call-Verhalten fordern Sie eine `read`- oder `exec`-Aktion an, damit Sie Tool-Streaming und Payload-Verarbeitung sehen können.

## Zurücksetzen auf einen sauberen Zustand

Der Zustand liegt unter dem OpenClaw-Zustandsverzeichnis. Standard ist `~/.openclaw`. Wenn `OPENCLAW_STATE_DIR` gesetzt ist, verwenden Sie stattdessen dieses Verzeichnis.

Um alles zurückzusetzen:

- `openclaw.json` für Konfiguration
- `credentials/` für Auth-Profile und Tokens
- `agents/<agentId>/sessions/` für die Agent-Sitzungshistorie
- `agents/<agentId>/sessions.json` für den Sitzungsindex
- `sessions/`, falls Legacy-Pfade existieren
- `workspace/`, wenn Sie einen leeren Workspace möchten

Wenn Sie nur Sitzungen zurücksetzen möchten, löschen Sie `agents/<agentId>/sessions/` und `agents/<agentId>/sessions.json` für diesen Agent. Behalten Sie `credentials/`, wenn Sie sich nicht erneut authentifizieren möchten.

## Referenzen

- https://docs.openclaw.ai/testing
- https://docs.openclaw.ai/start/getting-started
