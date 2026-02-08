---
summary: "Gateway-Weboberflächen: Control UI, Bind-Modi und Sicherheit"
read_when:
  - Sie möchten auf das Gateway über Tailscale zugreifen
  - Sie möchten die browserbasierte Control UI und die Konfigurationsbearbeitung nutzen
title: "Web"
x-i18n:
  source_path: web/index.md
  source_hash: 1315450b71a799c8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:53Z
---

# Web (Gateway)

Das Gateway stellt eine kleine **browserbasierte Control UI** (Vite + Lit) über denselben Port bereit wie den Gateway-WebSocket:

- Standard: `http://<host>:18789/`
- optionales Präfix: setzen Sie `gateway.controlUi.basePath` (z. B. `/openclaw`)

Die Funktionen finden Sie in der [Control UI](/web/control-ui).
Diese Seite konzentriert sich auf Bind-Modi, Sicherheit und webseitige Oberflächen.

## Webhooks

Wenn `hooks.enabled=true`, stellt das Gateway außerdem einen kleinen Webhook-Endpunkt auf demselben HTTP-Server bereit.
Siehe [Gateway-Konfiguration](/gateway/configuration) → `hooks` fuer Authentifizierung + Payloads.

## Konfiguration (standardmäßig aktiviert)

Die Control UI ist **standardmäßig aktiviert**, wenn Assets vorhanden sind (`dist/control-ui`).
Sie können dies über die Konfiguration steuern:

```json5
{
  gateway: {
    controlUi: { enabled: true, basePath: "/openclaw" }, // basePath optional
  },
}
```

## Tailscale-Zugriff

### Integriertes Serve (empfohlen)

Belassen Sie das Gateway auf local loopback und lassen Sie es von Tailscale Serve proxyen:

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "serve" },
  },
}
```

Starten Sie dann das Gateway:

```bash
openclaw gateway
```

Öffnen:

- `https://<magicdns>/` (oder Ihr konfiguriertes `gateway.controlUi.basePath`)

### Tailnet-Bind + Token

```json5
{
  gateway: {
    bind: "tailnet",
    controlUi: { enabled: true },
    auth: { mode: "token", token: "your-token" },
  },
}
```

Starten Sie dann das Gateway (Token erforderlich für Nicht-Loopback-Binds):

```bash
openclaw gateway
```

Öffnen:

- `http://<tailscale-ip>:18789/` (oder Ihr konfiguriertes `gateway.controlUi.basePath`)

### Öffentliches Internet (Funnel)

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "funnel" },
    auth: { mode: "password" }, // or OPENCLAW_GATEWAY_PASSWORD
  },
}
```

## Sicherheitshinweise

- Gateway-Authentifizierung ist standardmäßig erforderlich (Token/Passwort oder Tailscale-Identitäts-Header).
- Nicht-Loopback-Binds **erfordern** weiterhin ein gemeinsames Token/Passwort (`gateway.auth` oder env).
- Der Assistent erzeugt standardmäßig ein Gateway-Token (auch bei Loopback).
- Die UI sendet `connect.params.auth.token` oder `connect.params.auth.password`.
- Die Control UI sendet Anti-Clickjacking-Header und akzeptiert nur gleichherkunftige Browser-
  WebSocket-Verbindungen, sofern nicht `gateway.controlUi.allowedOrigins` gesetzt ist.
- Mit Serve können Tailscale-Identitäts-Header die Authentifizierung erfüllen, wenn
  `gateway.auth.allowTailscale` `true` ist (kein Token/Passwort erforderlich). Setzen Sie
  `gateway.auth.allowTailscale: false`, um explizite Anmeldedaten zu verlangen. Siehe
  [Tailscale](/gateway/tailscale) und [Sicherheit](/gateway/security).
- `gateway.tailscale.mode: "funnel"` erfordert `gateway.auth.mode: "password"` (gemeinsames Passwort).

## UI bauen

Das Gateway stellt statische Dateien aus `dist/control-ui` bereit. Bauen Sie diese mit:

```bash
pnpm ui:build # auto-installs UI deps on first run
```
