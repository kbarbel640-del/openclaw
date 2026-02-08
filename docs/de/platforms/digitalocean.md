---
summary: "OpenClaw auf DigitalOcean (einfache kostenpflichtige VPS-Option)"
read_when:
  - Einrichtung von OpenClaw auf DigitalOcean
  - Auf der Suche nach günstigem VPS-Hosting für OpenClaw
title: "DigitalOcean"
x-i18n:
  source_path: platforms/digitalocean.md
  source_hash: bacdea3a44bc663d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:59Z
---

# OpenClaw auf DigitalOcean

## Ziel

Betreiben Sie ein dauerhaftes OpenClaw Gateway auf DigitalOcean für **6 $/Monat** (oder 4 $/Monat mit reservierter Preisgestaltung).

Wenn Sie eine 0‑$/Monat‑Option möchten und sich nicht an ARM + anbieterspezifischer Einrichtung stören, siehe den [Oracle‑Cloud‑Leitfaden](/platforms/oracle).

## Kostenvergleich (2026)

| Anbieter     | Tarif           | Spezifikationen          | Preis/Monat   | Hinweise                                       |
| ------------ | --------------- | ------------------------ | ------------- | ---------------------------------------------- |
| Oracle Cloud | Always Free ARM | bis zu 4 OCPU, 24 GB RAM | 0 $           | ARM, begrenzte Kapazität / Anmelde‑Eigenheiten |
| Hetzner      | CX22            | 2 vCPU, 4 GB RAM         | 3,79 € (~4 $) | Günstigste kostenpflichtige Option             |
| DigitalOcean | Basic           | 1 vCPU, 1 GB RAM         | 6 $           | Einfache UI, gute Doku                         |
| Vultr        | Cloud Compute   | 1 vCPU, 1 GB RAM         | 6 $           | Viele Standorte                                |
| Linode       | Nanode          | 1 vCPU, 1 GB RAM         | 5 $           | Jetzt Teil von Akamai                          |

**Anbieter auswählen:**

- DigitalOcean: einfachste UX + vorhersehbares Setup (dieser Leitfaden)
- Hetzner: gutes Preis‑/Leistungsverhältnis (siehe [Hetzner‑Leitfaden](/install/hetzner))
- Oracle Cloud: kann 0 $/Monat kosten, ist aber heikler und nur ARM (siehe [Oracle‑Leitfaden](/platforms/oracle))

---

## Voraussetzungen

- DigitalOcean‑Konto ([Registrierung mit 200 $ Gratisguthaben](https://m.do.co/c/signup))
- SSH‑Schlüsselpaar (oder Bereitschaft zur Passwort‑Authentifizierung)
- ~20 Minuten

## 1) Droplet erstellen

1. Melden Sie sich bei [DigitalOcean](https://cloud.digitalocean.com/) an
2. Klicken Sie auf **Create → Droplets**
3. Wählen Sie:
   - **Region:** Ihnen (oder Ihren Nutzern) am nächsten
   - **Image:** Ubuntu 24.04 LTS
   - **Size:** Basic → Regular → **6 $/Monat** (1 vCPU, 1 GB RAM, 25 GB SSD)
   - **Authentication:** SSH‑Schlüssel (empfohlen) oder Passwort
4. Klicken Sie auf **Create Droplet**
5. Notieren Sie die IP‑Adresse

## 2) Per SSH verbinden

```bash
ssh root@YOUR_DROPLET_IP
```

## 3) OpenClaw installieren

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Install OpenClaw
curl -fsSL https://openclaw.ai/install.sh | bash

# Verify
openclaw --version
```

## 4) Einführung ausführen

```bash
openclaw onboard --install-daemon
```

Der Assistent führt Sie durch:

- Modell‑Authentifizierung (API‑Keys oder OAuth)
- Kanal‑Einrichtung (Telegram, WhatsApp, Discord usw.)
- Gateway‑Token (automatisch generiert)
- Daemon‑Installation (systemd)

## 5) Gateway überprüfen

```bash
# Check status
openclaw status

# Check service
systemctl --user status openclaw-gateway.service

# View logs
journalctl --user -u openclaw-gateway.service -f
```

## 6) Zugriff auf das Dashboard

Das Gateway bindet standardmäßig an den Loopback. Um auf die Control UI zuzugreifen:

**Option A: SSH‑Tunnel (empfohlen)**

```bash
# From your local machine
ssh -L 18789:localhost:18789 root@YOUR_DROPLET_IP

# Then open: http://localhost:18789
```

**Option B: Tailscale Serve (HTTPS, nur Loopback)**

```bash
# On the droplet
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up

# Configure Gateway to use Tailscale Serve
openclaw config set gateway.tailscale.mode serve
openclaw gateway restart
```

Öffnen: `https://<magicdns>/`

Hinweise:

- Serve hält das Gateway ausschließlich auf Loopback und authentifiziert über Tailscale‑Identitäts‑Header.
- Um stattdessen Token/Passwort zu verlangen, setzen Sie `gateway.auth.allowTailscale: false` oder verwenden Sie `gateway.auth.mode: "password"`.

**Option C: Tailnet‑Bindung (ohne Serve)**

```bash
openclaw config set gateway.bind tailnet
openclaw gateway restart
```

Öffnen: `http://<tailscale-ip>:18789` (Token erforderlich).

## 7) Ihre Kanäle verbinden

### Telegram

```bash
openclaw pairing list telegram
openclaw pairing approve telegram <CODE>
```

### WhatsApp

```bash
openclaw channels login whatsapp
# Scan QR code
```

Weitere Anbieter finden Sie unter [Kanäle](/channels).

---

## Optimierungen für 1 GB RAM

Das 6‑$‑Droplet hat nur 1 GB RAM. Damit alles reibungslos läuft:

### Swap hinzufügen (empfohlen)

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Leichteres Modell verwenden

Wenn Sie OOMs sehen, erwägen Sie:

- API‑basierte Modelle (Claude, GPT) statt lokaler Modelle
- Setzen von `agents.defaults.model.primary` auf ein kleineres Modell

### Speicher überwachen

```bash
free -h
htop
```

---

## Persistenz

Der gesamte Zustand befindet sich in:

- `~/.openclaw/` — Konfiguration, Zugangsdaten, Sitzungsdaten
- `~/.openclaw/workspace/` — Workspace (SOUL.md, Speicher usw.)

Diese überstehen Neustarts. Sichern Sie sie regelmäßig:

```bash
tar -czvf openclaw-backup.tar.gz ~/.openclaw ~/.openclaw/workspace
```

---

## Oracle Cloud Free‑Alternative

Oracle Cloud bietet **Always Free**‑ARM‑Instanzen, die deutlich leistungsfähiger sind als jede kostenpflichtige Option hier — für 0 $/Monat.

| Was Sie erhalten        | Spezifikationen               |
| ----------------------- | ----------------------------- |
| **4 OCPUs**             | ARM Ampere A1                 |
| **24 GB RAM**           | Mehr als ausreichend          |
| **200 GB Speicher**     | Block‑Volume                  |
| **Dauerhaft kostenlos** | Keine Kreditkartenbelastungen |

**Einschränkungen:**

- Registrierung kann heikel sein (bei Fehlschlag erneut versuchen)
- ARM‑Architektur — die meisten Dinge funktionieren, aber einige Binärdateien benötigen ARM‑Builds

Für den vollständigen Einrichtungsleitfaden siehe [Oracle Cloud](/platforms/oracle). Für Tipps zur Registrierung und zur Fehlerbehebung beim Aufnahmeprozess siehe diesen [Community‑Leitfaden](https://gist.github.com/rssnyder/51e3cfedd730e7dd5f4a816143b25dbd).

---

## Fehlerbehebung

### Gateway startet nicht

```bash
openclaw gateway status
openclaw doctor --non-interactive
journalctl -u openclaw --no-pager -n 50
```

### Port bereits in Verwendung

```bash
lsof -i :18789
kill <PID>
```

### Nicht genügend Speicher

```bash
# Check memory
free -h

# Add more swap
# Or upgrade to $12/mo droplet (2GB RAM)
```

---

## Siehe auch

- [Hetzner‑Leitfaden](/install/hetzner) — günstiger, leistungsfähiger
- [Docker‑Installation](/install/docker) — containerisiertes Setup
- [Tailscale](/gateway/tailscale) — sicherer Remote‑Zugriff
- [Konfiguration](/gateway/configuration) — vollständige Konfigurationsreferenz
