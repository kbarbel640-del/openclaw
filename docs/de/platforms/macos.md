---
summary: "OpenClaw macOS‑Begleit‑App (Menüleiste + Gateway‑Broker)"
read_when:
  - Implementierung von macOS‑App‑Funktionen
  - Änderung des Gateway‑Lebenszyklus oder der Node‑Bridging‑Logik unter macOS
title: "macOS‑App"
x-i18n:
  source_path: platforms/macos.md
  source_hash: a5b1c02e5905e4cb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:16Z
---

# OpenClaw macOS Companion (Menüleiste + Gateway‑Broker)

Die macOS‑App ist der **Menüleisten‑Begleiter** für OpenClaw. Sie verwaltet Berechtigungen,
managt/attachiert sich lokal an das Gateway (launchd oder manuell) und stellt macOS‑
Funktionen dem Agenten als Node zur Verfügung.

## Was sie tut

- Zeigt native Benachrichtigungen und Status in der Menüleiste an.
- Verwaltet TCC‑Abfragen (Mitteilungen, Bedienungshilfen, Bildschirmaufnahme, Mikrofon,
  Spracherkennung, Automation/AppleScript).
- Startet oder verbindet sich mit dem Gateway (lokal oder remote).
- Stellt macOS‑spezifische Werkzeuge bereit (Canvas, Camera, Screen Recording, `system.run`).
- Startet den lokalen Node‑Host‑Dienst im **Remote**‑Modus (launchd) und stoppt ihn im **Local**‑Modus.
- Hostet optional **PeekabooBridge** für UI‑Automatisierung.
- Installiert auf Wunsch die globale CLI (`openclaw`) via npm/pnpm (bun wird für die Gateway‑Runtime nicht empfohlen).

## Local‑ vs. Remote‑Modus

- **Local** (Standard): Die App hängt sich an ein laufendes lokales Gateway an; andernfalls
  aktiviert sie den launchd‑Dienst via `openclaw gateway install`.
- **Remote**: Die App verbindet sich über SSH/Tailscale mit einem Gateway und startet
  niemals einen lokalen Prozess.
  Die App startet den lokalen **Node‑Host‑Dienst**, damit das entfernte Gateway diesen Mac erreichen kann.
  Die App startet das Gateway nicht als Child‑Prozess.

## Launchd‑Steuerung

Die App verwaltet einen benutzerspezifischen LaunchAgent mit dem Label `bot.molt.gateway`
(oder `bot.molt.<profile>` bei Verwendung von `--profile`/`OPENCLAW_PROFILE`; Legacy `com.openclaw.*` entlädt weiterhin).

```bash
launchctl kickstart -k gui/$UID/bot.molt.gateway
launchctl bootout gui/$UID/bot.molt.gateway
```

Ersetzen Sie das Label durch `bot.molt.<profile>`, wenn Sie ein benanntes Profil ausführen.

Ist der LaunchAgent nicht installiert, aktivieren Sie ihn in der App oder führen Sie
`openclaw gateway install` aus.

## Node‑Fähigkeiten (mac)

Die macOS‑App präsentiert sich als Node. Häufige Befehle:

- Canvas: `canvas.present`, `canvas.navigate`, `canvas.eval`, `canvas.snapshot`, `canvas.a2ui.*`
- Camera: `camera.snap`, `camera.clip`
- Screen: `screen.record`
- System: `system.run`, `system.notify`

Der Node meldet eine `permissions`‑Map, damit Agenten entscheiden können, was erlaubt ist.

Node‑Dienst + App‑IPC:

- Wenn der headless Node‑Host‑Dienst läuft (Remote‑Modus), verbindet er sich als Node mit dem Gateway‑WS.
- `system.run` wird in der macOS‑App (UI/TCC‑Kontext) über einen lokalen Unix‑Socket ausgeführt; Abfragen und Ausgaben bleiben in der App.

Diagramm (SCI):

```
Gateway -> Node Service (WS)
                 |  IPC (UDS + token + HMAC + TTL)
                 v
             Mac App (UI + TCC + system.run)
```

## Exec‑Freigaben (system.run)

`system.run` wird durch **Exec‑Freigaben** in der macOS‑App gesteuert (Einstellungen → Exec‑Freigaben).
Sicherheit + Nachfrage + Allowlist werden lokal auf dem Mac gespeichert in:

```
~/.openclaw/exec-approvals.json
```

Beispiel:

```json
{
  "version": 1,
  "defaults": {
    "security": "deny",
    "ask": "on-miss"
  },
  "agents": {
    "main": {
      "security": "allowlist",
      "ask": "on-miss",
      "allowlist": [{ "pattern": "/opt/homebrew/bin/rg" }]
    }
  }
}
```

Hinweise:

- `allowlist`‑Einträge sind Glob‑Muster für aufgelöste Binärpfade.
- Die Auswahl „Immer erlauben“ im Prompt fügt den Befehl zur Allowlist hinzu.
- `system.run`‑Umgebungsüberschreibungen werden gefiltert (verwirft `PATH`, `DYLD_*`, `LD_*`, `NODE_OPTIONS`, `PYTHON*`, `PERL*`, `RUBYOPT`) und anschließend mit der Umgebung der App zusammengeführt.

## Deep Links

Die App registriert das URL‑Schema `openclaw://` für lokale Aktionen.

### `openclaw://agent`

Löst eine Gateway‑`agent`‑Anfrage aus.

```bash
open 'openclaw://agent?message=Hello%20from%20deep%20link'
```

Query‑Parameter:

- `message` (erforderlich)
- `sessionKey` (optional)
- `thinking` (optional)
- `deliver` / `to` / `channel` (optional)
- `timeoutSeconds` (optional)
- `key` (optional, unbeaufsichtigter Modus‑Schlüssel)

Sicherheit:

- Ohne `key` fordert die App eine Bestätigung an.
- Mit einem gültigen `key` läuft der Vorgang unbeaufsichtigt (für persönliche Automatisierungen gedacht).

## Onboarding‑Ablauf (typisch)

1. Installieren und starten Sie **OpenClaw.app**.
2. Schließen Sie die Berechtigungs‑Checkliste ab (TCC‑Abfragen).
3. Stellen Sie sicher, dass der **Local**‑Modus aktiv ist und das Gateway läuft.
4. Installieren Sie die CLI, wenn Sie Terminal‑Zugriff wünschen.

## Build‑ & Dev‑Workflow (nativ)

- `cd apps/macos && swift build`
- `swift run OpenClaw` (oder Xcode)
- App paketieren: `scripts/package-mac-app.sh`

## Debuggen der Gateway‑Konnektivität (macOS‑CLI)

Verwenden Sie die Debug‑CLI, um denselben Gateway‑WebSocket‑Handshake und die
Erkennungslogik auszuführen, die die macOS‑App verwendet – ohne die App zu starten.

```bash
cd apps/macos
swift run openclaw-mac connect --json
swift run openclaw-mac discover --timeout 3000 --json
```

Verbindungsoptionen:

- `--url <ws://host:port>`: Konfiguration überschreiben
- `--mode <local|remote>`: aus der Konfiguration auflösen (Standard: config oder local)
- `--probe`: frische Health‑Probe erzwingen
- `--timeout <ms>`: Request‑Timeout (Standard: `15000`)
- `--json`: strukturierte Ausgabe zum Vergleichen

Erkennungsoptionen:

- `--include-local`: Gateways einschließen, die als „local“ gefiltert würden
- `--timeout <ms>`: gesamtes Erkennungsfenster (Standard: `2000`)
- `--json`: strukturierte Ausgabe zum Vergleichen

Tipp: Vergleichen Sie mit `openclaw gateway discover --json`, um zu sehen, ob sich die
Erkennungspipeline der macOS‑App (NWBrowser + tailnet‑DNS‑SD‑Fallback) von der
Node‑CLI‑basierten Erkennung mit `dns-sd` unterscheidet.

## Remote‑Verbindungs‑Plumbing (SSH‑Tunnel)

Wenn die macOS‑App im **Remote**‑Modus läuft, öffnet sie einen SSH‑Tunnel, damit lokale UI‑
Komponenten mit einem entfernten Gateway kommunizieren können, als wäre es auf localhost.

### Control‑Tunnel (Gateway‑WebSocket‑Port)

- **Zweck:** Health‑Checks, Status, Web‑Chat, Konfiguration und weitere Control‑Plane‑Aufrufe.
- **Lokaler Port:** der Gateway‑Port (Standard `18789`), immer stabil.
- **Remote‑Port:** derselbe Gateway‑Port auf dem entfernten Host.
- **Verhalten:** kein zufälliger lokaler Port; die App verwendet einen bestehenden gesunden Tunnel wieder
  oder startet ihn bei Bedarf neu.
- **SSH‑Form:** `ssh -N -L <local>:127.0.0.1:<remote>` mit BatchMode +
  ExitOnForwardFailure + Keepalive‑Optionen.
- **IP‑Reporting:** Der SSH‑Tunnel verwendet Loopback, daher sieht das Gateway die Node‑IP als `127.0.0.1`.
  Verwenden Sie den Transport **Direct (ws/wss)**, wenn die echte Client‑IP erscheinen soll
  (siehe [macOS remote access](/platforms/mac/remote)).

Für die Einrichtung siehe [macOS remote access](/platforms/mac/remote). Für Protokolldetails
siehe [Gateway protocol](/gateway/protocol).

## Verwandte Dokumente

- [Gateway runbook](/gateway)
- [Gateway (macOS)](/platforms/mac/bundled-gateway)
- [macOS permissions](/platforms/mac/permissions)
- [Canvas](/platforms/mac/canvas)
