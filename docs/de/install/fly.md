---
title: Fly.io
description: Deploy OpenClaw on Fly.io
x-i18n:
  source_path: install/fly.md
  source_hash: 148f8e3579f185f1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:53Z
---

# Fly.io-Bereitstellung

**Ziel:** OpenClaw Gateway läuft auf einer [Fly.io](https://fly.io)-Maschine mit persistentem Speicher, automatischem HTTPS und Discord-/Kanalzugriff.

## Was Sie benötigen

- Installierte [flyctl CLI](https://fly.io/docs/hands-on/install-flyctl/)
- Fly.io-Konto (Free-Tier funktioniert)
- Modell-Authentifizierung: Anthropic-API-Schlüssel (oder andere Anbieter-Schlüssel)
- Kanal-Zugangsdaten: Discord-Bot-Token, Telegram-Token usw.

## Schnellstart für Einsteiger

1. Repository klonen → `fly.toml` anpassen
2. App + Volume erstellen → Secrets setzen
3. Mit `fly deploy` deployen
4. Per SSH einloggen, um die Konfiguration zu erstellen, oder die Control UI verwenden

## 1) Fly-App erstellen

```bash
# Clone the repo
git clone https://github.com/openclaw/openclaw.git
cd openclaw

# Create a new Fly app (pick your own name)
fly apps create my-openclaw

# Create a persistent volume (1GB is usually enough)
fly volumes create openclaw_data --size 1 --region iad
```

**Tipp:** Wählen Sie eine Region in Ihrer Nähe. Gängige Optionen: `lhr` (London), `iad` (Virginia), `sjc` (San Jose).

## 2) fly.toml konfigurieren

Bearbeiten Sie `fly.toml`, sodass es zu Ihrem App-Namen und Ihren Anforderungen passt.

**Sicherheitshinweis:** Die Standardkonfiguration stellt eine öffentliche URL bereit. Für eine gehärtete Bereitstellung ohne öffentliche IP siehe [Private Bereitstellung](#private-deployment-hardened) oder verwenden Sie `fly.private.toml`.

```toml
app = "my-openclaw"  # Your app name
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  OPENCLAW_PREFER_PNPM = "1"
  OPENCLAW_STATE_DIR = "/data"
  NODE_OPTIONS = "--max-old-space-size=1536"

[processes]
  app = "node dist/index.js gateway --allow-unconfigured --port 3000 --bind lan"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[[vm]]
  size = "shared-cpu-2x"
  memory = "2048mb"

[mounts]
  source = "openclaw_data"
  destination = "/data"
```

**Zentrale Einstellungen:**

| Einstellung                    | Warum                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `--bind lan`                   | Bindet an `0.0.0.0`, damit der Fly-Proxy das Gateway erreichen kann                |
| `--allow-unconfigured`         | Startet ohne Konfigurationsdatei (Sie erstellen diese später)                      |
| `internal_port = 3000`         | Muss `--port 3000` (oder `OPENCLAW_GATEWAY_PORT`) entsprechen für Fly-Healthchecks |
| `memory = "2048mb"`            | 512 MB sind zu wenig; 2 GB empfohlen                                               |
| `OPENCLAW_STATE_DIR = "/data"` | Persistiert den Zustand auf dem Volume                                             |

## 3) Secrets setzen

```bash
# Required: Gateway token (for non-loopback binding)
fly secrets set OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)

# Model provider API keys
fly secrets set ANTHROPIC_API_KEY=sk-ant-...

# Optional: Other providers
fly secrets set OPENAI_API_KEY=sk-...
fly secrets set GOOGLE_API_KEY=...

# Channel tokens
fly secrets set DISCORD_BOT_TOKEN=MTQ...
```

**Hinweise:**

- Nicht-Loopback-Bindings (`--bind lan`) erfordern `OPENCLAW_GATEWAY_TOKEN` aus Sicherheitsgründen.
- Behandeln Sie diese Tokens wie Passwörter.
- **Bevorzugen Sie Umgebungsvariablen gegenüber der Konfigurationsdatei** für alle API-Schlüssel und Tokens. So bleiben Secrets aus `openclaw.json` heraus, wo sie versehentlich offengelegt oder geloggt werden könnten.

## 4) Deployen

```bash
fly deploy
```

Der erste Deploy erstellt das Docker-Image (~2–3 Minuten). Nachfolgende Deploys sind schneller.

Nach der Bereitstellung prüfen Sie:

```bash
fly status
fly logs
```

Sie sollten Folgendes sehen:

```
[gateway] listening on ws://0.0.0.0:3000 (PID xxx)
[discord] logged in to discord as xxx
```

## 5) Konfigurationsdatei erstellen

Melden Sie sich per SSH auf der Maschine an, um eine passende Konfiguration zu erstellen:

```bash
fly ssh console
```

Erstellen Sie das Konfigurationsverzeichnis und die Datei:

```bash
mkdir -p /data
cat > /data/openclaw.json << 'EOF'
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-opus-4-6",
        "fallbacks": ["anthropic/claude-sonnet-4-5", "openai/gpt-4o"]
      },
      "maxConcurrent": 4
    },
    "list": [
      {
        "id": "main",
        "default": true
      }
    ]
  },
  "auth": {
    "profiles": {
      "anthropic:default": { "mode": "token", "provider": "anthropic" },
      "openai:default": { "mode": "token", "provider": "openai" }
    }
  },
  "bindings": [
    {
      "agentId": "main",
      "match": { "channel": "discord" }
    }
  ],
  "channels": {
    "discord": {
      "enabled": true,
      "groupPolicy": "allowlist",
      "guilds": {
        "YOUR_GUILD_ID": {
          "channels": { "general": { "allow": true } },
          "requireMention": false
        }
      }
    }
  },
  "gateway": {
    "mode": "local",
    "bind": "auto"
  },
  "meta": {
    "lastTouchedVersion": "2026.1.29"
  }
}
EOF
```

**Hinweis:** Mit `OPENCLAW_STATE_DIR=/data` ist der Konfigurationspfad `/data/openclaw.json`.

**Hinweis:** Das Discord-Token kann aus einer der folgenden Quellen stammen:

- Umgebungsvariable: `DISCORD_BOT_TOKEN` (empfohlen für Secrets)
- Konfigurationsdatei: `channels.discord.token`

Wenn Sie die Umgebungsvariable verwenden, müssen Sie das Token nicht zur Konfiguration hinzufügen. Das Gateway liest `DISCORD_BOT_TOKEN` automatisch.

Zum Anwenden neu starten:

```bash
exit
fly machine restart <machine-id>
```

## 6) Zugriff auf das Gateway

### Control UI

Im Browser öffnen:

```bash
fly open
```

Oder besuchen Sie `https://my-openclaw.fly.dev/`

Fügen Sie Ihr Gateway-Token ein (das aus `OPENCLAW_GATEWAY_TOKEN`), um sich zu authentifizieren.

### Logs

```bash
fly logs              # Live logs
fly logs --no-tail    # Recent logs
```

### SSH-Konsole

```bash
fly ssh console
```

## Fehlerbehebung

### „App is not listening on expected address“

Das Gateway bindet an `127.0.0.1` statt an `0.0.0.0`.

**Lösung:** Fügen Sie `--bind lan` zu Ihrem Prozessbefehl in `fly.toml` hinzu.

### Healthchecks schlagen fehl / Verbindung verweigert

Fly kann das Gateway auf dem konfigurierten Port nicht erreichen.

**Lösung:** Stellen Sie sicher, dass `internal_port` dem Gateway-Port entspricht (setzen Sie `--port 3000` oder `OPENCLAW_GATEWAY_PORT=3000`).

### OOM-/Speicherprobleme

Der Container startet ständig neu oder wird beendet. Anzeichen: `SIGABRT`, `v8::internal::Runtime_AllocateInYoungGeneration` oder stille Neustarts.

**Lösung:** Erhöhen Sie den Speicher in `fly.toml`:

```toml
[[vm]]
  memory = "2048mb"
```

Oder aktualisieren Sie eine bestehende Maschine:

```bash
fly machine update <machine-id> --vm-memory 2048 -y
```

**Hinweis:** 512 MB sind zu wenig. 1 GB kann funktionieren, aber unter Last oder mit ausführlichem Logging zu OOM führen. **2 GB werden empfohlen.**

### Gateway-Sperrprobleme

Das Gateway startet nicht und meldet „already running“-Fehler.

Dies passiert, wenn der Container neu startet, die PID-Sperrdatei jedoch auf dem Volume bestehen bleibt.

**Lösung:** Löschen Sie die Sperrdatei:

```bash
fly ssh console --command "rm -f /data/gateway.*.lock"
fly machine restart <machine-id>
```

Die Sperrdatei befindet sich unter `/data/gateway.*.lock` (nicht in einem Unterverzeichnis).

### Konfiguration wird nicht gelesen

Wenn `--allow-unconfigured` verwendet wird, erstellt das Gateway eine minimale Konfiguration. Ihre benutzerdefinierte Konfiguration unter `/data/openclaw.json` sollte nach einem Neustart gelesen werden.

Prüfen Sie, ob die Konfiguration existiert:

```bash
fly ssh console --command "cat /data/openclaw.json"
```

### Konfiguration per SSH schreiben

Der Befehl `fly ssh console -C` unterstützt keine Shell-Umleitung. Um eine Konfigurationsdatei zu schreiben:

```bash
# Use echo + tee (pipe from local to remote)
echo '{"your":"config"}' | fly ssh console -C "tee /data/openclaw.json"

# Or use sftp
fly sftp shell
> put /local/path/config.json /data/openclaw.json
```

**Hinweis:** `fly sftp` kann fehlschlagen, wenn die Datei bereits existiert. Löschen Sie sie zuerst:

```bash
fly ssh console --command "rm /data/openclaw.json"
```

### Zustand wird nicht persistiert

Wenn Sie nach einem Neustart Zugangsdaten oder Sitzungen verlieren, schreibt das Zustandsverzeichnis in das Container-Dateisystem.

**Lösung:** Stellen Sie sicher, dass `OPENCLAW_STATE_DIR=/data` in `fly.toml` gesetzt ist, und deployen Sie erneut.

## Updates

```bash
# Pull latest changes
git pull

# Redeploy
fly deploy

# Check health
fly status
fly logs
```

### Maschinenbefehl aktualisieren

Wenn Sie den Startbefehl ohne vollständigen Redeploy ändern müssen:

```bash
# Get machine ID
fly machines list

# Update command
fly machine update <machine-id> --command "node dist/index.js gateway --port 3000 --bind lan" -y

# Or with memory increase
fly machine update <machine-id> --vm-memory 2048 --command "node dist/index.js gateway --port 3000 --bind lan" -y
```

**Hinweis:** Nach `fly deploy` kann der Maschinenbefehl auf den in `fly.toml` zurückgesetzt werden. Wenn Sie manuelle Änderungen vorgenommen haben, wenden Sie diese nach dem Deploy erneut an.

## Private Bereitstellung (gehärtet)

Standardmäßig weist Fly öffentliche IPs zu, wodurch Ihr Gateway unter `https://your-app.fly.dev` erreichbar ist. Das ist bequem, bedeutet aber, dass Ihre Bereitstellung für Internet-Scanner (Shodan, Censys usw.) auffindbar ist.

Für eine gehärtete Bereitstellung **ohne öffentliche Exposition** verwenden Sie die private Vorlage.

### Wann eine private Bereitstellung sinnvoll ist

- Sie tätigen ausschließlich **ausgehende** Aufrufe/Nachrichten (keine eingehenden Webhooks)
- Sie verwenden **ngrok- oder Tailscale**-Tunnel für Webhook-Callbacks
- Sie greifen auf das Gateway über **SSH, Proxy oder WireGuard** statt per Browser zu
- Sie möchten die Bereitstellung **vor Internet-Scannern verbergen**

### Einrichtung

Verwenden Sie `fly.private.toml` anstelle der Standardkonfiguration:

```bash
# Deploy with private config
fly deploy -c fly.private.toml
```

Oder konvertieren Sie eine bestehende Bereitstellung:

```bash
# List current IPs
fly ips list -a my-openclaw

# Release public IPs
fly ips release <public-ipv4> -a my-openclaw
fly ips release <public-ipv6> -a my-openclaw

# Switch to private config so future deploys don't re-allocate public IPs
# (remove [http_service] or deploy with the private template)
fly deploy -c fly.private.toml

# Allocate private-only IPv6
fly ips allocate-v6 --private -a my-openclaw
```

Danach sollte `fly ips list` nur eine IP vom Typ `private` anzeigen:

```
VERSION  IP                   TYPE             REGION
v6       fdaa:x:x:x:x::x      private          global
```

### Zugriff auf eine private Bereitstellung

Da es keine öffentliche URL gibt, verwenden Sie eine der folgenden Methoden:

**Option 1: Lokaler Proxy (am einfachsten)**

```bash
# Forward local port 3000 to the app
fly proxy 3000:3000 -a my-openclaw

# Then open http://localhost:3000 in browser
```

**Option 2: WireGuard-VPN**

```bash
# Create WireGuard config (one-time)
fly wireguard create

# Import to WireGuard client, then access via internal IPv6
# Example: http://[fdaa:x:x:x:x::x]:3000
```

**Option 3: Nur SSH**

```bash
fly ssh console -a my-openclaw
```

### Webhooks mit privater Bereitstellung

Wenn Sie Webhook-Callbacks (Twilio, Telnyx usw.) ohne öffentliche Exposition benötigen:

1. **ngrok-Tunnel** – Führen Sie ngrok im Container oder als Sidecar aus
2. **Tailscale Funnel** – Stellen Sie bestimmte Pfade über Tailscale bereit
3. **Nur ausgehend** – Einige Anbieter (Twilio) funktionieren für ausgehende Anrufe auch ohne Webhooks

Beispiel einer Sprachruf-Konfiguration mit ngrok:

```json
{
  "plugins": {
    "entries": {
      "voice-call": {
        "enabled": true,
        "config": {
          "provider": "twilio",
          "tunnel": { "provider": "ngrok" },
          "webhookSecurity": {
            "allowedHosts": ["example.ngrok.app"]
          }
        }
      }
    }
  }
}
```

Der ngrok-Tunnel läuft im Container und stellt eine öffentliche Webhook-URL bereit, ohne die Fly-App selbst offenzulegen. Setzen Sie `webhookSecurity.allowedHosts` auf den öffentlichen Tunnel-Hostnamen, damit weitergeleitete Host-Header akzeptiert werden.

### Sicherheitsvorteile

| Aspekt             | Öffentlich | Privat      |
| ------------------ | ---------- | ----------- |
| Internet-Scanner   | Auffindbar | Versteckt   |
| Direkte Angriffe   | Möglich    | Blockiert   |
| Control-UI-Zugriff | Browser    | Proxy/VPN   |
| Webhook-Zustellung | Direkt     | Über Tunnel |

## Hinweise

- Fly.io verwendet **x86-Architektur** (nicht ARM)
- Das Dockerfile ist mit beiden Architekturen kompatibel
- Für WhatsApp-/Telegram-Einführung verwenden Sie `fly ssh console`
- Persistente Daten liegen auf dem Volume unter `/data`
- Signal erfordert Java + signal-cli; verwenden Sie ein benutzerdefiniertes Image und halten Sie den Speicher bei 2 GB+.

## Kosten

Mit der empfohlenen Konfiguration (`shared-cpu-2x`, 2 GB RAM):

- ~10–15 USD/Monat je nach Nutzung
- Das Free-Tier enthält ein gewisses Kontingent

Siehe [Fly.io-Preise](https://fly.io/docs/about/pricing/) für Details.
