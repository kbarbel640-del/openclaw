---
summary: "WebSocket-Gateway-Architektur, Komponenten und Client-Flows"
read_when:
  - Arbeiten am Gateway-Protokoll, an Clients oder an Transports
title: "Gateway-Architektur"
x-i18n:
  source_path: concepts/architecture.md
  source_hash: c636d5d8a5e62806
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:01Z
---

# Gateway-Architektur

Zuletzt aktualisiert: 2026-01-22

## Überblick

- Ein einzelnes, langlebiges **Gateway** besitzt alle Messaging-Oberflächen (WhatsApp über
  Baileys, Telegram über grammY, Slack, Discord, Signal, iMessage, WebChat).
- Control-Plane-Clients (macOS-App, CLI, Web-UI, Automatisierungen) verbinden sich
  über **WebSocket** mit dem Gateway auf dem konfigurierten Bind-Host (Standard
  `127.0.0.1:18789`).
- **Nodes** (macOS/iOS/Android/headless) verbinden sich ebenfalls über **WebSocket**,
  deklarieren jedoch `role: node` mit expliziten Caps/Befehlen.
- Ein Gateway pro Host; es ist der einzige Ort, der eine WhatsApp-Sitzung öffnet.
- Ein **Canvas-Host** (Standard `18793`) stellt agentenbearbeitbares HTML und A2UI bereit.

## Komponenten und Flows

### Gateway (Daemon)

- Hält Verbindungen zu Anbietern aufrecht.
- Stellt eine typisierte WS-API bereit (Requests, Responses, Server-Push-Events).
- Validiert eingehende Frames gegen JSON Schema.
- Emittiert Events wie `agent`, `chat`, `presence`, `health`, `heartbeat`, `cron`.

### Clients (macOS-App / CLI / Web-Admin)

- Eine WS-Verbindung pro Client.
- Senden Requests (`health`, `status`, `send`, `agent`, `system-presence`).
- Abonnieren Events (`tick`, `agent`, `presence`, `shutdown`).

### Nodes (macOS / iOS / Android / headless)

- Verbinden sich mit dem **gleichen WS-Server** mit `role: node`.
- Stellen eine Geräteidentität in `connect` bereit; Pairing ist **gerätebasiert**
  (Rolle `node`) und die Freigabe liegt im Device-Pairing-Store.
- Stellen Befehle wie `canvas.*`, `camera.*`, `screen.record`, `location.get` bereit.

Protokolldetails:

- [Gateway protocol](/gateway/protocol)

### WebChat

- Statische UI, die die Gateway-WS-API für Chatverlauf und Senden nutzt.
- In Remote-Setups Verbindung über denselben SSH-/Tailscale-Tunnel wie andere
  Clients.

## Verbindungslebenszyklus (einzelner Client)

```
Client                    Gateway
  |                          |
  |---- req:connect -------->|
  |<------ res (ok) ---------|   (or res error + close)
  |   (payload=hello-ok carries snapshot: presence + health)
  |                          |
  |<------ event:presence ---|
  |<------ event:tick -------|
  |                          |
  |------- req:agent ------->|
  |<------ res:agent --------|   (ack: {runId,status:"accepted"})
  |<------ event:agent ------|   (streaming)
  |<------ res:agent --------|   (final: {runId,status,summary})
  |                          |
```

## Wire-Protokoll (Zusammenfassung)

- Transport: WebSocket, Text-Frames mit JSON-Payloads.
- Das erste Frame **muss** `connect` sein.
- Nach dem Handshake:
  - Requests: `{type:"req", id, method, params}` → `{type:"res", id, ok, payload|error}`
  - Events: `{type:"event", event, payload, seq?, stateVersion?}`
- Wenn `OPENCLAW_GATEWAY_TOKEN` (oder `--token`) gesetzt ist, **muss** `connect.params.auth.token`
  übereinstimmen, sonst wird der Socket geschlossen.
- Idempotency-Keys sind für nebenwirkungsbehaftete Methoden (`send`, `agent`)
  erforderlich, um sicher zu retryen; der Server hält einen kurzlebigen Dedupe-Cache.
- Nodes müssen `role: "node"` sowie Caps/Befehle/Berechtigungen in `connect` einschließen.

## Pairing + lokales Vertrauen

- Alle WS-Clients (Operatoren + Nodes) schließen eine **Geräteidentität** in `connect` ein.
- Neue Geräte-IDs erfordern eine Pairing-Freigabe; das Gateway stellt ein **Gerätetoken**
  für nachfolgende Verbindungen aus.
- **Lokale** Verbindungen (Loopback oder die eigene Tailnet-Adresse des Gateway-Hosts)
  können automatisch freigegeben werden, um die UX auf demselben Host flüssig zu halten.
- **Nicht-lokale** Verbindungen müssen den `connect.challenge`-Nonce signieren und erfordern
  eine explizite Freigabe.
- Gateway-Auth (`gateway.auth.*`) gilt weiterhin für **alle** Verbindungen, lokal oder
  remote.

Details: [Gateway protocol](/gateway/protocol), [Pairing](/start/pairing),
[Security](/gateway/security).

## Protokoll-Typisierung und Codegen

- TypeBox-Schemas definieren das Protokoll.
- JSON Schema wird aus diesen Schemas generiert.
- Swift-Modelle werden aus dem JSON Schema generiert.

## Remote-Zugriff

- Bevorzugt: Tailscale oder VPN.
- Alternative: SSH-Tunnel
  ```bash
  ssh -N -L 18789:127.0.0.1:18789 user@host
  ```
- Derselbe Handshake + Auth-Token gelten über den Tunnel.
- TLS + optionales Pinning können für WS in Remote-Setups aktiviert werden.

## Betriebsübersicht

- Start: `openclaw gateway` (Vordergrund, Logs nach stdout).
- Health: `health` über WS (auch enthalten in `hello-ok`).
- Überwachung: launchd/systemd für automatischen Neustart.

## Invarianten

- Genau ein Gateway steuert pro Host eine einzelne Baileys-Sitzung.
- Der Handshake ist obligatorisch; jedes nicht-JSON- oder nicht-connect-Erstframe führt zu einem harten Close.
- Events werden nicht erneut abgespielt; Clients müssen bei Lücken aktualisieren.
