---
summary: "CLI-Referenz für `openclaw update` (sicheres Quell-Update + automatischer Gateway-Neustart)"
read_when:
  - Sie möchten einen Source-Checkout sicher aktualisieren
  - Sie müssen das Kurzschreibverhalten von `--update` verstehen
title: "update"
x-i18n:
  source_path: cli/update.md
  source_hash: 3a08e8ac797612c4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:54Z
---

# `openclaw update`

OpenClaw sicher aktualisieren und zwischen den Kanälen stable/beta/dev wechseln.

Wenn Sie über **npm/pnpm** installiert haben (globale Installation, keine Git-Metadaten), erfolgen Updates über den Paketmanager-Ablauf in [Updating](/install/updating).

## Usage

```bash
openclaw update
openclaw update status
openclaw update wizard
openclaw update --channel beta
openclaw update --channel dev
openclaw update --tag beta
openclaw update --no-restart
openclaw update --json
openclaw --update
```

## Options

- `--no-restart`: überspringt den Neustart des Gateway-Dienstes nach einer erfolgreichen Aktualisierung.
- `--channel <stable|beta|dev>`: legt den Update-Kanal fest (git + npm; in der Konfiguration gespeichert).
- `--tag <dist-tag|version>`: überschreibt den npm dist-tag oder die Version nur für dieses Update.
- `--json`: gibt maschinenlesbares `UpdateRunResult`-JSON aus.
- `--timeout <seconds>`: Zeitlimit pro Schritt (Standard ist 1200s).

Hinweis: Downgrades erfordern eine Bestätigung, da ältere Versionen die Konfiguration beeinträchtigen können.

## `update status`

Zeigt den aktiven Update-Kanal sowie Git-Tag/Branch/SHA (bei Source-Checkouts) und die Update-Verfügbarkeit an.

```bash
openclaw update status
openclaw update status --json
openclaw update status --timeout 10
```

Options:

- `--json`: gibt maschinenlesbares Status-JSON aus.
- `--timeout <seconds>`: Zeitlimit für Prüfungen (Standard ist 3s).

## `update wizard`

Interaktiver Ablauf zur Auswahl eines Update-Kanals und zur Bestätigung, ob das Gateway
nach dem Update neu gestartet werden soll (Standard ist Neustart). Wenn Sie `dev` ohne Git-Checkout auswählen, wird angeboten, einen zu erstellen.

## What it does

Wenn Sie explizit den Kanal wechseln (`--channel ...`), hält OpenClaw auch die
Installationsmethode konsistent:

- `dev` → stellt einen Git-Checkout sicher (Standard: `~/openclaw`, Überschreiben mit `OPENCLAW_GIT_DIR`),
  aktualisiert ihn und installiert die globale CLI aus diesem Checkout.
- `stable`/`beta` → installiert aus npm mit dem passenden dist-tag.

## Git checkout flow

Kanäle:

- `stable`: checkt den neuesten Nicht-Beta-Tag aus, danach Build + Doctor.
- `beta`: checkt den neuesten `-beta`-Tag aus, danach Build + Doctor.
- `dev`: checkt `main` aus, danach Fetch + Rebase.

High-level:

1. Erfordert einen sauberen Worktree (keine nicht committeten Änderungen).
2. Wechselt zum ausgewählten Kanal (Tag oder Branch).
3. Holt Upstream-Änderungen (nur dev).
4. Nur dev: Preflight-Lint + TypeScript-Build in einem temporären Worktree; schlägt der Tip fehl, wird bis zu 10 Commits zurückgegangen, um den neuesten sauberen Build zu finden.
5. Rebased auf den ausgewählten Commit (nur dev).
6. Installiert Abhängigkeiten (pnpm bevorzugt; npm als Fallback).
7. Baut und baut die Control UI.
8. Führt `openclaw doctor` als abschließende „sichere Update“-Prüfung aus.
9. Synchronisiert Plugins mit dem aktiven Kanal (dev verwendet gebündelte Erweiterungen; stable/beta verwendet npm) und aktualisiert npm-installierte Plugins.

## `--update` shorthand

`openclaw --update` wird zu `openclaw update` umgeschrieben (nützlich für Shells und Launcher-Skripte).

## See also

- `openclaw doctor` (bietet an, bei Git-Checkouts zuerst ein Update auszuführen)
- [Development channels](/install/development-channels)
- [Updating](/install/updating)
- [CLI reference](/cli)
