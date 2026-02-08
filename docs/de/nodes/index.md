---
summary: "Nodes: Kopplung, Funktionen, Berechtigungen und CLI-Hilfsprogramme für Canvas/Kamera/Bildschirm/System"
read_when:
  - Koppeln von iOS-/Android-Nodes mit einem Gateway
  - Nutzung von Node-Canvas/Kamera für Agent-Kontext
  - Hinzufügen neuer Node-Befehle oder CLI-Hilfsprogramme
title: "Nodes"
x-i18n:
  source_path: nodes/index.md
  source_hash: 74e9420f61c653e4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:03Z
---

# Nodes

Ein **Node** ist ein Begleitgerät (macOS/iOS/Android/headless), das sich mit dem Gateway-**WebSocket** (derselbe Port wie für Operatoren) mit `role: "node"` verbindet und über `node.invoke` eine Befehlsoberfläche (z. B. `canvas.*`, `camera.*`, `system.*`) bereitstellt. Protokolldetails: [Gateway protocol](/gateway/protocol).

Legacy-Transport: [Bridge protocol](/gateway/bridge-protocol) (TCP JSONL; veraltet/entfernt für aktuelle Nodes).

macOS kann auch im **Node-Modus** laufen: Die Menüleisten-App verbindet sich mit dem WS-Server des Gateways und stellt ihre lokalen Canvas-/Kamera-Befehle als Node bereit (sodass `openclaw nodes …` gegen diesen Mac funktioniert).

Hinweise:

- Nodes sind **Peripheriegeräte**, keine Gateways. Sie betreiben keinen Gateway-Dienst.
- Telegram-/WhatsApp-/etc.-Nachrichten landen auf dem **Gateway**, nicht auf Nodes.

## Pairing + Status

**WS-Nodes verwenden Geräte-Kopplung.** Nodes präsentieren während `connect` eine Geräteidentität; das Gateway
erstellt eine Geräte-Kopplungsanfrage für `role: node`. Genehmigen Sie diese über die Geräte-CLI (oder UI).

Schnell per CLI:

```bash
openclaw devices list
openclaw devices approve <requestId>
openclaw devices reject <requestId>
openclaw nodes status
openclaw nodes describe --node <idOrNameOrIp>
```

Hinweise:

- `nodes status` markiert einen Node als **gekoppelt**, wenn seine Geräte-Kopplungsrolle `node` enthält.
- `node.pair.*` (CLI: `openclaw nodes pending/approve/reject`) ist ein separater, Gateway-eigener
  Node-Kopplungsspeicher; er steuert **nicht** den WS-`connect`-Handshake.

## Remote Node Host (system.run)

Verwenden Sie einen **Node Host**, wenn Ihr Gateway auf einer Maschine läuft und Sie Befehle
auf einer anderen ausführen möchten. Das Modell spricht weiterhin mit dem **Gateway**; das Gateway
leitet `exec`-Aufrufe an den **Node Host** weiter, wenn `host=node` ausgewählt ist.

### Was läuft wo

- **Gateway-Host**: empfängt Nachrichten, führt das Modell aus, routet Tool-Aufrufe.
- **Node-Host**: führt `system.run`/`system.which` auf der Node-Maschine aus.
- **Genehmigungen**: werden auf dem Node Host über `~/.openclaw/exec-approvals.json` durchgesetzt.

### Node Host starten (Vordergrund)

Auf der Node-Maschine:

```bash
openclaw node run --host <gateway-host> --port 18789 --display-name "Build Node"
```

### Remote-Gateway über SSH-Tunnel (Loopback-Bind)

Wenn das Gateway an Loopback gebunden ist (`gateway.bind=loopback`, Standard im lokalen Modus),
können entfernte Node Hosts nicht direkt verbinden. Erstellen Sie einen SSH-Tunnel und verweisen Sie den
Node Host auf das lokale Ende des Tunnels.

Beispiel (Node Host → Gateway-Host):

```bash
# Terminal A (keep running): forward local 18790 -> gateway 127.0.0.1:18789
ssh -N -L 18790:127.0.0.1:18789 user@gateway-host

# Terminal B: export the gateway token and connect through the tunnel
export OPENCLAW_GATEWAY_TOKEN="<gateway-token>"
openclaw node run --host 127.0.0.1 --port 18790 --display-name "Build Node"
```

Hinweise:

- Das Token ist `gateway.auth.token` aus der Gateway-Konfiguration (`~/.openclaw/openclaw.json` auf dem Gateway-Host).
- `openclaw node run` liest `OPENCLAW_GATEWAY_TOKEN` zur Authentifizierung.

### Node Host starten (Service)

```bash
openclaw node install --host <gateway-host> --port 18789 --display-name "Build Node"
openclaw node restart
```

### Pair + Name

Auf dem Gateway-Host:

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
openclaw nodes list
```

Benennungsoptionen:

- `--display-name` auf `openclaw node run` / `openclaw node install` (persistiert in `~/.openclaw/node.json` auf dem Node).
- `openclaw nodes rename --node <id|name|ip> --name "Build Node"` (Gateway-Override).

### Befehle auf die Allowlist setzen

Exec-Genehmigungen sind **pro Node Host**. Fügen Sie Allowlist-Einträge vom Gateway aus hinzu:

```bash
openclaw approvals allowlist add --node <id|name|ip> "/usr/bin/uname"
openclaw approvals allowlist add --node <id|name|ip> "/usr/bin/sw_vers"
```

Genehmigungen liegen auf dem Node Host unter `~/.openclaw/exec-approvals.json`.

### Exec auf den Node zeigen

Standard konfigurieren (Gateway-Konfiguration):

```bash
openclaw config set tools.exec.host node
openclaw config set tools.exec.security allowlist
openclaw config set tools.exec.node "<id-or-name>"
```

Oder pro Sitzung:

```
/exec host=node security=allowlist node=<id-or-name>
```

Sobald gesetzt, wird jeder `exec`-Aufruf mit `host=node` auf dem Node Host ausgeführt (vorbehaltlich
der Node-Allowlist/Genehmigungen).

Verwandt:

- [Node host CLI](/cli/node)
- [Exec tool](/tools/exec)
- [Exec approvals](/tools/exec-approvals)

## Befehle aufrufen

Low-Level (rohes RPC):

```bash
openclaw nodes invoke --node <idOrNameOrIp> --command canvas.eval --params '{"javaScript":"location.href"}'
```

Für die gängigen Workflows „dem Agenten einen MEDIA-Anhang geben“ existieren höherstufige Hilfsprogramme.

## Screenshots (Canvas-Snapshots)

Wenn der Node das Canvas (WebView) anzeigt, liefert `canvas.snapshot` `{ format, base64 }` zurück.

CLI-Hilfsprogramm (schreibt in eine temporäre Datei und gibt `MEDIA:<path>` aus):

```bash
openclaw nodes canvas snapshot --node <idOrNameOrIp> --format png
openclaw nodes canvas snapshot --node <idOrNameOrIp> --format jpg --max-width 1200 --quality 0.9
```

### Canvas-Steuerung

```bash
openclaw nodes canvas present --node <idOrNameOrIp> --target https://example.com
openclaw nodes canvas hide --node <idOrNameOrIp>
openclaw nodes canvas navigate https://example.com --node <idOrNameOrIp>
openclaw nodes canvas eval --node <idOrNameOrIp> --js "document.title"
```

Hinweise:

- `canvas present` akzeptiert URLs oder lokale Dateipfade (`--target`) sowie optional `--x/--y/--width/--height` zur Positionierung.
- `canvas eval` akzeptiert Inline-JS (`--js`) oder ein Positionsargument.

### A2UI (Canvas)

```bash
openclaw nodes canvas a2ui push --node <idOrNameOrIp> --text "Hello"
openclaw nodes canvas a2ui push --node <idOrNameOrIp> --jsonl ./payload.jsonl
openclaw nodes canvas a2ui reset --node <idOrNameOrIp>
```

Hinweise:

- Es wird nur A2UI v0.8 JSONL unterstützt (v0.9/createSurface wird abgelehnt).

## Fotos + Videos (Node-Kamera)

Fotos (`jpg`):

```bash
openclaw nodes camera list --node <idOrNameOrIp>
openclaw nodes camera snap --node <idOrNameOrIp>            # default: both facings (2 MEDIA lines)
openclaw nodes camera snap --node <idOrNameOrIp> --facing front
```

Videoclips (`mp4`):

```bash
openclaw nodes camera clip --node <idOrNameOrIp> --duration 10s
openclaw nodes camera clip --node <idOrNameOrIp> --duration 3000 --no-audio
```

Hinweise:

- Der Node muss für `canvas.*` und `camera.*` **im Vordergrund** sein (Hintergrundaufrufe liefern `NODE_BACKGROUND_UNAVAILABLE`).
- Die Clip-Dauer ist begrenzt (derzeit `<= 60s`), um übergroße Base64-Payloads zu vermeiden.
- Android fordert nach Möglichkeit Berechtigungen für `CAMERA`/`RECORD_AUDIO` an; verweigerte Berechtigungen schlagen mit `*_PERMISSION_REQUIRED` fehl.

## Bildschirmaufzeichnungen (Nodes)

Nodes stellen `screen.record` (mp4) bereit. Beispiel:

```bash
openclaw nodes screen record --node <idOrNameOrIp> --duration 10s --fps 10
openclaw nodes screen record --node <idOrNameOrIp> --duration 10s --fps 10 --no-audio
```

Hinweise:

- `screen.record` erfordert, dass die Node-App im Vordergrund ist.
- Android zeigt vor der Aufnahme die systemweite Bildschirmaufzeichnungsabfrage an.
- Bildschirmaufzeichnungen sind auf `<= 60s` begrenzt.
- `--no-audio` deaktiviert die Mikrofonaufnahme (unterstützt auf iOS/Android; macOS nutzt System-Audioaufnahme).
- Verwenden Sie `--screen <index>`, um bei mehreren Displays einen Bildschirm auszuwählen.

## Standort (Nodes)

Nodes stellen `location.get` bereit, wenn Standort in den Einstellungen aktiviert ist.

CLI-Hilfsprogramm:

```bash
openclaw nodes location get --node <idOrNameOrIp>
openclaw nodes location get --node <idOrNameOrIp> --accuracy precise --max-age 15000 --location-timeout 10000
```

Hinweise:

- Standort ist **standardmäßig deaktiviert**.
- „Immer“ erfordert eine Systemberechtigung; Hintergrundabrufe sind Best-Effort.
- Die Antwort enthält Lat/Lon, Genauigkeit (Meter) und Zeitstempel.

## SMS (Android-Nodes)

Android-Nodes können `sms.send` bereitstellen, wenn der Nutzer die **SMS**-Berechtigung erteilt und das Gerät Telefonie unterstützt.

Low-Level-Aufruf:

```bash
openclaw nodes invoke --node <idOrNameOrIp> --command sms.send --params '{"to":"+15555550123","message":"Hello from OpenClaw"}'
```

Hinweise:

- Die Berechtigungsabfrage muss auf dem Android-Gerät akzeptiert werden, bevor die Fähigkeit beworben wird.
- Reine WLAN-Geräte ohne Telefonie bewerben `sms.send` nicht.

## Systembefehle (Node Host / Mac-Node)

Der macOS-Node stellt `system.run`, `system.notify` und `system.execApprovals.get/set` bereit.
Der headless Node Host stellt `system.run`, `system.which` und `system.execApprovals.get/set` bereit.

Beispiele:

```bash
openclaw nodes run --node <idOrNameOrIp> -- echo "Hello from mac node"
openclaw nodes notify --node <idOrNameOrIp> --title "Ping" --body "Gateway ready"
```

Hinweise:

- `system.run` gibt stdout/stderr/Exit-Code im Payload zurück.
- `system.notify` berücksichtigt den Benachrichtigungs-Berechtigungsstatus der macOS-App.
- `system.run` unterstützt `--cwd`, `--env KEY=VAL`, `--command-timeout` und `--needs-screen-recording`.
- `system.notify` unterstützt `--priority <passive|active|timeSensitive>` und `--delivery <system|overlay|auto>`.
- macOS-Nodes verwerfen `PATH`-Overrides; headless Node Hosts akzeptieren `PATH` nur, wenn es den Node-Host-PATH voranstellt.
- Im macOS-Node-Modus ist `system.run` durch Exec-Genehmigungen in der macOS-App (Einstellungen → Exec approvals) eingeschränkt.
  Ask/Allowlist/Full verhalten sich wie beim headless Node Host; abgelehnte Abfragen liefern `SYSTEM_RUN_DENIED`.
- Beim headless Node Host ist `system.run` durch Exec-Genehmigungen (`~/.openclaw/exec-approvals.json`) eingeschränkt.

## Exec-Node-Bindung

Wenn mehrere Nodes verfügbar sind, können Sie Exec an einen bestimmten Node binden.
Dies setzt den Standard-Node für `exec host=node` (und kann pro Agent überschrieben werden).

Globaler Standard:

```bash
openclaw config set tools.exec.node "node-id-or-name"
```

Pro-Agent-Override:

```bash
openclaw config get agents.list
openclaw config set agents.list[0].tools.exec.node "node-id-or-name"
```

Aufheben, um jeden Node zuzulassen:

```bash
openclaw config unset tools.exec.node
openclaw config unset agents.list[0].tools.exec.node
```

## Berechtigungsübersicht

Nodes können eine `permissions`-Map in `node.list` / `node.describe` enthalten, indiziert nach Berechtigungsnamen (z. B. `screenRecording`, `accessibility`) mit booleschen Werten (`true` = gewährt).

## Headless Node Host (plattformübergreifend)

OpenClaw kann einen **headless Node Host** (ohne UI) ausführen, der sich mit dem Gateway-
WebSocket verbindet und `system.run` / `system.which` bereitstellt. Dies ist nützlich unter Linux/Windows
oder zum Betrieb eines minimalen Nodes neben einem Server.

Start:

```bash
openclaw node run --host <gateway-host> --port 18789
```

Hinweise:

- Pairing ist weiterhin erforderlich (das Gateway zeigt eine Node-Genehmigungsabfrage an).
- Der Node Host speichert seine Node-ID, sein Token, seinen Anzeigenamen und Gateway-Verbindungsinformationen in `~/.openclaw/node.json`.
- Exec-Genehmigungen werden lokal über `~/.openclaw/exec-approvals.json` durchgesetzt
  (siehe [Exec approvals](/tools/exec-approvals)).
- Unter macOS bevorzugt der headless Node Host den Exec-Host der Begleit-App, wenn erreichbar, und fällt
  andernfalls auf lokale Ausführung zurück. Setzen Sie `OPENCLAW_NODE_EXEC_HOST=app`, um
  die App zu erzwingen, oder `OPENCLAW_NODE_EXEC_FALLBACK=0`, um das Fallback zu deaktivieren.
- Fügen Sie `--tls` / `--tls-fingerprint` hinzu, wenn der Gateway-WS TLS verwendet.

## Mac-Node-Modus

- Die macOS-Menüleisten-App verbindet sich als Node mit dem Gateway-WS-Server (sodass `openclaw nodes …` gegen diesen Mac funktioniert).
- Im Remote-Modus öffnet die App einen SSH-Tunnel für den Gateway-Port und verbindet sich mit `localhost`.
