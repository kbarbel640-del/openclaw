---
summary: „Optionale Docker-basierte Einrichtung und Einführung für OpenClaw“
read_when:
  - Sie möchten ein containerisiertes Gateway statt lokaler Installationen
  - Sie validieren den Docker-Ablauf
title: „Docker“
x-i18n:
  source_path: install/docker.md
  source_hash: 021ec5aa78e1a6eb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:04Z
---

# Docker (optional)

Docker ist **optional**. Verwenden Sie es nur, wenn Sie ein containerisiertes Gateway möchten oder den Docker-Ablauf validieren wollen.

## Ist Docker das Richtige für mich?

- **Ja**: Sie möchten eine isolierte, wegwerfbare Gateway-Umgebung oder OpenClaw auf einem Host ohne lokale Installationen ausführen.
- **Nein**: Sie arbeiten auf Ihrem eigenen Rechner und möchten einfach die schnellste Entwicklungsiteration. Verwenden Sie stattdessen den normalen Installationsablauf.
- **Sandboxing-Hinweis**: Agent-Sandboxing nutzt ebenfalls Docker, erfordert jedoch **nicht**, dass das gesamte Gateway in Docker läuft. Siehe [Sandboxing](/gateway/sandboxing).

Dieser Leitfaden behandelt:

- Containerisiertes Gateway (vollständiges OpenClaw in Docker)
- Agent-Sandbox pro Sitzung (Gateway auf dem Host + Docker-isolierte Agent-Werkzeuge)

Sandboxing-Details: [Sandboxing](/gateway/sandboxing)

## Anforderungen

- Docker Desktop (oder Docker Engine) + Docker Compose v2
- Ausreichend Speicherplatz für Images + Logs

## Containerisiertes Gateway (Docker Compose)

### Schnellstart (empfohlen)

Vom Repo-Root aus:

```bash
./docker-setup.sh
```

Dieses Skript:

- baut das Gateway-Image
- führt den Einführungsassistenten aus
- gibt optionale Hinweise zur Anbieter-Einrichtung aus
- startet das Gateway über Docker Compose
- generiert ein Gateway-Token und schreibt es nach `.env`

Optionale Umgebungsvariablen:

- `OPENCLAW_DOCKER_APT_PACKAGES` — installiert zusätzliche apt-Pakete während des Builds
- `OPENCLAW_EXTRA_MOUNTS` — fügt zusätzliche Host-Bind-Mounts hinzu
- `OPENCLAW_HOME_VOLUME` — persistiert `/home/node` in einem benannten Volume

Nach Abschluss:

- Öffnen Sie `http://127.0.0.1:18789/` in Ihrem Browser.
- Fügen Sie das Token in der Control UI ein (Settings → token).
- URL erneut benötigt? Führen Sie `docker compose run --rm openclaw-cli dashboard --no-open` aus.

Es schreibt Konfiguration/Workspace auf den Host:

- `~/.openclaw/`
- `~/.openclaw/workspace`

Läuft auf einem VPS? Siehe [Hetzner (Docker VPS)](/install/hetzner).

### Manueller Ablauf (Compose)

```bash
docker build -t openclaw:local -f Dockerfile .
docker compose run --rm openclaw-cli onboard
docker compose up -d openclaw-gateway
```

Hinweis: Führen Sie `docker compose ...` vom Repo-Root aus. Wenn Sie
`OPENCLAW_EXTRA_MOUNTS` oder `OPENCLAW_HOME_VOLUME` aktiviert haben, schreibt das Setup-Skript
`docker-compose.extra.yml`; binden Sie diese Datei ein, wenn Sie Compose andernorts ausführen:

```bash
docker compose -f docker-compose.yml -f docker-compose.extra.yml <command>
```

### Control-UI-Token + Pairing (Docker)

Wenn Sie „unauthorized“ oder „disconnected (1008): pairing required“ sehen, holen Sie
einen frischen Dashboard-Link und genehmigen Sie das Browser-Gerät:

```bash
docker compose run --rm openclaw-cli dashboard --no-open
docker compose run --rm openclaw-cli devices list
docker compose run --rm openclaw-cli devices approve <requestId>
```

Mehr Details: [Dashboard](/web/dashboard), [Devices](/cli/devices).

### Zusätzliche Mounts (optional)

Wenn Sie weitere Host-Verzeichnisse in die Container einbinden möchten, setzen Sie
`OPENCLAW_EXTRA_MOUNTS` vor dem Ausführen von `docker-setup.sh`. Dies akzeptiert eine
kommaseparierte Liste von Docker-Bind-Mounts und wendet sie auf
`openclaw-gateway` und `openclaw-cli` an, indem `docker-compose.extra.yml` generiert wird.

Beispiel:

```bash
export OPENCLAW_EXTRA_MOUNTS="$HOME/.codex:/home/node/.codex:ro,$HOME/github:/home/node/github:rw"
./docker-setup.sh
```

Hinweise:

- Pfade müssen unter macOS/Windows mit Docker Desktop geteilt sein.
- Wenn Sie `OPENCLAW_EXTRA_MOUNTS` bearbeiten, führen Sie `docker-setup.sh` erneut aus, um die
  zusätzliche Compose-Datei neu zu generieren.
- `docker-compose.extra.yml` wird generiert. Nicht manuell bearbeiten.

### Gesamtes Container-Home persistieren (optional)

Wenn Sie möchten, dass `/home/node` über das Neuerstellen von Containern hinweg
besteht, setzen Sie ein benanntes Volume über `OPENCLAW_HOME_VOLUME`. Dies erstellt ein
Docker-Volume und mountet es unter `/home/node`, während die standardmäßigen
Config-/Workspace-Bind-Mounts beibehalten werden. Verwenden Sie hier ein benanntes
Volume (keinen Bind-Pfad); für Bind-Mounts nutzen Sie `OPENCLAW_EXTRA_MOUNTS`.

Beispiel:

```bash
export OPENCLAW_HOME_VOLUME="openclaw_home"
./docker-setup.sh
```

Sie können dies mit zusätzlichen Mounts kombinieren:

```bash
export OPENCLAW_HOME_VOLUME="openclaw_home"
export OPENCLAW_EXTRA_MOUNTS="$HOME/.codex:/home/node/.codex:ro,$HOME/github:/home/node/github:rw"
./docker-setup.sh
```

Hinweise:

- Wenn Sie `OPENCLAW_HOME_VOLUME` ändern, führen Sie `docker-setup.sh` erneut aus, um die
  zusätzliche Compose-Datei neu zu generieren.
- Das benannte Volume bleibt bestehen, bis es mit `docker volume rm <name>` entfernt wird.

### Zusätzliche apt-Pakete installieren (optional)

Wenn Sie Systempakete im Image benötigen (z. B. Build-Tools oder Media-Bibliotheken),
setzen Sie `OPENCLAW_DOCKER_APT_PACKAGES` vor dem Ausführen von `docker-setup.sh`.
Die Pakete werden während des Image-Builds installiert und bleiben auch erhalten,
wenn der Container gelöscht wird.

Beispiel:

```bash
export OPENCLAW_DOCKER_APT_PACKAGES="ffmpeg build-essential"
./docker-setup.sh
```

Hinweise:

- Akzeptiert eine durch Leerzeichen getrennte Liste von apt-Paketnamen.
- Wenn Sie `OPENCLAW_DOCKER_APT_PACKAGES` ändern, führen Sie `docker-setup.sh` erneut aus, um das
  Image neu zu bauen.

### Power-User / voll ausgestatteter Container (Opt-in)

Das Standard-Docker-Image ist **sicherheitsorientiert** und läuft als der
nicht-root Benutzer `node`. Das hält die Angriffsfläche klein, bedeutet aber:

- keine Installation von Systempaketen zur Laufzeit
- kein Homebrew standardmäßig
- keine gebündelten Chromium-/Playwright-Browser

Wenn Sie einen funktionsreicheren Container möchten, nutzen Sie diese Opt-in-Optionen:

1. **`/home/node` persistieren**, damit Browser-Downloads und Tool-Caches erhalten bleiben:

```bash
export OPENCLAW_HOME_VOLUME="openclaw_home"
./docker-setup.sh
```

2. **Systemabhängigkeiten ins Image einbacken** (reproduzierbar + persistent):

```bash
export OPENCLAW_DOCKER_APT_PACKAGES="git curl jq"
./docker-setup.sh
```

3. **Playwright-Browser ohne `npx` installieren** (vermeidet npm-Override-Konflikte):

```bash
docker compose run --rm openclaw-cli \
  node /app/node_modules/playwright-core/cli.js install chromium
```

Wenn Playwright Systemabhängigkeiten installieren muss, bauen Sie das Image mit
`OPENCLAW_DOCKER_APT_PACKAGES` neu, anstatt `--with-deps` zur Laufzeit zu verwenden.

4. **Playwright-Browser-Downloads persistieren**:

- Setzen Sie `PLAYWRIGHT_BROWSERS_PATH=/home/node/.cache/ms-playwright` in
  `docker-compose.yml`.
- Stellen Sie sicher, dass `/home/node` über `OPENCLAW_HOME_VOLUME` persistiert,
  oder mounten Sie `/home/node/.cache/ms-playwright` über `OPENCLAW_EXTRA_MOUNTS`.

### Berechtigungen + EACCES

Das Image läuft als `node` (uid 1000). Wenn Sie Berechtigungsfehler auf
`/home/node/.openclaw` sehen, stellen Sie sicher, dass Ihre Host-Bind-Mounts uid 1000 gehören.

Beispiel (Linux-Host):

```bash
sudo chown -R 1000:1000 /path/to/openclaw-config /path/to/openclaw-workspace
```

Wenn Sie sich aus Bequemlichkeit entscheiden, als root zu laufen, akzeptieren Sie den
Sicherheitskompromiss.

### Schnellere Rebuilds (empfohlen)

Um Rebuilds zu beschleunigen, ordnen Sie Ihr Dockerfile so an, dass
Abhängigkeits-Layer gecacht werden. Dadurch wird `pnpm install` nicht erneut
ausgeführt, solange sich Lockfiles nicht ändern:

```dockerfile
FROM node:22-bookworm

# Install Bun (required for build scripts)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

RUN corepack enable

WORKDIR /app

# Cache dependencies unless package metadata changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
RUN pnpm ui:install
RUN pnpm ui:build

ENV NODE_ENV=production

CMD ["node","dist/index.js"]
```

### Channel-Einrichtung (optional)

Verwenden Sie den CLI-Container, um Channels zu konfigurieren, und starten Sie das
Gateway bei Bedarf neu.

WhatsApp (QR):

```bash
docker compose run --rm openclaw-cli channels login
```

Telegram (Bot-Token):

```bash
docker compose run --rm openclaw-cli channels add --channel telegram --token "<token>"
```

Discord (Bot-Token):

```bash
docker compose run --rm openclaw-cli channels add --channel discord --token "<token>"
```

Docs: [WhatsApp](/channels/whatsapp), [Telegram](/channels/telegram), [Discord](/channels/discord)

### OpenAI Codex OAuth (Headless Docker)

Wenn Sie im Assistenten OpenAI Codex OAuth auswählen, wird eine Browser-URL geöffnet
und versucht, einen Callback auf `http://127.0.0.1:1455/auth/callback` abzufangen. In Docker- oder
Headless-Setups kann dieser Callback einen Browser-Fehler anzeigen. Kopieren Sie die
vollständige Redirect-URL, auf der Sie landen, und fügen Sie sie zurück in den
Assistenten ein, um die Authentifizierung abzuschließen.

### Health Check

```bash
docker compose exec openclaw-gateway node dist/index.js health --token "$OPENCLAW_GATEWAY_TOKEN"
```

### E2E-Smoke-Test (Docker)

```bash
scripts/e2e/onboard-docker.sh
```

### QR-Import-Smoke-Test (Docker)

```bash
pnpm test:docker:qr
```

### Hinweise

- Gateway-Bindung ist standardmäßig `lan` für den Containerbetrieb.
- Dockerfile-CMD verwendet `--allow-unconfigured`; gemountete Konfiguration mit
  `gateway.mode` statt `local` startet trotzdem. Überschreiben Sie CMD,
  um die Schutzprüfung zu erzwingen.
- Der Gateway-Container ist die maßgebliche Quelle für Sitzungen (`~/.openclaw/agents/<agentId>/sessions/`).

## Agent-Sandbox (Gateway auf dem Host + Docker-Werkzeuge)

Deep Dive: [Sandboxing](/gateway/sandboxing)

### Was es macht

Wenn `agents.defaults.sandbox` aktiviert ist, führen **Nicht-Hauptsitzungen** Werkzeuge in
einem Docker-Container aus. Das Gateway bleibt auf Ihrem Host, die
Werkzeugausführung ist jedoch isoliert:

- Umfang: `"agent"` standardmäßig (ein Container + Workspace pro Agent)
- Umfang: `"session"` für Isolation pro Sitzung
- Pro-Umfang-Workspace-Ordner gemountet unter `/workspace`
- Optionaler Zugriff auf den Agent-Workspace (`agents.defaults.sandbox.workspaceAccess`)
- Allow-/Deny-Werkzeugrichtlinie (Deny gewinnt)
- Eingehende Medien werden in den aktiven Sandbox-Workspace (`media/inbound/*`)
  kopiert, damit Werkzeuge sie lesen können (mit `workspaceAccess: "rw"` landet dies im
  Agent-Workspace)

Warnung: `scope: "shared"` deaktiviert die Isolation zwischen Sitzungen. Alle
Sitzungen teilen sich einen Container und einen Workspace.

### Sandbox-Profile pro Agent (Multi-Agent)

Wenn Sie Multi-Agent-Routing verwenden, kann jeder Agent Sandbox- und
Werkzeugeinstellungen überschreiben:
`agents.list[].sandbox` und `agents.list[].tools` (plus `agents.list[].tools.sandbox.tools`). So können Sie gemischte
Zugriffsebenen in einem Gateway betreiben:

- Vollzugriff (persönlicher Agent)
- Nur-Lese-Werkzeuge + Nur-Lese-Workspace (Familien-/Arbeitsagent)
- Keine Dateisystem-/Shell-Werkzeuge (öffentlicher Agent)

Siehe [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) für Beispiele,
Prioritäten und Fehlerbehebung.

### Standardverhalten

- Image: `openclaw-sandbox:bookworm-slim`
- Ein Container pro Agent
- Agent-Workspace-Zugriff: `workspaceAccess: "none"` (Standard) nutzt `~/.openclaw/sandboxes`
  - `"ro"` belässt den Sandbox-Workspace unter `/workspace` und mountet
    den Agent-Workspace schreibgeschützt unter `/agent`
    (deaktiviert `write`/`edit`/`apply_patch`)
  - `"rw"` mountet den Agent-Workspace schreib-/lesbar unter `/workspace`
- Auto-Prune: Leerlauf > 24 h ODER Alter > 7 d
- Netzwerk: `none` standardmäßig (explizit aktivieren, wenn Egress benötigt wird)
- Standard-Allow: `exec`, `process`, `read`, `write`,
  `edit`, `sessions_list`, `sessions_history`, `sessions_send`,
  `sessions_spawn`, `session_status`
- Standard-Deny: `browser`, `canvas`, `nodes`, `cron`,
  `discord`, `gateway`

### Sandboxing aktivieren

Wenn Sie planen, Pakete in `setupCommand` zu installieren, beachten Sie:

- Standard `docker.network` ist `"none"` (kein Egress).
- `readOnlyRoot: true` blockiert Paketinstallationen.
- `user` muss root sein für `apt-get` (lassen Sie `user` weg
  oder setzen Sie `user: "0:0"`).
  OpenClaw erstellt Container automatisch neu, wenn sich `setupCommand`
  (oder die Docker-Konfiguration) ändert, es sei denn, der Container wurde **kürzlich
  verwendet** (innerhalb von ~5 Minuten). Aktive Container protokollieren eine
  Warnung mit dem exakten `openclaw sandbox recreate ...`-Befehl.

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main", // off | non-main | all
        scope: "agent", // session | agent | shared (agent is default)
        workspaceAccess: "none", // none | ro | rw
        workspaceRoot: "~/.openclaw/sandboxes",
        docker: {
          image: "openclaw-sandbox:bookworm-slim",
          workdir: "/workspace",
          readOnlyRoot: true,
          tmpfs: ["/tmp", "/var/tmp", "/run"],
          network: "none",
          user: "1000:1000",
          capDrop: ["ALL"],
          env: { LANG: "C.UTF-8" },
          setupCommand: "apt-get update && apt-get install -y git curl jq",
          pidsLimit: 256,
          memory: "1g",
          memorySwap: "2g",
          cpus: 1,
          ulimits: {
            nofile: { soft: 1024, hard: 2048 },
            nproc: 256,
          },
          seccompProfile: "/path/to/seccomp.json",
          apparmorProfile: "openclaw-sandbox",
          dns: ["1.1.1.1", "8.8.8.8"],
          extraHosts: ["internal.service:10.0.0.5"],
        },
        prune: {
          idleHours: 24, // 0 disables idle pruning
          maxAgeDays: 7, // 0 disables max-age pruning
        },
      },
    },
  },
  tools: {
    sandbox: {
      tools: {
        allow: [
          "exec",
          "process",
          "read",
          "write",
          "edit",
          "sessions_list",
          "sessions_history",
          "sessions_send",
          "sessions_spawn",
          "session_status",
        ],
        deny: ["browser", "canvas", "nodes", "cron", "discord", "gateway"],
      },
    },
  },
}
```

Härtungsoptionen befinden sich unter `agents.defaults.sandbox.docker`:
`network`, `user`, `pidsLimit`, `memory`, `memorySwap`,
`cpus`, `ulimits`, `seccompProfile`, `apparmorProfile`,
`dns`, `extraHosts`.

Multi-Agent: Überschreiben Sie `agents.defaults.sandbox.{docker,browser,prune}.*` pro Agent über `agents.list[].sandbox.{docker,browser,prune}.*`
(wird ignoriert, wenn `agents.defaults.sandbox.scope` / `agents.list[].sandbox.scope` `"shared"` ist).

### Standard-Sandbox-Image bauen

```bash
scripts/sandbox-setup.sh
```

Dies baut `openclaw-sandbox:bookworm-slim` mit `Dockerfile.sandbox`.

### Gemeinsames Sandbox-Image (optional)

Wenn Sie ein Sandbox-Image mit gängigen Build-Werkzeugen (Node, Go, Rust usw.)
möchten, bauen Sie das gemeinsame Image:

```bash
scripts/sandbox-common-setup.sh
```

Dies baut `openclaw-sandbox-common:bookworm-slim`. Zur Verwendung:

```json5
{
  agents: {
    defaults: {
      sandbox: { docker: { image: "openclaw-sandbox-common:bookworm-slim" } },
    },
  },
}
```

### Sandbox-Browser-Image

Um das Browser-Werkzeug innerhalb der Sandbox auszuführen, bauen Sie das
Browser-Image:

```bash
scripts/sandbox-browser-setup.sh
```

Dies baut `openclaw-sandbox-browser:bookworm-slim` mit
`Dockerfile.sandbox-browser`. Der Container führt Chromium mit aktiviertem CDP und einem
optionalen noVNC-Beobachter aus (headful über Xvfb).

Hinweise:

- Headful (Xvfb) reduziert Bot-Blocking gegenüber Headless.
- Headless kann weiterhin genutzt werden, indem `agents.defaults.sandbox.browser.headless=true` gesetzt wird.
- Keine vollständige Desktop-Umgebung (GNOME) erforderlich; Xvfb stellt das Display bereit.

Konfiguration verwenden:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        browser: { enabled: true },
      },
    },
  },
}
```

Benutzerdefiniertes Browser-Image:

```json5
{
  agents: {
    defaults: {
      sandbox: { browser: { image: "my-openclaw-browser" } },
    },
  },
}
```

Wenn aktiviert, erhält der Agent:

- eine Sandbox-Browser-Control-URL (für das `browser`-Werkzeug)
- eine noVNC-URL (falls aktiviert und headless=false)

Denken Sie daran: Wenn Sie eine Allowlist für Werkzeuge verwenden, fügen Sie
`browser` hinzu (und entfernen Sie es aus deny), sonst bleibt das Werkzeug blockiert.
Prune-Regeln (`agents.defaults.sandbox.prune`) gelten auch für Browser-Container.

### Benutzerdefiniertes Sandbox-Image

Bauen Sie Ihr eigenes Image und verweisen Sie die Konfiguration darauf:

```bash
docker build -t my-openclaw-sbx -f Dockerfile.sandbox .
```

```json5
{
  agents: {
    defaults: {
      sandbox: { docker: { image: "my-openclaw-sbx" } },
    },
  },
}
```

### Werkzeugrichtlinie (Allow/Deny)

- `deny` gewinnt gegenüber `allow`.
- Wenn `allow` leer ist: alle Werkzeuge (außer deny) sind verfügbar.
- Wenn `allow` nicht leer ist: nur Werkzeuge in `allow` sind verfügbar (minus deny).

### Pruning-Strategie

Zwei Stellschrauben:

- `prune.idleHours`: entfernt Container, die X Stunden nicht genutzt wurden (0 = deaktivieren)
- `prune.maxAgeDays`: entfernt Container, die älter als X Tage sind (0 = deaktivieren)

Beispiel:

- Aktive Sitzungen behalten, aber Lebensdauer begrenzen:
  `idleHours: 24`, `maxAgeDays: 7`
- Nie prunen:
  `idleHours: 0`, `maxAgeDays: 0`

### Sicherheitshinweise

- Die harte Abschottung gilt nur für **Werkzeuge** (exec/read/write/edit/apply_patch).
- Host-only-Werkzeuge wie Browser/Kamera/Canvas sind standardmäßig blockiert.
- Das Erlauben von `browser` in der Sandbox **bricht die Isolation** (Browser läuft auf dem Host).

## Fehlerbehebung

- Image fehlt: Bauen mit [`scripts/sandbox-setup.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/sandbox-setup.sh)
  oder setzen Sie `agents.defaults.sandbox.docker.image`.
- Container läuft nicht: Er wird bei Bedarf pro Sitzung automatisch erstellt.
- Berechtigungsfehler in der Sandbox: Setzen Sie `docker.user` auf eine UID:GID,
  die zur Eigentümerschaft Ihres gemounteten Workspaces passt (oder führen Sie chown
  für den Workspace-Ordner aus).
- Benutzerdefinierte Werkzeuge nicht gefunden: OpenClaw führt Befehle mit
  `sh -lc` (Login-Shell) aus, die `/etc/profile` sourced und PATH ggf.
  zurücksetzt. Setzen Sie `docker.env.PATH`, um Ihre benutzerdefinierten Tool-Pfade
  voranzustellen (z. B. `/custom/bin:/usr/local/share/npm-global/bin`), oder fügen Sie ein Skript unter
  `/etc/profile.d/` in Ihrem Dockerfile hinzu.
