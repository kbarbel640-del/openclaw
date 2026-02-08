---
summary: "OpenClaw Gateway CLI (`openclaw gateway`) — Gateways ausfuehren, abfragen und entdecken"
read_when:
  - Ausfuehren des Gateways ueber die CLI (Entwicklung oder Server)
  - Debugging von Gateway-Authentifizierung, Bind-Modi und Konnektivitaet
  - Entdecken von Gateways ueber Bonjour (LAN + Tailnet)
title: "gateway"
x-i18n:
  source_path: cli/gateway.md
  source_hash: cbc1690e6be84073
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:53Z
---

# Gateway CLI

Das Gateway ist der WebSocket-Server von OpenClaw (Kanaele, Knoten, Sitzungen, Hooks).

Unterbefehle auf dieser Seite befinden sich unter `openclaw gateway …`.

Zugehoerige Dokumente:

- [/gateway/bonjour](/gateway/bonjour)
- [/gateway/discovery](/gateway/discovery)
- [/gateway/configuration](/gateway/configuration)

## Gateway ausfuehren

Einen lokalen Gateway-Prozess starten:

```bash
openclaw gateway
```

Alias im Vordergrund:

```bash
openclaw gateway run
```

Hinweise:

- Standardmaessig verweigert das Gateway den Start, sofern `gateway.mode=local` nicht in `~/.openclaw/openclaw.json` gesetzt ist. Verwenden Sie `--allow-unconfigured` fuer Ad-hoc-/Entwicklungslaeufe.
- Binden ueber loopback hinaus ohne Authentifizierung ist blockiert (Sicherheitsleitplanke).
- `SIGUSR1` loest bei Autorisierung einen In-Process-Neustart aus (aktivieren Sie `commands.restart` oder verwenden Sie das Gateway-Werkzeug/config apply/update).
- `SIGINT`/`SIGTERM`-Handler stoppen den Gateway-Prozess, stellen jedoch keinen benutzerdefinierten Terminalzustand wieder her. Wenn Sie die CLI mit einer TUI oder Raw-Mode-Eingabe umhuellen, stellen Sie das Terminal vor dem Beenden wieder her.

### Optionen

- `--port <port>`: WebSocket-Port (Standard kommt aus Konfiguration/Umgebung; meist `18789`).
- `--bind <loopback|lan|tailnet|auto|custom>`: Listener-Bind-Modus.
- `--auth <token|password>`: Ueberschreibung des Authentifizierungsmodus.
- `--token <token>`: Token-Ueberschreibung (setzt auch `OPENCLAW_GATEWAY_TOKEN` fuer den Prozess).
- `--password <password>`: Passwort-Ueberschreibung (setzt auch `OPENCLAW_GATEWAY_PASSWORD` fuer den Prozess).
- `--tailscale <off|serve|funnel>`: Gateway ueber Tailscale exponieren.
- `--tailscale-reset-on-exit`: Tailscale-Serve/Funnel-Konfiguration beim Herunterfahren zuruecksetzen.
- `--allow-unconfigured`: Gateway-Start ohne `gateway.mode=local` in der Konfiguration erlauben.
- `--dev`: Dev-Konfiguration + Workspace erstellen, falls fehlend (ueberspringt BOOTSTRAP.md).
- `--reset`: Dev-Konfiguration + Anmeldedaten + Sitzungen + Workspace zuruecksetzen (erfordert `--dev`).
- `--force`: Vor dem Start vorhandenen Listener auf dem ausgewaehlten Port beenden.
- `--verbose`: Ausfuehrliche Logs.
- `--claude-cli-logs`: Nur claude-cli-Logs in der Konsole anzeigen (und dessen stdout/stderr aktivieren).
- `--ws-log <auto|full|compact>`: WebSocket-Logstil (Standard `auto`).
- `--compact`: Alias fuer `--ws-log compact`.
- `--raw-stream`: Roh-Model-Stream-Ereignisse in jsonl protokollieren.
- `--raw-stream-path <path>`: Pfad fuer Raw-Stream-jsonl.

## Einen laufenden Gateway abfragen

Alle Abfragebefehle verwenden WebSocket-RPC.

Ausgabemodi:

- Standard: menschenlesbar (farbig im TTY).
- `--json`: maschinenlesbares JSON (keine Stile/Spinner).
- `--no-color` (oder `NO_COLOR=1`): ANSI deaktivieren bei Beibehaltung des menschenlesbaren Layouts.

Gemeinsame Optionen (wo unterstuetzt):

- `--url <url>`: Gateway-WebSocket-URL.
- `--token <token>`: Gateway-Token.
- `--password <password>`: Gateway-Passwort.
- `--timeout <ms>`: Timeout/Budget (variiert je Befehl).
- `--expect-final`: Auf eine „finale“ Antwort warten (Agent-Aufrufe).

Hinweis: Wenn Sie `--url` setzen, faellt die CLI nicht auf Konfigurations- oder Umgebungs-Anmeldedaten zurueck.
Uebergeben Sie `--token` oder `--password` explizit. Fehlende explizite Anmeldedaten sind ein Fehler.

### `gateway health`

```bash
openclaw gateway health --url ws://127.0.0.1:18789
```

### `gateway status`

`gateway status` zeigt den Gateway-Dienst (launchd/systemd/schtasks) plus eine optionale RPC-Sonde.

```bash
openclaw gateway status
openclaw gateway status --json
```

Optionen:

- `--url <url>`: Sonden-URL ueberschreiben.
- `--token <token>`: Token-Authentifizierung fuer die Sonde.
- `--password <password>`: Passwort-Authentifizierung fuer die Sonde.
- `--timeout <ms>`: Sonden-Timeout (Standard `10000`).
- `--no-probe`: RPC-Sonde ueberspringen (nur Dienstansicht).
- `--deep`: Auch systemweite Dienste scannen.

### `gateway probe`

`gateway probe` ist der „Alles debuggen“-Befehl. Er sondiert immer:

- Ihr konfiguriertes Remote-Gateway (falls gesetzt) und
- localhost (loopback) **auch wenn ein Remote-Gateway konfiguriert ist**.

Wenn mehrere Gateways erreichbar sind, werden alle ausgegeben. Mehrere Gateways werden unterstuetzt, wenn Sie isolierte Profile/Ports verwenden (z. B. ein Rescue-Bot), aber die meisten Installationen betreiben weiterhin ein einzelnes Gateway.

```bash
openclaw gateway probe
openclaw gateway probe --json
```

#### Remote ueber SSH (macOS-App-Paritaet)

Der macOS-App-Modus „Remote over SSH“ verwendet eine lokale Portweiterleitung, sodass das Remote-Gateway (das ggf. nur an loopback gebunden ist) unter `ws://127.0.0.1:<port>` erreichbar wird.

CLI-Aequivalent:

```bash
openclaw gateway probe --ssh user@gateway-host
```

Optionen:

- `--ssh <target>`: `user@host` oder `user@host:port` (Port-Standard `22`).
- `--ssh-identity <path>`: Identity-Datei.
- `--ssh-auto`: Ersten entdeckten Gateway-Host als SSH-Ziel waehlen (nur LAN/WAB).

Konfiguration (optional, als Standardwerte verwendet):

- `gateway.remote.sshTarget`
- `gateway.remote.sshIdentity`

### `gateway call <method>`

Low-Level-RPC-Helfer.

```bash
openclaw gateway call status
openclaw gateway call logs.tail --params '{"sinceMs": 60000}'
```

## Gateway-Dienst verwalten

```bash
openclaw gateway install
openclaw gateway start
openclaw gateway stop
openclaw gateway restart
openclaw gateway uninstall
```

Hinweise:

- `gateway install` unterstuetzt `--port`, `--runtime`, `--token`, `--force`, `--json`.
- Lifecycle-Befehle akzeptieren `--json` fuer Skripting.

## Gateways entdecken (Bonjour)

`gateway discover` scannt nach Gateway-Beacons (`_openclaw-gw._tcp`).

- Multicast DNS-SD: `local.`
- Unicast DNS-SD (Wide-Area Bonjour): Waehlen Sie eine Domain (Beispiel: `openclaw.internal.`) und richten Sie Split-DNS + einen DNS-Server ein; siehe [/gateway/bonjour](/gateway/bonjour)

Nur Gateways mit aktivierter Bonjour-Erkennung (Standard) bewerben das Beacon.

Wide-Area-Erkennungsdatensaetze enthalten (TXT):

- `role` (Gateway-Rollenhinweis)
- `transport` (Transporthinweis, z. B. `gateway`)
- `gatewayPort` (WebSocket-Port, meist `18789`)
- `sshPort` (SSH-Port; Standard `22`, falls nicht vorhanden)
- `tailnetDns` (MagicDNS-Hostname, falls verfuegbar)
- `gatewayTls` / `gatewayTlsSha256` (TLS aktiviert + Zertifikats-Fingerprint)
- `cliPath` (optionaler Hinweis fuer Remote-Installationen)

### `gateway discover`

```bash
openclaw gateway discover
```

Optionen:

- `--timeout <ms>`: Timeout pro Befehl (Browse/Resolve); Standard `2000`.
- `--json`: maschinenlesbare Ausgabe (deaktiviert auch Styling/Spinner).

Beispiele:

```bash
openclaw gateway discover --timeout 4000
openclaw gateway discover --json | jq '.beacons[].wsUrl'
```
