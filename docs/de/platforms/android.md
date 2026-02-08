---
summary: „Android-App (Node): Verbindungs-Runbook + Canvas/Chat/Kamera“
read_when:
  - Koppeln oder erneutes Verbinden des Android-Nodes
  - Debugging der Android-Gateway-Erkennung oder -Authentifizierung
  - Überprüfen der Chat-Verlaufsgleichheit über Clients hinweg
title: „Android-App“
x-i18n:
  source_path: platforms/android.md
  source_hash: 9cd02f12065ce2bc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:01Z
---

# Android-App (Node)

## Support-Übersicht

- Rolle: Begleit-Node-App (Android hostet das Gateway nicht).
- Gateway erforderlich: ja (ausführen auf macOS, Linux oder Windows via WSL2).
- Installation: [Erste Schritte](/start/getting-started) + [Koppeln](/gateway/pairing).
- Gateway: [Runbook](/gateway) + [Konfiguration](/gateway/configuration).
  - Protokolle: [Gateway-Protokoll](/gateway/protocol) (Nodes + Control Plane).

## Systemsteuerung

Die Systemsteuerung (launchd/systemd) befindet sich auf dem Gateway-Host. Siehe [Gateway](/gateway).

## Verbindungs-Runbook

Android-Node-App ⇄ (mDNS/NSD + WebSocket) ⇄ **Gateway**

Android verbindet sich direkt mit dem Gateway-WebSocket (Standard `ws://<host>:18789`) und verwendet das vom Gateway verwaltete Pairing.

### Voraussetzungen

- Sie können das Gateway auf der „Master“-Maschine ausführen.
- Das Android-Gerät/der Emulator kann den Gateway-WebSocket erreichen:
  - Gleiches LAN mit mDNS/NSD, **oder**
  - Gleiches Tailscale-Tailnet mit Wide-Area Bonjour / unicast DNS-SD (siehe unten), **oder**
  - Manueller Gateway-Host/-Port (Fallback)
- Sie können die CLI (`openclaw`) auf der Gateway-Maschine ausführen (oder via SSH).

### 1) Gateway starten

```bash
openclaw gateway --port 18789 --verbose
```

Bestätigen Sie in den Logs, dass Sie etwa Folgendes sehen:

- `listening on ws://0.0.0.0:18789`

Für reine Tailnet-Setups (empfohlen für Wien ⇄ London) binden Sie das Gateway an die Tailnet-IP:

- Setzen Sie `gateway.bind: "tailnet"` in `~/.openclaw/openclaw.json` auf dem Gateway-Host.
- Starten Sie das Gateway / die macOS-Menüleisten-App neu.

### 2) Erkennung überprüfen (optional)

Von der Gateway-Maschine aus:

```bash
dns-sd -B _openclaw-gw._tcp local.
```

Weitere Debugging-Hinweise: [Bonjour](/gateway/bonjour).

#### Tailnet-Erkennung (Wien ⇄ London) via unicast DNS-SD

Android-NSD/mDNS-Erkennung überquert keine Netzwerke. Wenn sich Ihr Android-Node und das Gateway in unterschiedlichen Netzwerken befinden, aber über Tailscale verbunden sind, verwenden Sie stattdessen Wide-Area Bonjour / unicast DNS-SD:

1. Richten Sie auf dem Gateway-Host eine DNS-SD-Zone (Beispiel `openclaw.internal.`) ein und veröffentlichen Sie `_openclaw-gw._tcp`-Records.
2. Konfigurieren Sie Tailscale Split DNS für Ihre gewählte Domain und verweisen Sie auf diesen DNS-Server.

Details und Beispiel-CoreDNS-Konfiguration: [Bonjour](/gateway/bonjour).

### 3) Von Android aus verbinden

In der Android-App:

- Die App hält ihre Gateway-Verbindung über einen **Foreground-Service** (persistente Benachrichtigung) aktiv.
- Öffnen Sie **Einstellungen**.
- Wählen Sie unter **Entdeckte Gateways** Ihr Gateway aus und tippen Sie auf **Verbinden**.
- Wenn mDNS blockiert ist, verwenden Sie **Erweitert → Manuelles Gateway** (Host + Port) und **Verbinden (Manuell)**.

Nach dem ersten erfolgreichen Pairing verbindet sich Android beim Start automatisch erneut:

- Manueller Endpunkt (falls aktiviert), andernfalls
- Das zuletzt entdeckte Gateway (Best-Effort).

### 4) Pairing genehmigen (CLI)

Auf der Gateway-Maschine:

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
```

Pairing-Details: [Gateway-Pairing](/gateway/pairing).

### 5) Überprüfen, ob der Node verbunden ist

- Über den Node-Status:
  ```bash
  openclaw nodes status
  ```
- Über das Gateway:
  ```bash
  openclaw gateway call node.list --params "{}"
  ```

### 6) Chat + Verlauf

Das Chat-Sheet des Android-Nodes verwendet den **primären Sitzungsschlüssel** des Gateways (`main`), sodass Verlauf und Antworten mit WebChat und anderen Clients geteilt werden:

- Verlauf: `chat.history`
- Senden: `chat.send`
- Push-Updates (Best-Effort): `chat.subscribe` → `event:"chat"`

### 7) Canvas + Kamera

#### Gateway-Canvas-Host (empfohlen für Web-Inhalte)

Wenn der Node echtes HTML/CSS/JS anzeigen soll, das der Agent auf der Festplatte bearbeiten kann, richten Sie den Node auf den Gateway-Canvas-Host aus.

Hinweis: Nodes verwenden den eigenständigen Canvas-Host auf `canvasHost.port` (Standard `18793`).

1. Erstellen Sie `~/.openclaw/workspace/canvas/index.html` auf dem Gateway-Host.

2. Navigieren Sie den Node dorthin (LAN):

```bash
openclaw nodes invoke --node "<Android Node>" --command canvas.navigate --params '{"url":"http://<gateway-hostname>.local:18793/__openclaw__/canvas/"}'
```

Tailnet (optional): Wenn beide Geräte in Tailscale sind, verwenden Sie einen MagicDNS-Namen oder eine Tailnet-IP anstelle von `.local`, z. B. `http://<gateway-magicdns>:18793/__openclaw__/canvas/`.

Dieser Server injiziert einen Live-Reload-Client in HTML und lädt bei Dateiänderungen neu.
Der A2UI-Host befindet sich unter `http://<gateway-host>:18793/__openclaw__/a2ui/`.

Canvas-Befehle (nur im Vordergrund):

- `canvas.eval`, `canvas.snapshot`, `canvas.navigate` (verwenden Sie `{"url":""}` oder `{"url":"/"}`, um zum Standard-Scaffold zurückzukehren). `canvas.snapshot` gibt `{ format, base64 }` zurück (Standard `format="jpeg"`).
- A2UI: `canvas.a2ui.push`, `canvas.a2ui.reset` (`canvas.a2ui.pushJSONL` Legacy-Alias)

Kamera-Befehle (nur im Vordergrund; berechtigungsabhängig):

- `camera.snap` (jpg)
- `camera.clip` (mp4)

Siehe [Kamera-Node](/nodes/camera) für Parameter und CLI-Hilfsprogramme.
