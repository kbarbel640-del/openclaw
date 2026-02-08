---
summary: "Zugriff und Authentifizierung für das Gateway-Dashboard (Control UI)"
read_when:
  - "Ändern der Dashboard-Authentifizierung oder der Expositionsmodi"
title: "Dashboard"
x-i18n:
  source_path: web/dashboard.md
  source_hash: 852e359885574fa3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:55Z
---

# Dashboard (Control UI)

Das Gateway-Dashboard ist die browserbasierte Control UI, die standardmäßig unter `/` bereitgestellt wird
(Überschreiben mit `gateway.controlUi.basePath`).

Schnell öffnen (lokales Gateway):

- http://127.0.0.1:18789/ (oder http://localhost:18789/)

Wichtige Referenzen:

- [Control UI](/web/control-ui) zur Nutzung und zu UI-Funktionen.
- [Tailscale](/gateway/tailscale) für Serve-/Funnel-Automatisierung.
- [Web surfaces](/web) zu Bind-Modi und Sicherheitshinweisen.

Die Authentifizierung wird beim WebSocket-Handshake über `connect.params.auth` erzwungen
(Token oder Passwort). Siehe `gateway.auth` in der [Gateway-Konfiguration](/gateway/configuration).

Sicherheitshinweis: Die Control UI ist eine **Admin-Oberfläche** (Chat, Konfiguration, Exec-Freigaben).
Setzen Sie sie nicht öffentlich aus. Die UI speichert den Token nach dem ersten Laden in `localStorage`.
Bevorzugen Sie localhost, Tailscale Serve oder einen SSH-Tunnel.

## Schnellstart (empfohlen)

- Nach der Einführung öffnet die CLI das Dashboard automatisch und gibt einen sauberen (nicht tokenisierten) Link aus.
- Jederzeit erneut öffnen: `openclaw dashboard` (kopiert den Link, öffnet den Browser, wenn möglich, zeigt bei Headless einen SSH-Hinweis).
- Wenn die UI zur Authentifizierung auffordert, fügen Sie den Token aus `gateway.auth.token` (oder `OPENCLAW_GATEWAY_TOKEN`) in die Control-UI-Einstellungen ein.

## Token-Grundlagen (lokal vs. remote)

- **Localhost**: Öffnen Sie `http://127.0.0.1:18789/`.
- **Token-Quelle**: `gateway.auth.token` (oder `OPENCLAW_GATEWAY_TOKEN`); die UI speichert nach der Verbindung eine Kopie in localStorage.
- **Nicht Localhost**: Verwenden Sie Tailscale Serve (tokenlos, wenn `gateway.auth.allowTailscale: true`), Tailnet-Bind mit Token oder einen SSH-Tunnel. Siehe [Web surfaces](/web).

## Wenn Sie „unauthorized“ / 1008 sehen

- Stellen Sie sicher, dass das Gateway erreichbar ist (lokal: `openclaw status`; remote: SSH-Tunnel `ssh -N -L 18789:127.0.0.1:18789 user@host` und dann `http://127.0.0.1:18789/` öffnen).
- Rufen Sie den Token auf dem Gateway-Host ab: `openclaw config get gateway.auth.token` (oder erzeugen Sie einen: `openclaw doctor --generate-gateway-token`).
- Fügen Sie in den Dashboard-Einstellungen den Token in das Auth-Feld ein und verbinden Sie sich dann.
