---
summary: "Gateway-Laufzeit auf macOS (externer launchd-Dienst)"
read_when:
  - Verpacken von OpenClaw.app
  - Debugging des macOS-Gateway-launchd-Dienstes
  - Installation der Gateway-CLI für macOS
title: "Gateway auf macOS"
x-i18n:
  source_path: platforms/mac/bundled-gateway.md
  source_hash: 4a3e963d13060b12
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:55Z
---

# Gateway auf macOS (externer launchd)

OpenClaw.app bündelt Node/Bun oder die Gateway-Laufzeit nicht mehr. Die macOS-App
erwartet eine **externe** `openclaw`-CLI-Installation, startet den Gateway nicht als
Child-Prozess und verwaltet einen benutzerspezifischen launchd-Dienst, um den Gateway
am Laufen zu halten (oder verbindet sich mit einem bestehenden lokalen Gateway, falls bereits einer läuft).

## Installation der CLI (erforderlich für den lokalen Modus)

Sie benötigen Node 22+ auf dem Mac und installieren dann `openclaw` global:

```bash
npm install -g openclaw@<version>
```

Die **Install CLI**-Schaltfläche der macOS-App führt denselben Ablauf über npm/pnpm aus (bun wird für die Gateway-Laufzeit nicht empfohlen).

## Launchd (Gateway als LaunchAgent)

Label:

- `bot.molt.gateway` (oder `bot.molt.<profile>`; veraltet: `com.openclaw.*` kann bestehen bleiben)

Plist-Speicherort (pro Benutzer):

- `~/Library/LaunchAgents/bot.molt.gateway.plist`
  (oder `~/Library/LaunchAgents/bot.molt.<profile>.plist`)

Verwaltung:

- Die macOS-App ist im lokalen Modus für die Installation/Aktualisierung des LaunchAgent zuständig.
- Die CLI kann ihn ebenfalls installieren: `openclaw gateway install`.

Verhalten:

- „OpenClaw Active“ aktiviert/deaktiviert den LaunchAgent.
- Das Beenden der App stoppt den Gateway **nicht** (launchd hält ihn am Laufen).
- Wenn bereits ein Gateway auf dem konfigurierten Port läuft, verbindet sich die App
  damit, anstatt einen neuen zu starten.

Protokollierung:

- launchd stdout/err: `/tmp/openclaw/openclaw-gateway.log`

## Versionskompatibilität

Die macOS-App prüft die Gateway-Version gegen ihre eigene Version. Wenn sie
inkompatibel sind, aktualisieren Sie die globale CLI so, dass sie zur App-Version passt.

## Smoke-Test

```bash
openclaw --version

OPENCLAW_SKIP_CHANNELS=1 \
OPENCLAW_SKIP_CANVAS_HOST=1 \
openclaw gateway --port 18999 --bind loopback
```

Dann:

```bash
openclaw gateway call health --url ws://127.0.0.1:18999 --timeout 3000
```
