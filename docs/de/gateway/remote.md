---
summary: „Remote-Zugriff über SSH-Tunnel (Gateway WS) und Tailnets“
read_when:
  - Beim Betrieb oder bei der Fehlerbehebung von Remote-Gateway-Setups
title: „Remote-Zugriff“
x-i18n:
  source_path: gateway/remote.md
  source_hash: 449d406f88c53dcc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:32Z
---

# Remote-Zugriff (SSH, Tunnel und Tailnets)

Dieses Repo unterstützt „remote über SSH“, indem ein einzelnes Gateway (der Master) auf einem dedizierten Host (Desktop/Server) läuft und Clients sich damit verbinden.

- Für **Operatoren (Sie / die macOS-App)**: SSH-Tunneling ist der universelle Fallback.
- Für **Nodes (iOS/Android und zukünftige Geräte)**: Verbindung zum Gateway **WebSocket** (LAN/Tailnet oder bei Bedarf über SSH-Tunnel).

## Die Grundidee

- Der Gateway-WebSocket bindet an **Loopback** auf dem konfigurierten Port (Standard: 18789).
- Für die Remote-Nutzung leiten Sie diesen Loopback-Port über SSH weiter (oder nutzen ein Tailnet/VPN und tunneln weniger).

## Gängige VPN-/Tailnet-Setups (wo der Agent lebt)

Betrachten Sie den **Gateway-Host** als „den Ort, an dem der Agent lebt“. Er besitzt Sitzungen, Auth-Profile, Kanäle und Zustand.
Ihr Laptop/Desktop (und die Nodes) verbinden sich mit diesem Host.

### 1) Immer eingeschaltetes Gateway in Ihrem Tailnet (VPS oder Heimserver)

Betreiben Sie das Gateway auf einem persistenten Host und greifen Sie über **Tailscale** oder SSH darauf zu.

- **Beste UX:** `gateway.bind: "loopback"` beibehalten und **Tailscale Serve** für die Control-UI verwenden.
- **Fallback:** Loopback beibehalten + SSH-Tunnel von jeder Maschine, die Zugriff benötigt.
- **Beispiele:** [exe.dev](/install/exe-dev) (einfache VM) oder [Hetzner](/install/hetzner) (Produktions-VPS).

Dies ist ideal, wenn Ihr Laptop häufig schläft, Sie den Agenten aber dauerhaft verfügbar haben möchten.

### 2) Heim-Desktop betreibt das Gateway, Laptop ist die Fernsteuerung

Der Laptop führt den Agenten **nicht** aus. Er verbindet sich remote:

- Verwenden Sie den **Remote over SSH**-Modus der macOS-App (Einstellungen → Allgemein → „OpenClaw läuft“).
- Die App öffnet und verwaltet den Tunnel, sodass WebChat + Gesundheitschecks „einfach funktionieren“.

Runbook: [macOS-Remote-Zugriff](/platforms/mac/remote).

### 3) Laptop betreibt das Gateway, Remote-Zugriff von anderen Maschinen

Behalten Sie das Gateway lokal, exponieren Sie es aber sicher:

- SSH-Tunnel vom Laptop zu anderen Maschinen, oder
- Control-UI über Tailscale Serve bereitstellen und das Gateway auf Loopback beschränkt lassen.

Leitfaden: [Tailscale](/gateway/tailscale) und [Web-Überblick](/web).

## Befehlsfluss (was wo läuft)

Ein Gateway-Dienst besitzt Zustand + Kanäle. Nodes sind Peripheriegeräte.

Beispielablauf (Telegram → Node):

- Eine Telegram-Nachricht trifft beim **Gateway** ein.
- Das Gateway führt den **Agenten** aus und entscheidet, ob ein Node-Werkzeug aufgerufen wird.
- Das Gateway ruft den **Node** über den Gateway-WebSocket auf (`node.*` RPC).
- Der Node gibt das Ergebnis zurück; das Gateway antwortet an Telegram.

Hinweise:

- **Nodes führen den Gateway-Dienst nicht aus.** Pro Host sollte nur ein Gateway laufen, außer Sie betreiben bewusst isolierte Profile (siehe [Mehrere Gateways](/gateway/multiple-gateways)).
- Der macOS-App-„Node-Modus“ ist lediglich ein Node-Client über den Gateway-WebSocket.

## SSH-Tunnel (CLI + Tools)

Erstellen Sie einen lokalen Tunnel zum entfernten Gateway-WS:

```bash
ssh -N -L 18789:127.0.0.1:18789 user@host
```

Mit aktivem Tunnel:

- `openclaw health` und `openclaw status --deep` erreichen nun das entfernte Gateway über `ws://127.0.0.1:18789`.
- `openclaw gateway {status,health,send,agent,call}` kann bei Bedarf auch die weitergeleitete URL über `--url` ansprechen.

Hinweis: Ersetzen Sie `18789` durch Ihren konfigurierten `gateway.port` (oder `--port`/`OPENCLAW_GATEWAY_PORT`).
Hinweis: Wenn Sie `--url` übergeben, greift die CLI **nicht** auf Konfigurations- oder Umgebungsanmeldeinformationen zurück.
Geben Sie `--token` oder `--password` explizit an. Fehlende explizite Anmeldedaten sind ein Fehler.

## CLI-Remote-Standardeinstellungen

Sie können ein Remote-Ziel persistieren, sodass CLI-Befehle es standardmäßig verwenden:

```json5
{
  gateway: {
    mode: "remote",
    remote: {
      url: "ws://127.0.0.1:18789",
      token: "your-token",
    },
  },
}
```

Wenn das Gateway nur auf Loopback gebunden ist, belassen Sie die URL auf `ws://127.0.0.1:18789` und öffnen Sie zuerst den SSH-Tunnel.

## Chat-UI über SSH

WebChat verwendet keinen separaten HTTP-Port mehr. Die SwiftUI-Chat-UI verbindet sich direkt mit dem Gateway-WebSocket.

- Leiten Sie `18789` über SSH weiter (siehe oben) und verbinden Sie Clients anschließend mit `ws://127.0.0.1:18789`.
- Unter macOS bevorzugen Sie den Modus „Remote over SSH“ der App, der den Tunnel automatisch verwaltet.

## macOS-App „Remote over SSH“

Die macOS-Menüleisten-App kann dasselbe Setup Ende-zu-Ende steuern (Remote-Statusprüfungen, WebChat und Voice-Wake-Weiterleitung).

Runbook: [macOS-Remote-Zugriff](/platforms/mac/remote).

## Sicherheitsregeln (Remote/VPN)

Kurzfassung: **Halten Sie das Gateway auf Loopback beschränkt**, sofern Sie nicht sicher sind, dass Sie eine Bindung benötigen.

- **Loopback + SSH/Tailscale Serve** ist der sicherste Standard (keine öffentliche Exponierung).
- **Nicht-Loopback-Bindungen** (`lan`/`tailnet`/`custom` oder `auto`, wenn Loopback nicht verfügbar ist) müssen Auth-Tokens/Passwörter verwenden.
- `gateway.remote.token` ist **nur** für Remote-CLI-Aufrufe — es aktiviert **keine** lokale Authentifizierung.
- `gateway.remote.tlsFingerprint` pinnt das entfernte TLS-Zertifikat bei Verwendung von `wss://`.
- **Tailscale Serve** kann über Identitäts-Header authentifizieren, wenn `gateway.auth.allowTailscale: true`.
  Setzen Sie es auf `false`, wenn Sie stattdessen Tokens/Passwörter möchten.
- Behandeln Sie die Browser-Steuerung wie Operator-Zugriff: nur Tailnet + bewusstes Node-Pairing.

Vertiefung: [Sicherheit](/gateway/security).
