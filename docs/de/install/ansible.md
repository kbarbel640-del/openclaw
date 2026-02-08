---
summary: „Automatisierte, gehärtete OpenClaw-Installation mit Ansible, Tailscale-VPN und Firewall-Isolierung“
read_when:
  - Sie moechten eine automatisierte Serverbereitstellung mit Sicherheits-Haertung
  - Sie benoetigen ein firewall-isoliertes Setup mit VPN-Zugriff
  - Sie stellen auf entfernten Debian-/Ubuntu-Servern bereit
title: „Ansible“
x-i18n:
  source_path: install/ansible.md
  source_hash: 896807f344d923f0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:42Z
---

# Ansible-Installation

Der empfohlene Weg, OpenClaw auf Produktionsservern bereitzustellen, ist **[openclaw-ansible](https://github.com/openclaw/openclaw-ansible)** — ein automatisierter Installer mit einer Sicherheitsarchitektur nach dem Security-first-Prinzip.

## Schnellstart

Installation mit einem Befehl:

```bash
curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw-ansible/main/install.sh | bash
```

> **📦 Vollstaendige Anleitung: [github.com/openclaw/openclaw-ansible](https://github.com/openclaw/openclaw-ansible)**
>
> Das Repository openclaw-ansible ist die maßgebliche Quelle fuer die Ansible-Bereitstellung. Diese Seite bietet eine kurze Uebersicht.

## Was Sie erhalten

- 🔒 **Firewall-zentrierte Sicherheit**: UFW + Docker-Isolierung (nur SSH + Tailscale zugaenglich)
- 🔐 **Tailscale-VPN**: Sicherer Fernzugriff ohne oeffentliche Freigabe von Services
- 🐳 **Docker**: Isolierte Sandbox-Container, Bindings nur an localhost
- 🛡️ **Defense in Depth**: 4-stufige Sicherheitsarchitektur
- 🚀 **Ein-Befehl-Setup**: Vollstaendige Bereitstellung in Minuten
- 🔧 **Systemd-Integration**: Autostart beim Booten mit Haertung

## Anforderungen

- **OS**: Debian 11+ oder Ubuntu 20.04+
- **Zugriff**: Root- oder sudo-Berechtigungen
- **Netzwerk**: Internetverbindung fuer die Paketinstallation
- **Ansible**: 2.14+ (wird durch das Schnellstart-Skript automatisch installiert)

## Was installiert wird

Das Ansible-Playbook installiert und konfiguriert:

1. **Tailscale** (Mesh-VPN fuer sicheren Fernzugriff)
2. **UFW-Firewall** (nur SSH- und Tailscale-Ports)
3. **Docker CE + Compose V2** (fuer Agent-Sandboxes)
4. **Node.js 22.x + pnpm** (Runtime-Abhaengigkeiten)
5. **OpenClaw** (hostbasiert, nicht containerisiert)
6. **Systemd-Service** (Autostart mit Sicherheits-Haertung)

Hinweis: Das Gateway laeuft **direkt auf dem Host** (nicht in Docker), Agent-Sandboxes nutzen jedoch Docker zur Isolierung. Siehe [Sandboxing](/gateway/sandboxing) fuer Details.

## Einrichtung nach der Installation

Nach Abschluss der Installation wechseln Sie zum Benutzer openclaw:

```bash
sudo -i -u openclaw
```

Das Post-Install-Skript fuehrt Sie durch:

1. **Einfuehrungs-Assistent**: Konfiguration der OpenClaw-Einstellungen
2. **Anbieter-Login**: Verbindung zu WhatsApp/Telegram/Discord/Signal
3. **Gateway-Test**: Ueberpruefung der Installation
4. **Tailscale-Einrichtung**: Verbindung zu Ihrem VPN-Mesh

### Schnelle Befehle

```bash
# Check service status
sudo systemctl status openclaw

# View live logs
sudo journalctl -u openclaw -f

# Restart gateway
sudo systemctl restart openclaw

# Provider login (run as openclaw user)
sudo -i -u openclaw
openclaw channels login
```

## Sicherheitsarchitektur

### 4-stufige Abwehr

1. **Firewall (UFW)**: Nur SSH (22) + Tailscale (41641/udp) sind oeffentlich exponiert
2. **VPN (Tailscale)**: Gateway ist ausschliesslich ueber das VPN-Mesh erreichbar
3. **Docker-Isolierung**: DOCKER-USER-iptables-Chain verhindert externe Portfreigaben
4. **Systemd-Haertung**: NoNewPrivileges, PrivateTmp, unprivilegierter Benutzer

### Verifizierung

Externe Angriffsoberflaeche testen:

```bash
nmap -p- YOUR_SERVER_IP
```

Es sollte **nur Port 22** (SSH) als offen angezeigt werden. Alle anderen Services (Gateway, Docker) sind abgeschottet.

### Docker-Verfuegbarkeit

Docker ist fuer **Agent-Sandboxes** (isolierte Tool-Ausfuehrung) installiert, nicht fuer den Betrieb des Gateways selbst. Das Gateway bindet ausschliesslich an localhost und ist ueber das Tailscale-VPN erreichbar.

Siehe [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) fuer die Sandbox-Konfiguration.

## Manuelle Installation

Wenn Sie manuelle Kontrolle der Automatisierung bevorzugen:

```bash
# 1. Install prerequisites
sudo apt update && sudo apt install -y ansible git

# 2. Clone repository
git clone https://github.com/openclaw/openclaw-ansible.git
cd openclaw-ansible

# 3. Install Ansible collections
ansible-galaxy collection install -r requirements.yml

# 4. Run playbook
./run-playbook.sh

# Or run directly (then manually execute /tmp/openclaw-setup.sh after)
# ansible-playbook playbook.yml --ask-become-pass
```

## Aktualisieren von OpenClaw

Der Ansible-Installer richtet OpenClaw fuer manuelle Updates ein. Siehe [Updating](/install/updating) fuer den standardmaessigen Update-Ablauf.

Um das Ansible-Playbook erneut auszufuehren (z. B. fuer Konfigurationsaenderungen):

```bash
cd openclaw-ansible
./run-playbook.sh
```

Hinweis: Dies ist idempotent und kann sicher mehrfach ausgefuehrt werden.

## Fehlerbehebung

### Firewall blockiert meine Verbindung

Wenn Sie ausgesperrt sind:

- Stellen Sie sicher, dass Sie zuerst ueber das Tailscale-VPN zugreifen koennen
- SSH-Zugriff (Port 22) ist immer erlaubt
- Das Gateway ist **ausschliesslich** ueber Tailscale erreichbar — designbedingt

### Service startet nicht

```bash
# Check logs
sudo journalctl -u openclaw -n 100

# Verify permissions
sudo ls -la /opt/openclaw

# Test manual start
sudo -i -u openclaw
cd ~/openclaw
pnpm start
```

### Docker-Sandbox-Probleme

```bash
# Verify Docker is running
sudo systemctl status docker

# Check sandbox image
sudo docker images | grep openclaw-sandbox

# Build sandbox image if missing
cd /opt/openclaw/openclaw
sudo -u openclaw ./scripts/sandbox-setup.sh
```

### Anbieter-Login schlaegt fehl

Stellen Sie sicher, dass Sie als Benutzer `openclaw` arbeiten:

```bash
sudo -i -u openclaw
openclaw channels login
```

## Erweiterte Konfiguration

Fuer detaillierte Sicherheitsarchitektur und Fehlerbehebung:

- [Security Architecture](https://github.com/openclaw/openclaw-ansible/blob/main/docs/security.md)
- [Technical Details](https://github.com/openclaw/openclaw-ansible/blob/main/docs/architecture.md)
- [Troubleshooting Guide](https://github.com/openclaw/openclaw-ansible/blob/main/docs/troubleshooting.md)

## Verwandt

- [openclaw-ansible](https://github.com/openclaw/openclaw-ansible) — vollstaendige Bereitstellungsanleitung
- [Docker](/install/docker) — containerisiertes Gateway-Setup
- [Sandboxing](/gateway/sandboxing) — Konfiguration von Agent-Sandboxes
- [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) — Isolierung pro Agent
