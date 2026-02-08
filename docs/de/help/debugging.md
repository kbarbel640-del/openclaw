---
summary: "Debugging-Werkzeuge: Watch-Modus, rohe Modell-Streams und Nachverfolgung von Reasoning-Leakage"
read_when:
  - Sie muessen rohe Modellausgaben auf Reasoning-Leakage untersuchen
  - Sie moechten den Gateway im Watch-Modus waehrend der Iteration ausfuehren
  - Sie benoetigen einen reproduzierbaren Debugging-Workflow
title: "Debugging"
x-i18n:
  source_path: help/debugging.md
  source_hash: 504c824bff479000
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:55Z
---

# Debugging

Diese Seite behandelt Debugging-Hilfen fuer Streaming-Ausgaben, insbesondere wenn ein
Anbieter Reasoning mit normalem Text vermischt.

## Laufzeit-Debug-Overrides

Verwenden Sie `/debug` im Chat, um **nur zur Laufzeit** Konfigurations-Overrides zu setzen (Speicher, nicht Festplatte).
`/debug` ist standardmaessig deaktiviert; aktivieren Sie es mit `commands.debug: true`.
Das ist praktisch, wenn Sie seltene Einstellungen umschalten muessen, ohne `openclaw.json` zu bearbeiten.

Beispiele:

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug unset messages.responsePrefix
/debug reset
```

`/debug reset` entfernt alle Overrides und kehrt zur Konfiguration auf dem Datentraeger zurueck.

## Gateway-Watch-Modus

Fuer schnelle Iteration starten Sie den Gateway unter dem Datei-Watcher:

```bash
pnpm gateway:watch --force
```

Dies entspricht:

```bash
tsx watch src/entry.ts gateway --force
```

Fuegen Sie beliebige Gateway-CLI-Flags nach `gateway:watch` hinzu; sie werden bei
jedem Neustart weitergereicht.

## Dev-Profil + Dev-Gateway (--dev)

Verwenden Sie das Dev-Profil, um den Zustand zu isolieren und eine sichere, wegwerfbare
Debugging-Umgebung zu starten. Es gibt **zwei** `--dev`-Flags:

- **Globales `--dev` (Profil):** isoliert den Zustand unter `~/.openclaw-dev` und
  setzt den Gateway-Port standardmaessig auf `19001` (abgeleitete Ports verschieben sich entsprechend).
- **`gateway --dev`: weist den Gateway an, automatisch eine Standardkonfiguration +
  einen Workspace zu erstellen**, falls fehlend (und BOOTSTRAP.md zu ueberspringen).

Empfohlener Ablauf (Dev-Profil + Dev-Bootstrap):

```bash
pnpm gateway:dev
OPENCLAW_PROFILE=dev openclaw tui
```

Falls Sie noch keine globale Installation haben, fuehren Sie die CLI ueber `pnpm openclaw ...` aus.

Was das bewirkt:

1. **Profil-Isolation** (globales `--dev`)
   - `OPENCLAW_PROFILE=dev`
   - `OPENCLAW_STATE_DIR=~/.openclaw-dev`
   - `OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json`
   - `OPENCLAW_GATEWAY_PORT=19001` (Browser/Canvas verschieben sich entsprechend)

2. **Dev-Bootstrap** (`gateway --dev`)
   - Schreibt bei Bedarf eine minimale Konfiguration (`gateway.mode=local`, Bindung an Loopback).
   - Setzt `agent.workspace` auf den Dev-Workspace.
   - Setzt `agent.skipBootstrap=true` (kein BOOTSTRAP.md).
   - Seedet die Workspace-Dateien, falls fehlend:
     `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`.
   - Standardidentitaet: **C3‑PO** (Protocol-Droid).
   - Ueberspringt Kanal-Anbieter im Dev-Modus (`OPENCLAW_SKIP_CHANNELS=1`).

Reset-Ablauf (Neustart von Grund auf):

```bash
pnpm gateway:dev:reset
```

Hinweis: `--dev` ist ein **globales** Profil-Flag und wird von einigen Runnern verschluckt.
Wenn Sie es explizit angeben muessen, verwenden Sie die Env-Var-Form:

```bash
OPENCLAW_PROFILE=dev openclaw gateway --dev --reset
```

`--reset` loescht Konfiguration, Zugangsdaten, Sitzungen und den Dev-Workspace (unter Verwendung von
`trash`, nicht `rm`), und erstellt anschliessend das Standard-Dev-Setup neu.

Tipp: Wenn bereits ein Nicht-Dev-Gateway laeuft (launchd/systemd), stoppen Sie ihn zuerst:

```bash
openclaw gateway stop
```

## Rohes Stream-Logging (OpenClaw)

OpenClaw kann den **rohen Assistant-Stream** vor jeglicher Filterung/Formatierung protokollieren.
Dies ist der beste Weg, um zu sehen, ob Reasoning als reine Text-Deltas ankommt
(oder als separate Thinking-Bloecke).

Aktivieren Sie es ueber die CLI:

```bash
pnpm gateway:watch --force --raw-stream
```

Optionale Pfad-Ueberschreibung:

```bash
pnpm gateway:watch --force --raw-stream --raw-stream-path ~/.openclaw/logs/raw-stream.jsonl
```

Entsprechende Env-Vars:

```bash
OPENCLAW_RAW_STREAM=1
OPENCLAW_RAW_STREAM_PATH=~/.openclaw/logs/raw-stream.jsonl
```

Standarddatei:

`~/.openclaw/logs/raw-stream.jsonl`

## Rohes Chunk-Logging (pi-mono)

Um **rohe OpenAI-kompatible Chunks** zu erfassen, bevor sie in Bloecke geparst werden,
stellt pi-mono einen separaten Logger bereit:

```bash
PI_RAW_STREAM=1
```

Optionaler Pfad:

```bash
PI_RAW_STREAM_PATH=~/.pi-mono/logs/raw-openai-completions.jsonl
```

Standarddatei:

`~/.pi-mono/logs/raw-openai-completions.jsonl`

> Hinweis: Dies wird nur von Prozessen ausgegeben, die den
> `openai-completions`-Anbieter von pi-mono verwenden.

## Sicherheitshinweise

- Rohe Stream-Logs koennen vollstaendige Prompts, Werkzeugausgaben und Nutzerdaten enthalten.
- Bewahren Sie Logs lokal auf und loeschen Sie sie nach dem Debugging.
- Wenn Sie Logs teilen, entfernen Sie zuvor Geheimnisse und personenbezogene Daten (PII).
