---
summary: "Bonjour-/mDNS-Erkennung + Fehleranalyse (Gateway-Beacons, Clients und haeufige Fehlermodi)"
read_when:
  - Fehlerbehebung bei Bonjour-Erkennungsproblemen unter macOS/iOS
  - Aendern von mDNS-Servicetypen, TXT-Records oder der Discovery-UX
title: "Bonjour-Erkennung"
x-i18n:
  source_path: gateway/bonjour.md
  source_hash: 47569da55f0c0523
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:25Z
---

# Bonjour- / mDNS-Erkennung

OpenClaw verwendet Bonjour (mDNS / DNS‑SD) als **reine LAN‑Komfortfunktion**, um
ein aktives Gateway (WebSocket-Endpunkt) zu entdecken. Dies ist Best‑Effort und
ersetzt **nicht** SSH oder Tailnet-basierte Konnektivitaet.

## Wide‑Area Bonjour (Unicast DNS‑SD) ueber Tailscale

Befinden sich Node und Gateway in unterschiedlichen Netzwerken, ueberquert
multicast mDNS diese Grenze nicht. Sie koennen die gleiche Discovery-UX
beibehalten, indem Sie zu **Unicast DNS‑SD** („Wide‑Area Bonjour“) ueber
Tailscale wechseln.

High‑Level‑Schritte:

1. Betreiben Sie einen DNS-Server auf dem Gateway-Host (ueber das Tailnet erreichbar).
2. Veröffentlichen Sie DNS‑SD‑Records fuer `_openclaw-gw._tcp` unter einer dedizierten Zone
   (Beispiel: `openclaw.internal.`).
3. Konfigurieren Sie Tailscale **Split DNS**, sodass Ihre gewaehlte Domain fuer
   Clients (einschliesslich iOS) ueber diesen DNS-Server aufgeloest wird.

OpenClaw unterstuetzt jede Discovery-Domain; `openclaw.internal.` ist nur ein Beispiel.
iOS-/Android-Nodes durchsuchen sowohl `local.` als auch Ihre konfigurierte
Wide‑Area-Domain.

### Gateway-Konfiguration (empfohlen)

```json5
{
  gateway: { bind: "tailnet" }, // tailnet-only (recommended)
  discovery: { wideArea: { enabled: true } }, // enables wide-area DNS-SD publishing
}
```

### Einmalige DNS-Server-Einrichtung (Gateway-Host)

```bash
openclaw dns setup --apply
```

Dies installiert CoreDNS und konfiguriert es so, dass es:

- auf Port 53 ausschliesslich auf den Tailscale-Interfaces des Gateways lauscht
- Ihre gewaehlte Domain (Beispiel: `openclaw.internal.`) aus `~/.openclaw/dns/<domain>.db` bereitstellt

Validieren Sie dies von einer mit dem Tailnet verbundenen Maschine:

```bash
dns-sd -B _openclaw-gw._tcp openclaw.internal.
dig @<TAILNET_IPV4> -p 53 _openclaw-gw._tcp.openclaw.internal PTR +short
```

### Tailscale-DNS-Einstellungen

In der Tailscale-Admin-Konsole:

- Fuegen Sie einen Nameserver hinzu, der auf die Tailnet-IP des Gateways zeigt (UDP/TCP 53).
- Fuegen Sie Split DNS hinzu, sodass Ihre Discovery-Domain diesen Nameserver verwendet.

Sobald Clients die Tailnet-DNS-Einstellungen akzeptieren, koennen iOS-Nodes
`_openclaw-gw._tcp` in Ihrer Discovery-Domain ohne Multicast durchsuchen.

### Sicherheit des Gateway-Listeners (empfohlen)

Der Gateway-WS-Port (Standard `18789`) bindet standardmaessig an Loopback.
Fuer LAN-/Tailnet-Zugriff binden Sie explizit und lassen die Authentifizierung aktiviert.

Fuer reine Tailnet-Setups:

- Setzen Sie `gateway.bind: "tailnet"` in `~/.openclaw/openclaw.json`.
- Starten Sie das Gateway neu (oder starten Sie die macOS-Menueleisten-App neu).

## Was bewirbt

Nur das Gateway bewirbt `_openclaw-gw._tcp`.

## Servicetypen

- `_openclaw-gw._tcp` — Gateway-Transport-Beacon (verwendet von macOS-/iOS-/Android-Nodes).

## TXT-Schluessel (nicht geheime Hinweise)

Das Gateway bewirbt kleine, nicht geheime Hinweise, um UI-Abläufe komfortabel zu gestalten:

- `role=gateway`
- `displayName=<friendly name>`
- `lanHost=<hostname>.local`
- `gatewayPort=<port>` (Gateway WS + HTTP)
- `gatewayTls=1` (nur wenn TLS aktiviert ist)
- `gatewayTlsSha256=<sha256>` (nur wenn TLS aktiviert ist und ein Fingerabdruck verfuegbar ist)
- `canvasPort=<port>` (nur wenn der Canvas-Host aktiviert ist; Standard `18793`)
- `sshPort=<port>` (Standard ist 22, wenn nicht ueberschrieben)
- `transport=gateway`
- `cliPath=<path>` (optional; absoluter Pfad zu einem ausfuehrbaren `openclaw`-Entrypoint)
- `tailnetDns=<magicdns>` (optionaler Hinweis, wenn Tailnet verfuegbar ist)

## Fehlerbehebung unter macOS

Nuetzliche integrierte Werkzeuge:

- Instanzen durchsuchen:
  ```bash
  dns-sd -B _openclaw-gw._tcp local.
  ```
- Eine Instanz aufloesen (ersetzen Sie `<instance>`):
  ```bash
  dns-sd -L "<instance>" _openclaw-gw._tcp local.
  ```

Wenn das Durchsuchen funktioniert, das Aufloesen jedoch fehlschlaegt, liegt in der
Regel eine LAN-Richtlinie oder ein mDNS-Resolver-Problem vor.

## Fehlerbehebung in Gateway-Logs

Das Gateway schreibt eine rollierende Logdatei (beim Start ausgegeben als
`gateway log file: ...`). Achten Sie auf `bonjour:`-Zeilen, insbesondere:

- `bonjour: advertise failed ...`
- `bonjour: ... name conflict resolved` / `hostname conflict resolved`
- `bonjour: watchdog detected non-announced service ...`

## Fehlerbehebung auf dem iOS-Node

Der iOS-Node verwendet `NWBrowser`, um `_openclaw-gw._tcp` zu entdecken.

So erfassen Sie Logs:

- Einstellungen → Gateway → Erweitert → **Discovery-Debug-Logs**
- Einstellungen → Gateway → Erweitert → **Discovery-Logs** → reproduzieren → **Kopieren**

Das Log enthaelt Zustandsuebergaenge des Browsers und Aenderungen der Ergebnismenge.

## Haeufige Fehlermodi

- **Bonjour ueberquert keine Netzwerke**: Verwenden Sie Tailnet oder SSH.
- **Multicast blockiert**: Einige WLAN-Netzwerke deaktivieren mDNS.
- **Ruhezustand / Interface-Wechsel**: macOS kann mDNS-Ergebnisse temporaer verlieren; erneut versuchen.
- **Durchsuchen funktioniert, Aufloesen nicht**: Halten Sie Rechnernamen einfach (vermeiden Sie Emojis oder
  Satzzeichen) und starten Sie dann das Gateway neu. Der Service-Instanzname leitet
  sich vom Hostnamen ab; zu komplexe Namen koennen einige Resolver verwirren.

## Escapete Instanznamen (`\032`)

Bonjour/DNS‑SD escaped haeufig Bytes in Service-Instanznamen als dezimale `\DDD`-
Sequenzen (z. B. werden Leerzeichen zu `\032`).

- Dies ist auf Protokollebene normal.
- UIs sollten fuer die Anzeige decodieren (iOS verwendet `BonjourEscapes.decode`).

## Deaktivieren / Konfiguration

- `OPENCLAW_DISABLE_BONJOUR=1` deaktiviert die Bewerbung (Legacy: `OPENCLAW_DISABLE_BONJOUR`).
- `gateway.bind` in `~/.openclaw/openclaw.json` steuert den Bind-Modus des Gateways.
- `OPENCLAW_SSH_PORT` ueberschreibt den in TXT beworbenen SSH-Port (Legacy: `OPENCLAW_SSH_PORT`).
- `OPENCLAW_TAILNET_DNS` veroeffentlicht einen MagicDNS-Hinweis in TXT (Legacy: `OPENCLAW_TAILNET_DNS`).
- `OPENCLAW_CLI_PATH` ueberschreibt den beworbenen CLI-Pfad (Legacy: `OPENCLAW_CLI_PATH`).

## Zugehoerige Dokumente

- Discovery-Richtlinie und Transportauswahl: [Discovery](/gateway/discovery)
- Node-Pairing + Genehmigungen: [Gateway-Pairing](/gateway/pairing)
