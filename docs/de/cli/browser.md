---
summary: "CLI-Referenz für `openclaw browser` (Profile, Tabs, Aktionen, Extension-Relay)"
read_when:
  - Sie verwenden `openclaw browser` und möchten Beispiele für häufige Aufgaben
  - Sie möchten einen auf einer anderen Maschine laufenden Browser über einen Node-Host steuern
  - Sie möchten das Chrome-Extension-Relay verwenden (Anhängen/Trennen über die Toolbar-Schaltfläche)
title: "browser"
x-i18n:
  source_path: cli/browser.md
  source_hash: af35adfd68726fd5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:33Z
---

# `openclaw browser`

Verwalten Sie den Browser-Steuerungsserver von OpenClaw und führen Sie Browser-Aktionen aus (Tabs, Snapshots, Screenshots, Navigation, Klicks, Tippen).

Zugehörig:

- Browser-Werkzeug + API: [Browser tool](/tools/browser)
- Chrome-Extension-Relay: [Chrome extension](/tools/chrome-extension)

## Häufige Flags

- `--url <gatewayWsUrl>`: Gateway-WebSocket-URL (Standard aus der Konfiguration).
- `--token <token>`: Gateway-Token (falls erforderlich).
- `--timeout <ms>`: Request-Timeout (ms).
- `--browser-profile <name>`: Browser-Profil auswählen (Standard aus der Konfiguration).
- `--json`: maschinenlesbare Ausgabe (wo unterstützt).

## Schnellstart (lokal)

```bash
openclaw browser --browser-profile chrome tabs
openclaw browser --browser-profile openclaw start
openclaw browser --browser-profile openclaw open https://example.com
openclaw browser --browser-profile openclaw snapshot
```

## Profile

Profile sind benannte Browser-Routing-Konfigurationen. In der Praxis:

- `openclaw`: startet/verbinden sich mit einer dedizierten, von OpenClaw verwalteten Chrome-Instanz (isoliertes User-Data-Verzeichnis).
- `chrome`: steuert Ihre bestehenden Chrome-Tabs über das Chrome-Extension-Relay.

```bash
openclaw browser profiles
openclaw browser create-profile --name work --color "#FF5A36"
openclaw browser delete-profile --name work
```

Ein bestimmtes Profil verwenden:

```bash
openclaw browser --browser-profile work tabs
```

## Tabs

```bash
openclaw browser tabs
openclaw browser open https://docs.openclaw.ai
openclaw browser focus <targetId>
openclaw browser close <targetId>
```

## Snapshot / Screenshot / Aktionen

Snapshot:

```bash
openclaw browser snapshot
```

Screenshot:

```bash
openclaw browser screenshot
```

Navigieren/Klicken/Tippen (ref-basierte UI-Automatisierung):

```bash
openclaw browser navigate https://example.com
openclaw browser click <ref>
openclaw browser type <ref> "hello"
```

## Chrome-Extension-Relay (Anhängen über Toolbar-Schaltfläche)

Dieser Modus ermöglicht es dem Agenten, einen bestehenden Chrome-Tab zu steuern, den Sie manuell anhängen (kein automatisches Anhängen).

Installieren Sie die entpackte Extension in einen stabilen Pfad:

```bash
openclaw browser extension install
openclaw browser extension path
```

Dann Chrome → `chrome://extensions` → „Developer mode“ aktivieren → „Load unpacked“ → den ausgegebenen Ordner auswählen.

Vollständige Anleitung: [Chrome extension](/tools/chrome-extension)

## Remote-Browser-Steuerung (Node-Host-Proxy)

Wenn das Gateway auf einer anderen Maschine als der Browser läuft, starten Sie einen **Node-Host** auf der Maschine mit Chrome/Brave/Edge/Chromium. Das Gateway leitet Browser-Aktionen an diesen Node weiter (kein separater Browser-Steuerungsserver erforderlich).

Verwenden Sie `gateway.nodes.browser.mode`, um das Auto-Routing zu steuern, und `gateway.nodes.browser.node`, um einen bestimmten Node festzulegen, wenn mehrere verbunden sind.

Sicherheit + Remote-Einrichtung: [Browser tool](/tools/browser), [Remote access](/gateway/remote), [Tailscale](/gateway/tailscale), [Security](/gateway/security)
