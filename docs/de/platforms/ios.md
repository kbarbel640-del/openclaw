---
summary: „iOS-Knoten-App: Verbindung zum Gateway, Pairing, Canvas und Fehlerbehebung“
read_when:
  - Pairing oder erneutes Verbinden des iOS-Knotens
  - Ausführen der iOS-App aus dem Quellcode
  - Debuggen der Gateway-Erkennung oder von Canvas-Befehlen
title: „iOS-App“
x-i18n:
  source_path: platforms/ios.md
  source_hash: 692eebdc82e4bb8d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:59Z
---

# iOS-App (Knoten)

Verfügbarkeit: interne Vorschau. Die iOS-App wird derzeit noch nicht öffentlich verteilt.

## Was sie tut

- Stellt eine Verbindung zu einem Gateway über WebSocket her (LAN oder Tailnet).
- Stellt Knotenfähigkeiten bereit: Canvas, Bildschirm-Snapshot, Kameraaufnahme, Standort, Sprechmodus, Sprachaktivierung.
- Empfängt `node.invoke`-Befehle und meldet Knoten-Statusereignisse.

## Anforderungen

- Gateway läuft auf einem anderen Gerät (macOS, Linux oder Windows über WSL2).
- Netzwerkpfad:
  - Gleiches LAN über Bonjour, **oder**
  - Tailnet über unicast DNS-SD (Beispieldomain: `openclaw.internal.`), **oder**
  - Manueller Host/Port (Fallback).

## Schnellstart (Pairing + Verbinden)

1. Starten Sie das Gateway:

```bash
openclaw gateway --port 18789
```

2. Öffnen Sie in der iOS-App die Einstellungen und wählen Sie ein erkanntes Gateway (oder aktivieren Sie „Manual Host“ und geben Sie Host/Port ein).

3. Genehmigen Sie die Pairing-Anfrage auf dem Gateway-Host:

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
```

4. Verbindung prüfen:

```bash
openclaw nodes status
openclaw gateway call node.list --params "{}"
```

## Erkennungspfade

### Bonjour (LAN)

Das Gateway bewirbt `_openclaw-gw._tcp` auf `local.`. Die iOS-App listet diese automatisch auf.

### Tailnet (netzwerkübergreifend)

Wenn mDNS blockiert ist, verwenden Sie eine unicast DNS-SD-Zone (wählen Sie eine Domain; Beispiel: `openclaw.internal.`) und Tailscale Split DNS.
Siehe [Bonjour](/gateway/bonjour) fuer alle Details zum CoreDNS-Beispiel.

### Manueller Host/Port

Aktivieren Sie in den Einstellungen **Manual Host** und geben Sie den Gateway-Host + Port ein (Standard `18789`).

## Canvas + A2UI

Der iOS-Knoten rendert ein WKWebView-Canvas. Verwenden Sie `node.invoke`, um es zu steuern:

```bash
openclaw nodes invoke --node "iOS Node" --command canvas.navigate --params '{"url":"http://<gateway-host>:18793/__openclaw__/canvas/"}'
```

Hinweise:

- Der Gateway-Canvas-Host stellt `/__openclaw__/canvas/` und `/__openclaw__/a2ui/` bereit.
- Der iOS-Knoten navigiert beim Verbinden automatisch zu A2UI, wenn eine Canvas-Host-URL beworben wird.
- Kehren Sie mit `canvas.navigate` und `{"url":""}` zum integrierten Scaffold zurück.

### Canvas eval / Snapshot

```bash
openclaw nodes invoke --node "iOS Node" --command canvas.eval --params '{"javaScript":"(() => { const {ctx} = window.__openclaw; ctx.clearRect(0,0,innerWidth,innerHeight); ctx.lineWidth=6; ctx.strokeStyle=\"#ff2d55\"; ctx.beginPath(); ctx.moveTo(40,40); ctx.lineTo(innerWidth-40, innerHeight-40); ctx.stroke(); return \"ok\"; })()"}'
```

```bash
openclaw nodes invoke --node "iOS Node" --command canvas.snapshot --params '{"maxWidth":900,"format":"jpeg"}'
```

## Sprachaktivierung + Sprechmodus

- Sprachaktivierung und Sprechmodus sind in den Einstellungen verfügbar.
- iOS kann Hintergrundaudio anhalten; behandeln Sie Sprachfunktionen als Best-Effort, wenn die App nicht aktiv ist.

## Häufige Fehler

- `NODE_BACKGROUND_UNAVAILABLE`: Bringen Sie die iOS-App in den Vordergrund (Canvas-/Kamera-/Bildschirmbefehle erfordern dies).
- `A2UI_HOST_NOT_CONFIGURED`: Das Gateway hat keine Canvas-Host-URL beworben; prüfen Sie `canvasHost` in der [Gateway-Konfiguration](/gateway/configuration).
- Pairing-Eingabeaufforderung erscheint nie: Führen Sie `openclaw nodes pending` aus und genehmigen Sie manuell.
- Erneutes Verbinden schlägt nach Neuinstallation fehl: Das Pairing-Token im Schlüsselbund wurde gelöscht; koppeln Sie den Knoten erneut.

## Verwandte Dokumente

- [Pairing](/gateway/pairing)
- [Erkennung](/gateway/discovery)
- [Bonjour](/gateway/bonjour)
