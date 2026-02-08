---
summary: "macOS-App-Ablauf zur Steuerung eines entfernten OpenClaw-Gateways über SSH"
read_when:
  - Einrichten oder Debuggen der entfernten Mac-Steuerung
title: "Fernsteuerung"
x-i18n:
  source_path: platforms/mac/remote.md
  source_hash: 61b43707250d5515
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:07Z
---

# Remote OpenClaw (macOS ⇄ Remote-Host)

Dieser Ablauf ermöglicht es der macOS-App, als vollständige Fernbedienung für ein OpenClaw-Gateway zu fungieren, das auf einem anderen Host (Desktop/Server) läuft. Es handelt sich um die Funktion **Remote over SSH** (Remote-Ausführung) der App. Alle Funktionen – Gesundheitsprüfungen, Voice-Wake-Weiterleitung und Web Chat – verwenden dieselbe entfernte SSH-Konfiguration aus _Einstellungen → Allgemein_.

## Modi

- **Lokal (dieser Mac)**: Alles läuft auf dem Laptop. Kein SSH beteiligt.
- **Remote over SSH (Standard)**: OpenClaw-Befehle werden auf dem Remote-Host ausgeführt. Die Mac-App öffnet eine SSH-Verbindung mit `-o BatchMode` sowie Ihrer gewählten Identität/Ihrem Schlüssel und einer lokalen Portweiterleitung.
- **Remote direkt (ws/wss)**: Kein SSH-Tunnel. Die Mac-App verbindet sich direkt mit der Gateway-URL (z. B. über Tailscale Serve oder einen öffentlichen HTTPS-Reverse-Proxy).

## Remote-Transporte

Der Remote-Modus unterstützt zwei Transporte:

- **SSH-Tunnel** (Standard): Verwendet `ssh -N -L ...`, um den Gateway-Port zu localhost weiterzuleiten. Das Gateway sieht die IP des Knotens als `127.0.0.1`, da der Tunnel über loopback läuft.
- **Direkt (ws/wss)**: Verbindet sich direkt mit der Gateway-URL. Das Gateway sieht die echte Client-IP.

## Voraussetzungen auf dem Remote-Host

1. Installieren Sie Node + pnpm und bauen/installieren Sie die OpenClaw-CLI (`pnpm install && pnpm build && pnpm link --global`).
2. Stellen Sie sicher, dass `openclaw` für nicht-interaktive Shells im PATH liegt (bei Bedarf Symlink nach `/usr/local/bin` oder `/opt/homebrew/bin`).
3. Öffnen Sie SSH mit Schlüssel-Authentifizierung. Wir empfehlen **Tailscale**-IPs für stabile Erreichbarkeit außerhalb des LANs.

## macOS-App-Einrichtung

1. Öffnen Sie _Einstellungen → Allgemein_.
2. Wählen Sie unter **OpenClaw läuft** die Option **Remote over SSH** und legen Sie fest:
   - **Transport**: **SSH-Tunnel** oder **Direkt (ws/wss)**.
   - **SSH-Ziel**: `user@host` (optional `:port`).
     - Wenn sich das Gateway im selben LAN befindet und Bonjour bewirbt, wählen Sie es aus der erkannten Liste aus, um dieses Feld automatisch auszufüllen.
   - **Gateway-URL** (nur Direkt): `wss://gateway.example.ts.net` (oder `ws://...` für lokal/LAN).
   - **Identity-Datei** (erweitert): Pfad zu Ihrem Schlüssel.
   - **Projekt-Root** (erweitert): Remote-Checkout-Pfad, der für Befehle verwendet wird.
   - **CLI-Pfad** (erweitert): Optionaler Pfad zu einem ausführbaren `openclaw`-Entrypoint/Binary (wird automatisch ausgefüllt, wenn beworben).
3. Klicken Sie auf **Remote testen**. Erfolg zeigt an, dass das entfernte `openclaw status --json` korrekt läuft. Fehler bedeuten meist PATH-/CLI-Probleme; Exit 127 heißt, dass die CLI remote nicht gefunden wird.
4. Gesundheitsprüfungen und Web Chat laufen nun automatisch über diesen SSH-Tunnel.

## Web Chat

- **SSH-Tunnel**: Web Chat verbindet sich über den weitergeleiteten WebSocket-Steuerport (Standard 18789) mit dem Gateway.
- **Direkt (ws/wss)**: Web Chat verbindet sich direkt mit der konfigurierten Gateway-URL.
- Es gibt keinen separaten WebChat-HTTP-Server mehr.

## Berechtigungen

- Der Remote-Host benötigt dieselben TCC-Freigaben wie lokal (Automation, Bedienungshilfen, Bildschirmaufnahme, Mikrofon, Spracherkennung, Mitteilungen). Führen Sie die Einführung auf dieser Maschine aus, um sie einmalig zu erteilen.
- Knoten bewerben ihren Berechtigungsstatus über `node.list` / `node.describe`, damit Agents wissen, was verfügbar ist.

## Sicherheitshinweise

- Bevorzugen Sie loopback-Bindings auf dem Remote-Host und verbinden Sie sich über SSH oder Tailscale.
- Wenn Sie das Gateway an ein Nicht-loopback-Interface binden, verlangen Sie Token-/Passwort-Authentifizierung.
- Siehe [Security](/gateway/security) und [Tailscale](/gateway/tailscale).

## WhatsApp-Anmeldeablauf (remote)

- Führen Sie `openclaw channels login --verbose` **auf dem Remote-Host** aus. Scannen Sie den QR-Code mit WhatsApp auf Ihrem Telefon.
- Führen Sie die Anmeldung auf diesem Host erneut aus, wenn die Authentifizierung abläuft. Die Gesundheitsprüfung weist auf Verbindungsprobleme hin.

## Fehlerbehebung

- **exit 127 / nicht gefunden**: `openclaw` ist für Nicht-Login-Shells nicht im PATH. Fügen Sie es zu `/etc/paths`, Ihrer Shell-rc hinzu oder erstellen Sie einen Symlink nach `/usr/local/bin`/`/opt/homebrew/bin`.
- **Health probe failed**: Prüfen Sie SSH-Erreichbarkeit, PATH und dass Baileys angemeldet ist (`openclaw status --json`).
- **Web Chat hängt**: Bestätigen Sie, dass das Gateway auf dem Remote-Host läuft und der weitergeleitete Port dem Gateway-WS-Port entspricht; die UI benötigt eine funktionierende WS-Verbindung.
- **Node-IP zeigt 127.0.0.1**: Mit dem SSH-Tunnel erwartet. Wechseln Sie **Transport** zu **Direkt (ws/wss)**, wenn das Gateway die echte Client-IP sehen soll.
- **Voice Wake**: Trigger-Phrasen werden im Remote-Modus automatisch weitergeleitet; kein separater Forwarder erforderlich.

## Benachrichtigungstöne

Wählen Sie Töne pro Benachrichtigung aus Skripten mit `openclaw` und `node.invoke`, z. B.:

```bash
openclaw nodes notify --node <id> --title "Ping" --body "Remote gateway ready" --sound Glass
```

Es gibt in der App keinen globalen Schalter „Standardton“ mehr; Aufrufer wählen pro Anfrage einen Ton (oder keinen).
