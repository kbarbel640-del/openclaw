---
summary: "CLI-Referenz fuer `openclaw nodes` (list/status/approve/invoke, camera/canvas/screen)"
read_when:
  - Sie verwalten gekoppelte Nodes (Kameras, Bildschirm, Canvas)
  - Sie muessen Anfragen genehmigen oder Node-Befehle ausfuehren
title: "Nodes"
x-i18n:
  source_path: cli/nodes.md
  source_hash: 23da6efdd659a82d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:47Z
---

# `openclaw nodes`

Verwalten Sie gekoppelte Nodes (Geraete) und rufen Sie Node-Faehigkeiten auf.

Verwandt:

- Nodes-Ueberblick: [Nodes](/nodes)
- Kamera: [Camera nodes](/nodes/camera)
- Bilder: [Image nodes](/nodes/images)

Gemeinsame Optionen:

- `--url`, `--token`, `--timeout`, `--json`

## Gemeinsame Befehle

```bash
openclaw nodes list
openclaw nodes list --connected
openclaw nodes list --last-connected 24h
openclaw nodes pending
openclaw nodes approve <requestId>
openclaw nodes status
openclaw nodes status --connected
openclaw nodes status --last-connected 24h
```

`nodes list` gibt Tabellen fuer ausstehende/gekoppelte Nodes aus. Gekoppelte Zeilen enthalten das Alter der letzten Verbindung (Last Connect).
Verwenden Sie `--connected`, um nur aktuell verbundene Nodes anzuzeigen. Verwenden Sie `--last-connected <duration>`, um
auf Nodes zu filtern, die sich innerhalb einer Dauer verbunden haben (z. B. `24h`, `7d`).

## Invoke / ausfuehren

```bash
openclaw nodes invoke --node <id|name|ip> --command <command> --params <json>
openclaw nodes run --node <id|name|ip> <command...>
openclaw nodes run --raw "git status"
openclaw nodes run --agent main --node <id|name|ip> --raw "git status"
```

Invoke-Flags:

- `--params <json>`: JSON-Objektzeichenfolge (Standard `{}`).
- `--invoke-timeout <ms>`: Timeout fuer Node-Invoke (Standard `15000`).
- `--idempotency-key <key>`: optionaler Idempotenzschluessel.

### Exec-Style-Standards

`nodes run` spiegelt das Exec-Verhalten des Modells wider (Standards + Genehmigungen):

- Liest `tools.exec.*` (plus `agents.list[].tools.exec.*`-Ueberschreibungen).
- Verwendet Exec-Genehmigungen (`exec.approval.request`), bevor `system.run` aufgerufen wird.
- `--node` kann entfallen, wenn `tools.exec.node` gesetzt ist.
- Erfordert einen Node, der `system.run` anbietet (macOS-Begleit-App oder headless Node-Host).

Flags:

- `--cwd <path>`: Arbeitsverzeichnis.
- `--env <key=val>`: Env-Ueberschreibung (wiederholbar).
- `--command-timeout <ms>`: Befehls-Timeout.
- `--invoke-timeout <ms>`: Timeout fuer Node-Invoke (Standard `30000`).
- `--needs-screen-recording`: Bildschirmaufzeichnungsberechtigung erforderlich.
- `--raw <command>`: Eine Shell-Zeichenfolge ausfuehren (`/bin/sh -lc` oder `cmd.exe /c`).
- `--agent <id>`: Agent-gebundene Genehmigungen/Allowlists (Standard: konfigurierter Agent).
- `--ask <off|on-miss|always>`, `--security <deny|allowlist|full>`: Ueberschreibungen.
