---
summary: "Browserbasierte Control UI für das Gateway (Chat, Knoten, Konfiguration)"
read_when:
  - Sie das Gateway über einen Browser bedienen möchten
  - Sie Tailnet-Zugriff ohne SSH-Tunnel wünschen
title: "Control UI"
x-i18n:
  source_path: web/control-ui.md
  source_hash: ad239e4a4354999a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:05Z
---

# Control UI (Browser)

Die Control UI ist eine kleine **Vite + Lit** Single-Page-App, die vom Gateway bereitgestellt wird:

- Standard: `http://<host>:18789/`
- optionales Präfix: setzen Sie `gateway.controlUi.basePath` (z. B. `/openclaw`)

Sie spricht **direkt mit dem Gateway-WebSocket** auf demselben Port.

## Schnell öffnen (lokal)

Wenn das Gateway auf demselben Computer läuft, öffnen Sie:

- http://127.0.0.1:18789/ (oder http://localhost:18789/)

Wenn die Seite nicht lädt, starten Sie zuerst das Gateway: `openclaw gateway`.

Die Authentifizierung erfolgt während des WebSocket-Handshakes über:

- `connect.params.auth.token`
- `connect.params.auth.password`
  Im Einstellungsbereich des Dashboards können Sie ein Token speichern; Passwörter werden nicht persistiert.
  Der Einführungsassistent erzeugt standardmäßig ein Gateway-Token; fügen Sie es beim ersten Verbinden hier ein.

## Geräte-Pairing (erste Verbindung)

Wenn Sie die Control UI von einem neuen Browser oder Gerät aus verbinden, verlangt das Gateway
eine **einmalige Pairing-Freigabe** — selbst wenn Sie sich im selben Tailnet
mit `gateway.auth.allowTailscale: true` befinden. Dies ist eine Sicherheitsmaßnahme zum Schutz vor
unbefugtem Zugriff.

**Was Sie sehen:** „disconnected (1008): pairing required“

**So genehmigen Sie das Gerät:**

```bash
# List pending requests
openclaw devices list

# Approve by request ID
openclaw devices approve <requestId>
```

Nach der Genehmigung wird das Gerät gespeichert und erfordert keine erneute Freigabe, es sei denn,
Sie widerrufen sie mit `openclaw devices revoke --device <id> --role <role>`. Siehe
[Devices CLI](/cli/devices) für Token-Rotation und -Widerruf.

**Hinweise:**

- Lokale Verbindungen (`127.0.0.1`) werden automatisch genehmigt.
- Remote-Verbindungen (LAN, Tailnet usw.) erfordern eine explizite Genehmigung.
- Jedes Browserprofil erzeugt eine eindeutige Geräte-ID; ein Browserwechsel oder
  das Löschen von Browserdaten erfordert daher ein erneutes Pairing.

## Was sie (heute) kann

- Chat mit dem Modell über Gateway WS (`chat.history`, `chat.send`, `chat.abort`, `chat.inject`)
- Tool-Aufrufe streamen + Live-Tool-Ausgabekarten im Chat (Agent-Ereignisse)
- Kanäle: WhatsApp/Telegram/Discord/Slack + Plugin-Kanäle (Mattermost usw.) Status + QR-Login + kanalweise Konfiguration (`channels.status`, `web.login.*`, `config.patch`)
- Instanzen: Präsenzliste + Aktualisieren (`system-presence`)
- Sitzungen: Liste + sitzungsspezifische Thinking/Verbose-Overrides (`sessions.list`, `sessions.patch`)
- Cron-Jobs: Auflisten/Hinzufügen/Ausführen/Aktivieren/Deaktivieren + Ausführungsverlauf (`cron.*`)
- Skills: Status, Aktivieren/Deaktivieren, Installieren, API-Schlüssel-Updates (`skills.*`)
- Knoten: Liste + Capabilities (`node.list`)
- Exec-Freigaben: Gateway- oder Knoten-Allowlisten bearbeiten + Richtlinie für `exec host=gateway/node` abfragen (`exec.approvals.*`)
- Konfiguration: Anzeigen/Bearbeiten von `~/.openclaw/openclaw.json` (`config.get`, `config.set`)
- Konfiguration: Anwenden + Neustart mit Validierung (`config.apply`) und Aufwecken der zuletzt aktiven Sitzung
- Konfigurationsschreibvorgänge enthalten eine Base-Hash-Schutzfunktion, um das Überschreiben paralleler Änderungen zu verhindern
- Konfigurationsschema + Formular-Rendering (`config.schema`, einschließlich Plugin- und Kanal-Schemata); Roh-JSON-Editor bleibt verfügbar
- Debug: Status-/Health-/Modell-Snapshots + Ereignisprotokoll + manuelle RPC-Aufrufe (`status`, `health`, `models.list`)
- Logs: Live-Tail der Gateway-Dateilogs mit Filter/Export (`logs.tail`)
- Update: Paket-/Git-Update ausführen + Neustart (`update.run`) mit Neustartbericht

Hinweise zum Cron-Jobs-Panel:

- Für isolierte Jobs ist die Auslieferung standardmäßig auf Zusammenfassung ankündigen gesetzt. Sie können auf „none“ wechseln, wenn Sie nur interne Läufe möchten.
- Die Felder Kanal/Ziel erscheinen, wenn „announce“ ausgewählt ist.

## Chat-Verhalten

- `chat.send` ist **nicht blockierend**: Es bestätigt sofort mit `{ runId, status: "started" }`, und die Antwort wird über `chat`-Ereignisse gestreamt.
- Erneutes Senden mit derselben `idempotencyKey` liefert `{ status: "in_flight" }` während der Ausführung und `{ status: "ok" }` nach Abschluss.
- `chat.inject` fügt dem Sitzungsprotokoll eine Assistenten-Notiz hinzu und sendet ein `chat`-Ereignis für UI-only-Updates (kein Agent-Lauf, keine Kanalzustellung).
- Stoppen:
  - Klicken Sie auf **Stop** (ruft `chat.abort` auf)
  - Tippen Sie `/stop` (oder `stop|esc|abort|wait|exit|interrupt`), um außerhalb des Bandes abzubrechen
  - `chat.abort` unterstützt `{ sessionKey }` (kein `runId`), um alle aktiven Läufe für diese Sitzung abzubrechen

## Tailnet-Zugriff (empfohlen)

### Integriertes Tailscale Serve (bevorzugt)

Belassen Sie das Gateway auf local loopback und lassen Sie Tailscale Serve es per HTTPS proxyen:

```bash
openclaw gateway --tailscale serve
```

Öffnen Sie:

- `https://<magicdns>/` (oder Ihr konfiguriertes `gateway.controlUi.basePath`)

Standardmäßig können Serve-Anfragen über Tailscale-Identitäts-Header
(`tailscale-user-login`) authentifiziert werden, wenn `gateway.auth.allowTailscale` auf `true` gesetzt ist. OpenClaw
verifiziert die Identität, indem es die `x-forwarded-for`-Adresse mit
`tailscale whois` auflöst und mit dem Header abgleicht, und akzeptiert diese nur, wenn die
Anfrage local loopback mit Tailscales `x-forwarded-*`-Headern erreicht. Setzen Sie
`gateway.auth.allowTailscale: false` (oder erzwingen Sie `gateway.auth.mode: "password"`),
wenn Sie auch für Serve-Traffic ein Token/Passwort verlangen möchten.

### An Tailnet binden + Token

```bash
openclaw gateway --bind tailnet --token "$(openssl rand -hex 32)"
```

Öffnen Sie dann:

- `http://<tailscale-ip>:18789/` (oder Ihr konfiguriertes `gateway.controlUi.basePath`)

Fügen Sie das Token in den UI-Einstellungen ein (wird als `connect.params.auth.token` gesendet).

## Unsicheres HTTP

Wenn Sie das Dashboard über reines HTTP öffnen (`http://<lan-ip>` oder `http://<tailscale-ip>`),
läuft der Browser in einem **nicht sicheren Kontext** und blockiert WebCrypto. Standardmäßig
**blockiert** OpenClaw Control-UI-Verbindungen ohne Geräteidentität.

**Empfohlene Lösung:** Verwenden Sie HTTPS (Tailscale Serve) oder öffnen Sie die UI lokal:

- `https://<magicdns>/` (Serve)
- `http://127.0.0.1:18789/` (auf dem Gateway-Host)

**Downgrade-Beispiel (nur Token über HTTP):**

```json5
{
  gateway: {
    controlUi: { allowInsecureAuth: true },
    bind: "tailnet",
    auth: { mode: "token", token: "replace-me" },
  },
}
```

Dies deaktiviert Geräteidentität + Pairing für die Control UI (selbst über HTTPS). Verwenden Sie dies
nur, wenn Sie dem Netzwerk vertrauen.

Siehe [Tailscale](/gateway/tailscale) für Hinweise zur HTTPS-Einrichtung.

## UI bauen

Das Gateway stellt statische Dateien aus `dist/control-ui` bereit. Bauen Sie diese mit:

```bash
pnpm ui:build # auto-installs UI deps on first run
```

Optionaler absoluter Base-Pfad (wenn Sie feste Asset-URLs wünschen):

```bash
OPENCLAW_CONTROL_UI_BASE_PATH=/openclaw/ pnpm ui:build
```

Für lokale Entwicklung (separater Dev-Server):

```bash
pnpm ui:dev # auto-installs UI deps on first run
```

Richten Sie die UI anschließend auf die Gateway-WS-URL aus (z. B. `ws://127.0.0.1:18789`).

## Debugging/Tests: Dev-Server + Remote-Gateway

Die Control UI besteht aus statischen Dateien; das WebSocket-Ziel ist konfigurierbar und kann sich
vom HTTP-Origin unterscheiden. Das ist praktisch, wenn Sie den Vite-Dev-Server lokal nutzen, das Gateway
aber anderswo läuft.

1. Starten Sie den UI-Dev-Server: `pnpm ui:dev`
2. Öffnen Sie eine URL wie:

```text
http://localhost:5173/?gatewayUrl=ws://<gateway-host>:18789
```

Optionale einmalige Authentifizierung (falls erforderlich):

```text
http://localhost:5173/?gatewayUrl=wss://<gateway-host>:18789&token=<gateway-token>
```

Hinweise:

- `gatewayUrl` wird nach dem Laden in localStorage gespeichert und aus der URL entfernt.
- `token` wird in localStorage gespeichert; `password` wird nur im Speicher gehalten.
- Wenn `gatewayUrl` gesetzt ist, greift die UI nicht auf Konfigurations- oder Umgebungsanmeldedaten zurück.
  Geben Sie `token` (oder `password`) explizit an. Fehlende explizite Anmeldedaten sind ein Fehler.
- Verwenden Sie `wss://`, wenn das Gateway hinter TLS steht (Tailscale Serve, HTTPS-Proxy usw.).
- `gatewayUrl` wird nur in einem Top-Level-Fenster akzeptiert (nicht eingebettet), um Clickjacking zu verhindern.
- Für Cross-Origin-Dev-Setups (z. B. `pnpm ui:dev` zu einem Remote-Gateway) fügen Sie den UI-Origin zu
  `gateway.controlUi.allowedOrigins` hinzu.

Beispiel:

```json5
{
  gateway: {
    controlUi: {
      allowedOrigins: ["http://localhost:5173"],
    },
  },
}
```

Details zur Remote-Zugriffseinrichtung: [Remote access](/gateway/remote).
