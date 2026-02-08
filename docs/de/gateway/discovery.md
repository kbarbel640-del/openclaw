---
summary: "Node-Erkennung und Transports (Bonjour, Tailscale, SSH) zum Auffinden des Gateways"
read_when:
  - Implementierung oder Aenderung der Bonjour-Erkennung/-Ankuendigung
  - Anpassung von Remote-Verbindungsmodi (direkt vs. SSH)
  - Entwurf der Node-Erkennung + Paarung fuer Remote-Nodes
title: "Erkennung und Transports"
x-i18n:
  source_path: gateway/discovery.md
  source_hash: e12172c181515bfa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:28Z
---

# Erkennung & Transports

OpenClaw hat zwei unterschiedliche Probleme, die auf den ersten Blick aehnlich aussehen:

1. **Operator-Fernsteuerung**: die macOS-Menueleisten-App steuert ein Gateway, das anderswo laeuft.
2. **Node-Paarung**: iOS/Android (und zukuenftige Nodes) finden ein Gateway und paaren sich sicher.

Das Designziel ist, saemtliche Netzwerk-Erkennung/-Ankuendigung im **Node Gateway** (`openclaw gateway`) zu halten und Clients (Mac-App, iOS) als Konsumenten zu belassen.

## Begriffe

- **Gateway**: ein einzelner, lang laufender Gateway-Prozess, der den Zustand (Sitzungen, Paarung, Node-Register) besitzt und Kanaele ausfuehrt. Die meisten Setups verwenden einen pro Host; isolierte Multi-Gateway-Setups sind moeglich.
- **Gateway WS (Kontrollebene)**: der WebSocket-Endpunkt auf `127.0.0.1:18789` standardmaessig; kann via `gateway.bind` an LAN/Tailnet gebunden werden.
- **Direkter WS-Transport**: ein LAN-/Tailnet-seitiger Gateway-WS-Endpunkt (kein SSH).
- **SSH-Transport (Fallback)**: Fernsteuerung durch Weiterleitung von `127.0.0.1:18789` ueber SSH.
- **Legacy TCP-Bridge (veraltet/entfernt)**: aelterer Node-Transport (siehe [Bridge protocol](/gateway/bridge-protocol)); wird nicht mehr zur Erkennung angekuendigt.

Protokolldetails:

- [Gateway protocol](/gateway/protocol)
- [Bridge protocol (legacy)](/gateway/bridge-protocol)

## Warum wir sowohl „direkt“ als auch SSH behalten

- **Direkter WS** bietet die beste UX im selben Netzwerk und innerhalb eines Tailnets:
  - Auto-Erkennung im LAN via Bonjour
  - Paarungs-Tokens + ACLs im Besitz des Gateways
  - kein Shell-Zugriff erforderlich; die Protokolloberflaeche kann schlank und auditierbar bleiben
- **SSH** bleibt der universelle Fallback:
  - funktioniert ueberall, wo Sie SSH-Zugriff haben (selbst ueber nicht zusammenhaengende Netzwerke hinweg)
  - uebersteht Multicast-/mDNS-Probleme
  - erfordert keine neuen eingehenden Ports ausser SSH

## Erkennungs-Inputs (wie Clients erfahren, wo sich das Gateway befindet)

### 1) Bonjour / mDNS (nur LAN)

Bonjour ist Best-Effort und ueberschreitet keine Netzwerke. Es wird nur fuer „gleiches LAN“-Bequemlichkeit genutzt.

Zielrichtung:

- Das **Gateway** kuendigt seinen WS-Endpunkt via Bonjour an.
- Clients durchsuchen und zeigen eine „Gateway auswaehlen“-Liste an und speichern dann den gewaehlten Endpunkt.

Fehlerbehebung und Beacon-Details: [Bonjour](/gateway/bonjour).

#### Service-Beacon-Details

- Service-Typen:
  - `_openclaw-gw._tcp` (Gateway-Transport-Beacon)
- TXT-Schluessel (nicht geheim):
  - `role=gateway`
  - `lanHost=<hostname>.local`
  - `sshPort=22` (oder was auch immer angekuendigt wird)
  - `gatewayPort=18789` (Gateway WS + HTTP)
  - `gatewayTls=1` (nur wenn TLS aktiviert ist)
  - `gatewayTlsSha256=<sha256>` (nur wenn TLS aktiviert ist und ein Fingerabdruck verfuegbar ist)
  - `canvasPort=18793` (Standard-Canvas-Host-Port; bedient `/__openclaw__/canvas/`)
  - `cliPath=<path>` (optional; absoluter Pfad zu einem ausfuehrbaren `openclaw`-Entrypoint oder Binary)
  - `tailnetDns=<magicdns>` (optionaler Hinweis; automatisch erkannt, wenn Tailscale verfuegbar ist)

Deaktivieren/Ueberschreiben:

- `OPENCLAW_DISABLE_BONJOUR=1` deaktiviert die Ankuendigung.
- `gateway.bind` in `~/.openclaw/openclaw.json` steuert den Gateway-Bind-Modus.
- `OPENCLAW_SSH_PORT` ueberschreibt den in TXT angekuendigten SSH-Port (Standard: 22).
- `OPENCLAW_TAILNET_DNS` veroeffentlicht einen `tailnetDns`-Hinweis (MagicDNS).
- `OPENCLAW_CLI_PATH` ueberschreibt den angekuendigten CLI-Pfad.

### 2) Tailnet (netzwerkuebergreifend)

Fuer Setups im Stil London/Wien hilft Bonjour nicht. Das empfohlene „direkte“ Ziel ist:

- Tailscale-MagicDNS-Name (bevorzugt) oder eine stabile Tailnet-IP.

Wenn das Gateway erkennen kann, dass es unter Tailscale laeuft, veroeffentlicht es `tailnetDns` als optionalen Hinweis fuer Clients (einschliesslich Weitbereichs-Beacons).

### 3) Manuelles / SSH-Ziel

Wenn es keine direkte Route gibt (oder Direkt deaktiviert ist), koennen Clients jederzeit via SSH verbinden, indem sie den Loopback-Gateway-Port weiterleiten.

Siehe [Remote access](/gateway/remote).

## Transportauswahl (Client-Richtlinie)

Empfohlenes Client-Verhalten:

1. Wenn ein gepaarter direkter Endpunkt konfiguriert und erreichbar ist, verwenden Sie ihn.
2. Andernfalls, wenn Bonjour ein Gateway im LAN findet, bieten Sie eine Ein-Tipp-Option „Dieses Gateway verwenden“ an und speichern Sie es als direkten Endpunkt.
3. Andernfalls, wenn eine Tailnet-DNS/IP konfiguriert ist, versuchen Sie direkt.
4. Andernfalls auf SSH zurueckfallen.

## Paarung + Auth (direkter Transport)

Das Gateway ist die Single Source of Truth fuer die Zulassung von Nodes/Clients.

- Paarungsanfragen werden im Gateway erstellt/genehmigt/abgelehnt (siehe [Gateway pairing](/gateway/pairing)).
- Das Gateway erzwingt:
  - Auth (Token / Schluesselpaar)
  - Scopes/ACLs (das Gateway ist kein roher Proxy zu jeder Methode)
  - Rate-Limits

## Verantwortlichkeiten nach Komponente

- **Gateway**: kuendigt Erkennungs-Beacons an, besitzt Paarungsentscheidungen und hostet den WS-Endpunkt.
- **macOS-App**: hilft beim Auswaehlen eines Gateways, zeigt Paarungsaufforderungen an und nutzt SSH nur als Fallback.
- **iOS/Android-Nodes**: durchsuchen Bonjour als Bequemlichkeit und verbinden sich mit dem gepaarten Gateway WS.
