---
summary: "Linux-Unterstützung + Status der Begleit-App"
read_when:
  - Sie suchen nach dem Status der Linux-Begleit-App
  - Sie planen Plattformabdeckung oder Beiträge
title: "Linux-App"
x-i18n:
  source_path: platforms/linux.md
  source_hash: 93b8250cd1267004
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:00Z
---

# Linux-App

Der Gateway wird unter Linux vollständig unterstützt. **Node ist die empfohlene Laufzeitumgebung**.
Bun wird für den Gateway nicht empfohlen (WhatsApp/Telegram-Bugs).

Native Linux-Begleit-Apps sind geplant. Beiträge sind willkommen, wenn Sie beim Aufbau helfen möchten.

## Einsteiger-Schnellpfad (VPS)

1. Installieren Sie Node 22+
2. `npm i -g openclaw@latest`
3. `openclaw onboard --install-daemon`
4. Von Ihrem Laptop aus: `ssh -N -L 18789:127.0.0.1:18789 <user>@<host>`
5. Öffnen Sie `http://127.0.0.1:18789/` und fügen Sie Ihr Token ein

Schritt-für-Schritt-VPS-Anleitung: [exe.dev](/install/exe-dev)

## Installation

- [Erste Schritte](/start/getting-started)
- [Installation & Updates](/install/updating)
- Optionale Abläufe: [Bun (experimentell)](/install/bun), [Nix](/install/nix), [Docker](/install/docker)

## Gateway

- [Gateway-Runbook](/gateway)
- [Konfiguration](/gateway/configuration)

## Gateway-Service-Installation (CLI)

Verwenden Sie eine der folgenden Optionen:

```
openclaw onboard --install-daemon
```

Oder:

```
openclaw gateway install
```

Oder:

```
openclaw configure
```

Wählen Sie bei der Aufforderung **Gateway service** aus.

Reparieren/Migrieren:

```
openclaw doctor
```

## Systemsteuerung (systemd user unit)

OpenClaw installiert standardmäßig einen systemd-**user**-Service. Verwenden Sie einen **system**-Service für gemeinsam genutzte oder dauerhaft aktive Server. Das vollständige Unit-Beispiel und Hinweise finden Sie im [Gateway-Runbook](/gateway).

Minimale Einrichtung:

Erstellen Sie `~/.config/systemd/user/openclaw-gateway[-<profile>].service`:

```
[Unit]
Description=OpenClaw Gateway (profile: <profile>, v<version>)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/openclaw gateway --port 18789
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

Aktivieren Sie ihn:

```
systemctl --user enable --now openclaw-gateway[-<profile>].service
```
