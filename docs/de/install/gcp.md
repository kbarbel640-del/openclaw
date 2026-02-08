---
summary: „OpenClaw Gateway rund um die Uhr auf einer GCP Compute Engine VM (Docker) mit dauerhaftem Zustand ausführen“
read_when:
  - Sie moechten OpenClaw rund um die Uhr auf GCP betreiben
  - Sie moechten einen produktionsreifen, dauerhaft aktiven Gateway auf Ihrer eigenen VM
  - Sie moechten volle Kontrolle ueber Persistenz, Binaries und Neustartverhalten
title: "GCP"
x-i18n:
  source_path: install/gcp.md
  source_hash: abb236dd421505d3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:53Z
---

# OpenClaw auf GCP Compute Engine (Docker, Produktions‑VPS‑Leitfaden)

## Ziel

Einen persistenten OpenClaw Gateway auf einer GCP Compute Engine VM mit Docker betreiben – mit dauerhaftem Zustand, fest integrierten Binaries und sicherem Neustartverhalten.

Wenn Sie „OpenClaw 24/7 fuer ~$5–12/Monat“ moechten, ist dies ein zuverlaessiges Setup auf Google Cloud.
Die Preise variieren je nach Maschinentyp und Region; waehlen Sie die kleinste VM, die zu Ihrer Arbeitslast passt, und skalieren Sie hoch, wenn OOMs auftreten.

## Was machen wir (einfach erklaert)?

- Ein GCP‑Projekt erstellen und Abrechnung aktivieren
- Eine Compute Engine VM erstellen
- Docker installieren (isolierte App‑Laufzeit)
- Den OpenClaw Gateway in Docker starten
- `~/.openclaw` + `~/.openclaw/workspace` auf dem Host persistieren (ueberlebt Neustarts/Rebuilds)
- Zugriff auf die Control‑UI von Ihrem Laptop ueber einen SSH‑Tunnel

Der Gateway kann erreicht werden ueber:

- SSH‑Portweiterleitung von Ihrem Laptop
- Direkte Portfreigabe, wenn Sie Firewalling und Tokens selbst verwalten

Diese Anleitung verwendet Debian auf GCP Compute Engine.
Ubuntu funktioniert ebenfalls; ordnen Sie die Pakete entsprechend zu.
Fuer den generischen Docker‑Ablauf siehe [Docker](/install/docker).

---

## Schneller Weg (erfahrene Operatoren)

1. GCP‑Projekt erstellen + Compute Engine API aktivieren
2. Compute Engine VM erstellen (e2-small, Debian 12, 20GB)
3. Per SSH in die VM einloggen
4. Docker installieren
5. OpenClaw‑Repository klonen
6. Persistente Host‑Verzeichnisse erstellen
7. `.env` und `docker-compose.yml` konfigurieren
8. Erforderliche Binaries einbacken, bauen und starten

---

## Voraussetzungen

- GCP‑Konto (Free‑Tier‑faehig fuer e2-micro)
- gcloud CLI installiert (oder Nutzung der Cloud Console)
- SSH‑Zugriff von Ihrem Laptop
- Grundlegende Vertrautheit mit SSH + Copy/Paste
- ~20–30 Minuten
- Docker und Docker Compose
- Modell‑Auth‑Zugangsdaten
- Optionale Anbieter‑Zugangsdaten
  - WhatsApp‑QR
  - Telegram‑Bot‑Token
  - Gmail‑OAuth

---

## 1) gcloud CLI installieren (oder Console verwenden)

**Option A: gcloud CLI** (empfohlen fuer Automatisierung)

Installation unter https://cloud.google.com/sdk/docs/install

Initialisieren und authentifizieren:

```bash
gcloud init
gcloud auth login
```

**Option B: Cloud Console**

Alle Schritte koennen ueber die Web‑UI unter https://console.cloud.google.com durchgefuehrt werden.

---

## 2) Ein GCP‑Projekt erstellen

**CLI:**

```bash
gcloud projects create my-openclaw-project --name="OpenClaw Gateway"
gcloud config set project my-openclaw-project
```

Abrechnung unter https://console.cloud.google.com/billing aktivieren (erforderlich fuer Compute Engine).

Compute Engine API aktivieren:

```bash
gcloud services enable compute.googleapis.com
```

**Console:**

1. Zu IAM & Admin > Create Project gehen
2. Benennen und erstellen
3. Abrechnung fuer das Projekt aktivieren
4. Zu APIs & Services > Enable APIs > nach „Compute Engine API“ suchen > Enable

---

## 3) Die VM erstellen

**Maschinentypen:**

| Typ      | Spezifikationen           | Kosten           | Hinweise            |
| -------- | ------------------------- | ---------------- | ------------------- |
| e2-small | 2 vCPU, 2GB RAM           | ~$12/Monat       | Empfohlen           |
| e2-micro | 2 vCPU (geteilt), 1GB RAM | Free‑Tier‑faehig | Kann unter Last OOM |

**CLI:**

```bash
gcloud compute instances create openclaw-gateway \
  --zone=us-central1-a \
  --machine-type=e2-small \
  --boot-disk-size=20GB \
  --image-family=debian-12 \
  --image-project=debian-cloud
```

**Console:**

1. Zu Compute Engine > VM instances > Create instance gehen
2. Name: `openclaw-gateway`
3. Region: `us-central1`, Zone: `us-central1-a`
4. Maschinentyp: `e2-small`
5. Boot‑Disk: Debian 12, 20GB
6. Create

---

## 4) Per SSH in die VM einloggen

**CLI:**

```bash
gcloud compute ssh openclaw-gateway --zone=us-central1-a
```

**Console:**

Klicken Sie im Compute‑Engine‑Dashboard neben Ihrer VM auf die Schaltflaeche „SSH“.

Hinweis: Die SSH‑Schluesselverteilung kann nach der VM‑Erstellung 1–2 Minuten dauern. Wenn die Verbindung abgelehnt wird, warten Sie und versuchen Sie es erneut.

---

## 5) Docker installieren (auf der VM)

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Abmelden und erneut anmelden, damit die Gruppen­aenderung wirksam wird:

```bash
exit
```

Dann erneut per SSH einloggen:

```bash
gcloud compute ssh openclaw-gateway --zone=us-central1-a
```

Ueberpruefen:

```bash
docker --version
docker compose version
```

---

## 6) Das OpenClaw‑Repository klonen

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
```

Diese Anleitung geht davon aus, dass Sie ein benutzerdefiniertes Image bauen, um die Persistenz der Binaries sicherzustellen.

---

## 7) Persistente Host‑Verzeichnisse erstellen

Docker‑Container sind ephemer.
Der gesamte langlebige Zustand muss auf dem Host liegen.

```bash
mkdir -p ~/.openclaw
mkdir -p ~/.openclaw/workspace
```

---

## 8) Umgebungsvariablen konfigurieren

Erstellen Sie `.env` im Repository‑Root.

```bash
OPENCLAW_IMAGE=openclaw:latest
OPENCLAW_GATEWAY_TOKEN=change-me-now
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_GATEWAY_PORT=18789

OPENCLAW_CONFIG_DIR=/home/$USER/.openclaw
OPENCLAW_WORKSPACE_DIR=/home/$USER/.openclaw/workspace

GOG_KEYRING_PASSWORD=change-me-now
XDG_CONFIG_HOME=/home/node/.openclaw
```

Starke Secrets generieren:

```bash
openssl rand -hex 32
```

**Committen Sie diese Datei nicht.**

---

## 9) Docker‑Compose‑Konfiguration

Erstellen oder aktualisieren Sie `docker-compose.yml`.

```yaml
services:
  openclaw-gateway:
    image: ${OPENCLAW_IMAGE}
    build: .
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - HOME=/home/node
      - NODE_ENV=production
      - TERM=xterm-256color
      - OPENCLAW_GATEWAY_BIND=${OPENCLAW_GATEWAY_BIND}
      - OPENCLAW_GATEWAY_PORT=${OPENCLAW_GATEWAY_PORT}
      - OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
      - GOG_KEYRING_PASSWORD=${GOG_KEYRING_PASSWORD}
      - XDG_CONFIG_HOME=${XDG_CONFIG_HOME}
      - PATH=/home/linuxbrew/.linuxbrew/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
    volumes:
      - ${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw
      - ${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace
    ports:
      # Recommended: keep the Gateway loopback-only on the VM; access via SSH tunnel.
      # To expose it publicly, remove the `127.0.0.1:` prefix and firewall accordingly.
      - "127.0.0.1:${OPENCLAW_GATEWAY_PORT}:18789"

      # Optional: only if you run iOS/Android nodes against this VM and need Canvas host.
      # If you expose this publicly, read /gateway/security and firewall accordingly.
      # - "18793:18793"
    command:
      [
        "node",
        "dist/index.js",
        "gateway",
        "--bind",
        "${OPENCLAW_GATEWAY_BIND}",
        "--port",
        "${OPENCLAW_GATEWAY_PORT}",
      ]
```

---

## 10) Erforderliche Binaries in das Image einbacken (kritisch)

Das Installieren von Binaries in einem laufenden Container ist eine Falle.
Alles, was zur Laufzeit installiert wird, geht bei einem Neustart verloren.

Alle externen Binaries, die von Skills benoetigt werden, muessen zur Image‑Build‑Zeit installiert werden.

Die folgenden Beispiele zeigen nur drei haeufige Binaries:

- `gog` fuer Gmail‑Zugriff
- `goplaces` fuer Google Places
- `wacli` fuer WhatsApp

Dies sind Beispiele, keine vollstaendige Liste.
Sie koennen beliebig viele Binaries nach dem gleichen Muster installieren.

Wenn Sie spaeter neue Skills hinzufuegen, die zusaetzliche Binaries benoetigen, muessen Sie:

1. Das Dockerfile aktualisieren
2. Das Image neu bauen
3. Die Container neu starten

**Beispiel‑Dockerfile**

```dockerfile
FROM node:22-bookworm

RUN apt-get update && apt-get install -y socat && rm -rf /var/lib/apt/lists/*

# Example binary 1: Gmail CLI
RUN curl -L https://github.com/steipete/gog/releases/latest/download/gog_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/gog

# Example binary 2: Google Places CLI
RUN curl -L https://github.com/steipete/goplaces/releases/latest/download/goplaces_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/goplaces

# Example binary 3: WhatsApp CLI
RUN curl -L https://github.com/steipete/wacli/releases/latest/download/wacli_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/wacli

# Add more binaries below using the same pattern

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY scripts ./scripts

RUN corepack enable
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
RUN pnpm ui:install
RUN pnpm ui:build

ENV NODE_ENV=production

CMD ["node","dist/index.js"]
```

---

## 11) Bauen und starten

```bash
docker compose build
docker compose up -d openclaw-gateway
```

Binaries ueberpruefen:

```bash
docker compose exec openclaw-gateway which gog
docker compose exec openclaw-gateway which goplaces
docker compose exec openclaw-gateway which wacli
```

Erwartete Ausgabe:

```
/usr/local/bin/gog
/usr/local/bin/goplaces
/usr/local/bin/wacli
```

---

## 12) Gateway ueberpruefen

```bash
docker compose logs -f openclaw-gateway
```

Erfolg:

```
[gateway] listening on ws://0.0.0.0:18789
```

---

## 13) Zugriff von Ihrem Laptop

Erstellen Sie einen SSH‑Tunnel, um den Gateway‑Port weiterzuleiten:

```bash
gcloud compute ssh openclaw-gateway --zone=us-central1-a -- -L 18789:127.0.0.1:18789
```

Im Browser oeffnen:

`http://127.0.0.1:18789/`

Fuegen Sie Ihr Gateway‑Token ein.

---

## Was wo persistiert (Single Source of Truth)

OpenClaw laeuft in Docker, aber Docker ist nicht die Quelle der Wahrheit.
Der gesamte langlebige Zustand muss Neustarts, Rebuilds und Reboots ueberstehen.

| Komponente            | Speicherort                       | Persistenzmechanismus  | Hinweise                           |
| --------------------- | --------------------------------- | ---------------------- | ---------------------------------- |
| Gateway‑Konfiguration | `/home/node/.openclaw/`           | Host‑Volume‑Mount      | Enthaelt `openclaw.json`, Tokens   |
| Modell‑Auth‑Profile   | `/home/node/.openclaw/`           | Host‑Volume‑Mount      | OAuth‑Tokens, API‑Keys             |
| Skill‑Konfigurationen | `/home/node/.openclaw/skills/`    | Host‑Volume‑Mount      | Skill‑spezifischer Zustand         |
| Agent‑Workspace       | `/home/node/.openclaw/workspace/` | Host‑Volume‑Mount      | Code und Agent‑Artefakte           |
| WhatsApp‑Sitzung      | `/home/node/.openclaw/`           | Host‑Volume‑Mount      | Bewahrt QR‑Login                   |
| Gmail‑Keyring         | `/home/node/.openclaw/`           | Host‑Volume + Passwort | Erfordert `GOG_KEYRING_PASSWORD`   |
| Externe Binaries      | `/usr/local/bin/`                 | Docker‑Image           | Muessen zur Build‑Zeit eingebacken |
| Node‑Runtime          | Container‑Dateisystem             | Docker‑Image           | Bei jedem Image‑Build neu erstellt |
| OS‑Pakete             | Container‑Dateisystem             | Docker‑Image           | Nicht zur Laufzeit installieren    |
| Docker‑Container      | Ephemer                           | Neustartbar            | Sicher zu verwerfen                |

---

## Updates

Um OpenClaw auf der VM zu aktualisieren:

```bash
cd ~/openclaw
git pull
docker compose build
docker compose up -d
```

---

## Fehlerbehebung

**SSH‑Verbindung abgelehnt**

Die SSH‑Schluesselverteilung kann nach der VM‑Erstellung 1–2 Minuten dauern. Warten Sie und versuchen Sie es erneut.

**OS‑Login‑Probleme**

Pruefen Sie Ihr OS‑Login‑Profil:

```bash
gcloud compute os-login describe-profile
```

Stellen Sie sicher, dass Ihr Konto ueber die erforderlichen IAM‑Berechtigungen verfuegt (Compute OS Login oder Compute OS Admin Login).

**Nicht genuegend Speicher (OOM)**

Wenn Sie e2-micro verwenden und OOMs auftreten, wechseln Sie zu e2-small oder e2-medium:

```bash
# Stop the VM first
gcloud compute instances stop openclaw-gateway --zone=us-central1-a

# Change machine type
gcloud compute instances set-machine-type openclaw-gateway \
  --zone=us-central1-a \
  --machine-type=e2-small

# Start the VM
gcloud compute instances start openclaw-gateway --zone=us-central1-a
```

---

## Service Accounts (Sicherheits‑Best‑Practice)

Fuer den persoenlichen Gebrauch reicht Ihr Standard‑Benutzerkonto aus.

Fuer Automatisierung oder CI/CD‑Pipelines erstellen Sie einen dedizierten Service Account mit minimalen Berechtigungen:

1. Einen Service Account erstellen:

   ```bash
   gcloud iam service-accounts create openclaw-deploy \
     --display-name="OpenClaw Deployment"
   ```

2. Die Rolle „Compute Instance Admin“ zuweisen (oder eine schmalere benutzerdefinierte Rolle):
   ```bash
   gcloud projects add-iam-policy-binding my-openclaw-project \
     --member="serviceAccount:openclaw-deploy@my-openclaw-project.iam.gserviceaccount.com" \
     --role="roles/compute.instanceAdmin.v1"
   ```

Vermeiden Sie die Verwendung der Owner‑Rolle fuer Automatisierung. Nutzen Sie das Prinzip der geringsten Berechtigung.

Siehe https://cloud.google.com/iam/docs/understanding-roles fuer Details zu IAM‑Rollen.

---

## Naechste Schritte

- Messaging‑Kanaele einrichten: [Channels](/channels)
- Lokale Geraete als Nodes koppeln: [Nodes](/nodes)
- Den Gateway konfigurieren: [Gateway configuration](/gateway/configuration)
