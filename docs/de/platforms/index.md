---
summary: "Übersicht zur Plattformunterstützung (Gateway + Begleit-Apps)"
read_when:
  - Auf der Suche nach Betriebssystemunterstützung oder Installationspfaden
  - Entscheidung, wo das Gateway betrieben werden soll
title: "Plattformen"
x-i18n:
  source_path: platforms/index.md
  source_hash: 959479995f9ecca3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:54Z
---

# Plattformen

Der OpenClaw-Kern ist in TypeScript geschrieben. **Node ist die empfohlene Runtime**.
Bun wird für das Gateway nicht empfohlen (WhatsApp-/Telegram-Bugs).

Begleit-Apps gibt es für macOS (Menüleisten-App) und mobile Knoten (iOS/Android). Windows- und
Linux-Begleit-Apps sind geplant, das Gateway wird jedoch bereits heute vollständig unterstützt.
Native Begleit-Apps für Windows sind ebenfalls geplant; das Gateway wird über WSL2 empfohlen.

## Wählen Sie Ihr Betriebssystem

- macOS: [macOS](/platforms/macos)
- iOS: [iOS](/platforms/ios)
- Android: [Android](/platforms/android)
- Windows: [Windows](/platforms/windows)
- Linux: [Linux](/platforms/linux)

## VPS & Hosting

- VPS-Hub: [VPS hosting](/vps)
- Fly.io: [Fly.io](/install/fly)
- Hetzner (Docker): [Hetzner](/install/hetzner)
- GCP (Compute Engine): [GCP](/install/gcp)
- exe.dev (VM + HTTPS-Proxy): [exe.dev](/install/exe-dev)

## Häufige Links

- Installationsanleitung: [Erste Schritte](/start/getting-started)
- Gateway-Runbook: [Gateway](/gateway)
- Gateway-Konfiguration: [Configuration](/gateway/configuration)
- Servicestatus: `openclaw gateway status`

## Gateway-Service installieren (CLI)

Verwenden Sie eine der folgenden Optionen (alle unterstützt):

- Assistent (empfohlen): `openclaw onboard --install-daemon`
- Direkt: `openclaw gateway install`
- Konfigurationsfluss: `openclaw configure` → **Gateway service** auswählen
- Reparieren/Migrieren: `openclaw doctor` (bietet an, den Service zu installieren oder zu reparieren)

Das Service-Ziel hängt vom Betriebssystem ab:

- macOS: LaunchAgent (`bot.molt.gateway` oder `bot.molt.<profile>`; Legacy `com.openclaw.*`)
- Linux/WSL2: systemd-Benutzerservice (`openclaw-gateway[-<profile>].service`)
