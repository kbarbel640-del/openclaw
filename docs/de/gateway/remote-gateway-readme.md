---
summary: "Einrichtung eines SSH-Tunnels für OpenClaw.app zur Verbindung mit einem Remote-Gateway"
read_when: "Verbinden der macOS-App mit einem Remote-Gateway über SSH"
title: "Einrichtung eines Remote-Gateways"
x-i18n:
  source_path: gateway/remote-gateway-readme.md
  source_hash: b1ae266a7cb4911b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:25Z
---

# Ausführen von OpenClaw.app mit einem Remote-Gateway

OpenClaw.app verwendet SSH-Tunneling, um eine Verbindung zu einem Remote-Gateway herzustellen. Diese Anleitung zeigt Ihnen, wie Sie dies einrichten.

## Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Machine                          │
│                                                              │
│  OpenClaw.app ──► ws://127.0.0.1:18789 (local port)           │
│                     │                                        │
│                     ▼                                        │
│  SSH Tunnel ────────────────────────────────────────────────│
│                     │                                        │
└─────────────────────┼──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                         Remote Machine                        │
│                                                              │
│  Gateway WebSocket ──► ws://127.0.0.1:18789 ──►              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Schnellstart

### Schritt 1: SSH-Konfiguration hinzufügen

Bearbeiten Sie `~/.ssh/config` und fügen Sie Folgendes hinzu:

```ssh
Host remote-gateway
    HostName <REMOTE_IP>          # e.g., 172.27.187.184
    User <REMOTE_USER>            # e.g., jefferson
    LocalForward 18789 127.0.0.1:18789
    IdentityFile ~/.ssh/id_rsa
```

Ersetzen Sie `<REMOTE_IP>` und `<REMOTE_USER>` durch Ihre Werte.

### Schritt 2: SSH-Schlüssel kopieren

Kopieren Sie Ihren öffentlichen Schlüssel auf die Remote-Maschine (Passwort einmal eingeben):

```bash
ssh-copy-id -i ~/.ssh/id_rsa <REMOTE_USER>@<REMOTE_IP>
```

### Schritt 3: Gateway-Token festlegen

```bash
launchctl setenv OPENCLAW_GATEWAY_TOKEN "<your-token>"
```

### Schritt 4: SSH-Tunnel starten

```bash
ssh -N remote-gateway &
```

### Schritt 5: OpenClaw.app neu starten

```bash
# Quit OpenClaw.app (⌘Q), then reopen:
open /path/to/OpenClaw.app
```

Die App verbindet sich nun über den SSH-Tunnel mit dem Remote-Gateway.

---

## Tunnel beim Anmelden automatisch starten

Damit der SSH-Tunnel beim Anmelden automatisch startet, erstellen Sie einen Launch Agent.

### PLIST-Datei erstellen

Speichern Sie dies als `~/Library/LaunchAgents/bot.molt.ssh-tunnel.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>bot.molt.ssh-tunnel</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/ssh</string>
        <string>-N</string>
        <string>remote-gateway</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

### Launch Agent laden

```bash
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/bot.molt.ssh-tunnel.plist
```

Der Tunnel wird nun:

- Automatisch beim Anmelden gestartet
- Neu gestartet, falls er abstürzt
- Im Hintergrund weiter ausgeführt

Legacy-Hinweis: Entfernen Sie ggf. vorhandene verbleibende `com.openclaw.ssh-tunnel`-LaunchAgents.

---

## Fehlerbehebung

**Prüfen, ob der Tunnel läuft:**

```bash
ps aux | grep "ssh -N remote-gateway" | grep -v grep
lsof -i :18789
```

**Tunnel neu starten:**

```bash
launchctl kickstart -k gui/$UID/bot.molt.ssh-tunnel
```

**Tunnel stoppen:**

```bash
launchctl bootout gui/$UID/bot.molt.ssh-tunnel
```

---

## So funktioniert es

| Komponente                           | Funktion                                                        |
| ------------------------------------ | --------------------------------------------------------------- |
| `LocalForward 18789 127.0.0.1:18789` | Leitet den lokalen Port 18789 an den Remote-Port 18789 weiter   |
| `ssh -N`                             | SSH ohne Ausführung von Remote-Befehlen (nur Portweiterleitung) |
| `KeepAlive`                          | Startet den Tunnel automatisch neu, wenn er abstürzt            |
| `RunAtLoad`                          | Startet den Tunnel, wenn der Agent geladen wird                 |

OpenClaw.app stellt auf Ihrem Client-Rechner eine Verbindung zu `ws://127.0.0.1:18789` her. Der SSH-Tunnel leitet diese Verbindung an Port 18789 auf der Remote-Maschine weiter, auf der das Gateway ausgeführt wird.
