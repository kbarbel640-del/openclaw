---
summary: "Windows-(WSL2)-Unterstützung + Status der Begleit-App"
read_when:
  - Installation von OpenClaw unter Windows
  - Suche nach dem Status der Windows-Begleit-App
title: "Windows (WSL2)"
x-i18n:
  source_path: platforms/windows.md
  source_hash: c93d2263b4e5b60c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:08Z
---

# Windows (WSL2)

OpenClaw unter Windows wird **über WSL2** empfohlen (Ubuntu empfohlen). Die
CLI + das Gateway laufen innerhalb von Linux, was die Laufzeitumgebung konsistent hält und
Werkzeuge deutlich kompatibler macht (Node/Bun/pnpm, Linux-Binärdateien, Skills).
Natives Windows kann schwieriger sein. WSL2 bietet Ihnen das vollständige Linux-Erlebnis —
ein Befehl zur Installation: `wsl --install`.

Native Windows-Begleit-Apps sind geplant.

## Installieren (WSL2)

- [Erste Schritte](/start/getting-started) (innerhalb von WSL verwenden)
- [Installation & Updates](/install/updating)
- Offizielle WSL2-Anleitung (Microsoft): https://learn.microsoft.com/windows/wsl/install

## Gateway

- [Gateway-Runbook](/gateway)
- [Konfiguration](/gateway/configuration)

## Gateway-Dienstinstallation (CLI)

Innerhalb von WSL2:

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

Wählen Sie **Gateway service**, wenn Sie dazu aufgefordert werden.

Reparieren/Migrieren:

```
openclaw doctor
```

## Erweitert: WSL-Dienste über LAN freigeben (portproxy)

WSL verfügt über ein eigenes virtuelles Netzwerk. Wenn ein anderes Gerät einen Dienst
erreichen muss, der **innerhalb von WSL** läuft (SSH, ein lokaler TTS-Server oder das Gateway),
müssen Sie einen Windows-Port auf die aktuelle WSL-IP weiterleiten. Die WSL-IP ändert sich nach Neustarts,
daher müssen Sie die Weiterleitungsregel ggf. aktualisieren.

Beispiel (PowerShell **als Administrator**):

```powershell
$Distro = "Ubuntu-24.04"
$ListenPort = 2222
$TargetPort = 22

$WslIp = (wsl -d $Distro -- hostname -I).Trim().Split(" ")[0]
if (-not $WslIp) { throw "WSL IP not found." }

netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$ListenPort `
  connectaddress=$WslIp connectport=$TargetPort
```

Port einmalig durch die Windows-Firewall zulassen:

```powershell
New-NetFirewallRule -DisplayName "WSL SSH $ListenPort" -Direction Inbound `
  -Protocol TCP -LocalPort $ListenPort -Action Allow
```

Portproxy nach WSL-Neustarts aktualisieren:

```powershell
netsh interface portproxy delete v4tov4 listenport=$ListenPort listenaddress=0.0.0.0 | Out-Null
netsh interface portproxy add v4tov4 listenport=$ListenPort listenaddress=0.0.0.0 `
  connectaddress=$WslIp connectport=$TargetPort | Out-Null
```

Hinweise:

- SSH von einem anderen Gerät zielt auf die **IP des Windows-Hosts** (Beispiel: `ssh user@windows-host -p 2222`).
- Remote-Knoten müssen auf eine **erreichbare** Gateway-URL zeigen (nicht `127.0.0.1`);
  verwenden Sie `openclaw status --all` zur Bestätigung.
- Verwenden Sie `listenaddress=0.0.0.0` für LAN-Zugriff; `127.0.0.1` hält es ausschließlich lokal.
- Wenn Sie dies automatisieren möchten, registrieren Sie eine geplante Aufgabe, die den
  Aktualisierungsschritt bei der Anmeldung ausführt.

## Schritt-für-Schritt-WSL2-Installation

### 1) WSL2 + Ubuntu installieren

PowerShell öffnen (Admin):

```powershell
wsl --install
# Or pick a distro explicitly:
wsl --list --online
wsl --install -d Ubuntu-24.04
```

Neustarten, wenn Windows dazu auffordert.

### 2) systemd aktivieren (erforderlich für die Gateway-Installation)

In Ihrem WSL-Terminal:

```bash
sudo tee /etc/wsl.conf >/dev/null <<'EOF'
[boot]
systemd=true
EOF
```

Dann in PowerShell:

```powershell
wsl --shutdown
```

Ubuntu erneut öffnen und anschließend prüfen:

```bash
systemctl --user status
```

### 3) OpenClaw installieren (innerhalb von WSL)

Folgen Sie dem Linux-Erste-Schritte-Ablauf innerhalb von WSL:

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build
openclaw onboard
```

Vollständige Anleitung: [Erste Schritte](/start/getting-started)

## Windows-Begleit-App

Wir haben derzeit noch keine Windows-Begleit-App. Beiträge sind willkommen, wenn Sie
mithelfen möchten, dies zu ermöglichen.
