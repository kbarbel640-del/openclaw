---
title: "Node.js + npm (PATH‑Überprüfung)"
summary: "Node.js + npm‑Installationsprüfung: Versionen, PATH und globale Installationen"
read_when:
  - "Sie haben OpenClaw installiert, aber `openclaw` ist „command not found“"
  - "Sie richten Node.js/npm auf einem neuen Rechner ein"
  - "`npm install -g ...` schlägt mit Berechtigungs‑ oder PATH‑Problemen fehl"
x-i18n:
  source_path: install/node.md
  source_hash: 9f6d83be362e3e14
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:44Z
---

# Node.js + npm (PATH‑Überprüfung)

Die Laufzeit‑Basis von OpenClaw ist **Node 22+**.

Wenn Sie `npm install -g openclaw@latest` ausführen können, später aber `openclaw: command not found` sehen, ist es fast immer ein **PATH**‑Problem: Das Verzeichnis, in dem npm globale Binaries ablegt, befindet sich nicht im PATH Ihrer Shell.

## Schnelle Diagnose

Führen Sie aus:

```bash
node -v
npm -v
npm prefix -g
echo "$PATH"
```

Wenn `$(npm prefix -g)/bin` (macOS/Linux) oder `$(npm prefix -g)` (Windows) **nicht** innerhalb von `echo "$PATH"` vorhanden ist, kann Ihre Shell globale npm‑Binaries (einschließlich `openclaw`) nicht finden.

## Fix: globales npm‑Bin‑Verzeichnis zum PATH hinzufügen

1. Ermitteln Sie Ihr globales npm‑Prefix:

```bash
npm prefix -g
```

2. Fügen Sie das globale npm‑Bin‑Verzeichnis Ihrer Shell‑Startdatei hinzu:

- zsh: `~/.zshrc`
- bash: `~/.bashrc`

Beispiel (ersetzen Sie den Pfad durch die Ausgabe von `npm prefix -g`):

```bash
# macOS / Linux
export PATH="/path/from/npm/prefix/bin:$PATH"
```

Öffnen Sie anschließend ein **neues Terminal** (oder führen Sie `rehash` in zsh / `hash -r` in bash aus).

Unter Windows fügen Sie die Ausgabe von `npm prefix -g` zu Ihrem PATH hinzu.

## Fix: `sudo npm install -g`‑/Berechtigungsfehler vermeiden (Linux)

Wenn `npm install -g ...` mit `EACCES` fehlschlägt, stellen Sie das globale npm‑Prefix auf ein für den Benutzer beschreibbares Verzeichnis um:

```bash
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
```

Persistieren Sie die Zeile `export PATH=...` in Ihrer Shell‑Startdatei.

## Empfohlene Node‑Installationsoptionen

Sie haben die wenigsten Überraschungen, wenn Node/npm so installiert sind, dass:

- Node aktuell bleibt (22+)
- das globale npm‑Bin‑Verzeichnis stabil ist und in neuen Shells im PATH liegt

Gängige Optionen:

- macOS: Homebrew (`brew install node`) oder ein Versionsmanager
- Linux: Ihr bevorzugter Versionsmanager oder eine distributionsunterstützte Installation, die Node 22+ bereitstellt
- Windows: offizieller Node‑Installer, `winget`, oder ein Windows‑Node‑Versionsmanager

Wenn Sie einen Versionsmanager (nvm/fnm/asdf/etc.) verwenden, stellen Sie sicher, dass er in der Shell initialisiert wird, die Sie täglich nutzen (zsh vs. bash), damit der gesetzte PATH beim Ausführen von Installern vorhanden ist.
