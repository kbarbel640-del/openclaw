---
summary: "Integrierter Browser-Steuerungsdienst + Aktionsbefehle"
read_when:
  - Hinzufuegen agentgesteuerter Browser-Automatisierung
  - Debugging, warum OpenClaw Ihren eigenen Chrome beeintraechtigt
  - Implementierung von Browser-Einstellungen und -Lebenszyklus in der macOS-App
title: "Browser (OpenClaw-verwaltet)"
x-i18n:
  source_path: tools/browser.md
  source_hash: a868d040183436a1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:24Z
---

# Browser (openclaw-verwaltet)

OpenClaw kann ein **dediziertes Chrome-/Brave-/Edge-/Chromium-Profil** ausfuehren, das vom Agenten gesteuert wird.
Es ist von Ihrem persoenlichen Browser isoliert und wird ueber einen kleinen lokalen
Steuerungsdienst innerhalb des Gateway verwaltet (nur loopback).

Anfaengeransicht:

- Stellen Sie es sich als einen **separaten, nur fuer Agenten bestimmten Browser** vor.
- Das Profil `openclaw` greift **nicht** auf Ihr persoenliches Browserprofil zu.
- Der Agent kann **Tabs oeffnen, Seiten lesen, klicken und tippen** in einer sicheren Spur.
- Das Standardprofil `chrome` verwendet den **systemweiten Standard-Chromium-Browser** ueber das
  Extension-Relay; wechseln Sie zu `openclaw` fuer den isolierten, verwalteten Browser.

## Was Sie erhalten

- Ein separates Browserprofil namens **openclaw** (standardmaessig mit orangefarbenem Akzent).
- Deterministische Tab-Steuerung (auflisten/oeffnen/fokussieren/schliessen).
- Agentenaktionen (klicken/tippen/ziehen/auswaehlen), Snapshots, Screenshots, PDFs.
- Optionale Multi-Profil-Unterstuetzung (`openclaw`, `work`, `remote`, ...).

Dieser Browser ist **nicht** Ihr taeglicher Arbeitsbrowser. Er ist eine sichere, isolierte Oberflaeche fuer
Agentenautomatisierung und -verifikation.

## Schnellstart

```bash
openclaw browser --browser-profile openclaw status
openclaw browser --browser-profile openclaw start
openclaw browser --browser-profile openclaw open https://example.com
openclaw browser --browser-profile openclaw snapshot
```

Wenn „Browser deaktiviert“ angezeigt wird, aktivieren Sie ihn in der Konfiguration (siehe unten) und starten Sie das
Gateway neu.

## Profile: `openclaw` vs `chrome`

- `openclaw`: verwalteter, isolierter Browser (keine Erweiterung erforderlich).
- `chrome`: Extension-Relay zu Ihrem **Systembrowser** (erfordert, dass die OpenClaw-
  Erweiterung an einen Tab angehaengt ist).

Setzen Sie `browser.defaultProfile: "openclaw"`, wenn Sie den verwalteten Modus standardmaessig verwenden moechten.

## Konfiguration

Browser-Einstellungen befinden sich in `~/.openclaw/openclaw.json`.

```json5
{
  browser: {
    enabled: true, // default: true
    // cdpUrl: "http://127.0.0.1:18792", // legacy single-profile override
    remoteCdpTimeoutMs: 1500, // remote CDP HTTP timeout (ms)
    remoteCdpHandshakeTimeoutMs: 3000, // remote CDP WebSocket handshake timeout (ms)
    defaultProfile: "chrome",
    color: "#FF4500",
    headless: false,
    noSandbox: false,
    attachOnly: false,
    executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    profiles: {
      openclaw: { cdpPort: 18800, color: "#FF4500" },
      work: { cdpPort: 18801, color: "#0066CC" },
      remote: { cdpUrl: "http://10.0.0.42:9222", color: "#00AA00" },
    },
  },
}
```

Hinweise:

- Der Browser-Steuerungsdienst bindet an loopback auf einem Port, der von `gateway.port`
  abgeleitet ist (Standard: `18791`, also Gateway + 2). Das Relay verwendet den naechsten Port (`18792`).
- Wenn Sie den Gateway-Port ueberschreiben (`gateway.port` oder `OPENCLAW_GATEWAY_PORT`),
  verschieben sich die abgeleiteten Browser-Ports, um in derselben „Familie“ zu bleiben.
- `cdpUrl` verwendet standardmaessig den Relay-Port, wenn er nicht gesetzt ist.
- `remoteCdpTimeoutMs` gilt fuer Remote- (Nicht-loopback-) CDP-Erreichbarkeitspruefungen.
- `remoteCdpHandshakeTimeoutMs` gilt fuer Remote-CDP-WebSocket-Erreichbarkeitspruefungen.
- `attachOnly: true` bedeutet „nie einen lokalen Browser starten; nur anhaengen, wenn er bereits laeuft“.
- `color` plus profilspezifisches `color` faerben die Browser-UI, sodass Sie sehen, welches Profil aktiv ist.
- Standardprofil ist `chrome` (Extension-Relay). Verwenden Sie `defaultProfile: "openclaw"` fuer den verwalteten Browser.
- Auto-Erkennungsreihenfolge: Systemstandardbrowser, falls Chromium-basiert; andernfalls Chrome → Brave → Edge → Chromium → Chrome Canary.
- Lokale `openclaw`-Profile weisen `cdpPort`/`cdpUrl` automatisch zu — setzen Sie diese nur fuer Remote-CDP.

## Brave (oder einen anderen Chromium-basierten Browser) verwenden

Wenn Ihr **Systemstandardbrowser** Chromium-basiert ist (Chrome/Brave/Edge/etc.),
verwendet OpenClaw ihn automatisch. Setzen Sie `browser.executablePath`, um die
Auto-Erkennung zu ueberschreiben:

CLI-Beispiel:

```bash
openclaw config set browser.executablePath "/usr/bin/google-chrome"
```

```json5
// macOS
{
  browser: {
    executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
  }
}

// Windows
{
  browser: {
    executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"
  }
}

// Linux
{
  browser: {
    executablePath: "/usr/bin/brave-browser"
  }
}
```

## Lokale vs. Remote-Steuerung

- **Lokale Steuerung (Standard):** Das Gateway startet den loopback-Steuerungsdienst und kann einen lokalen Browser starten.
- **Remote-Steuerung (Node-Host):** Fuehren Sie einen Node-Host auf dem Rechner aus, der den Browser hat; das Gateway leitet Browser-Aktionen dorthin weiter.
- **Remote-CDP:** Setzen Sie `browser.profiles.<name>.cdpUrl` (oder `browser.cdpUrl`), um
  sich an einen entfernten Chromium-basierten Browser anzuhaengen. In diesem Fall startet OpenClaw keinen lokalen Browser.

Remote-CDP-URLs koennen Authentifizierung enthalten:

- Query-Tokens (z. B. `https://provider.example?token=<token>`)
- HTTP-Basic-Auth (z. B. `https://user:pass@provider.example`)

OpenClaw behaelt die Authentifizierung bei Aufrufen von `/json/*`-Endpunkten sowie bei der Verbindung
zum CDP-WebSocket bei. Bevorzugen Sie Umgebungsvariablen oder Secrets-Manager fuer
Tokens, anstatt sie in Konfigurationsdateien zu hinterlegen.

## Node-Browser-Proxy (Zero-Config-Standard)

Wenn Sie einen **Node-Host** auf dem Rechner ausfuehren, der Ihren Browser hat, kann OpenClaw
Browser-Tool-Aufrufe automatisch an diesen Node weiterleiten, ohne zusaetzliche Browser-Konfiguration.
Dies ist der Standardpfad fuer Remote-Gateways.

Hinweise:

- Der Node-Host stellt seinen lokalen Browser-Steuerungsserver ueber einen **Proxy-Befehl** bereit.
- Profile stammen aus der eigenen `browser.profiles`-Konfiguration des Nodes (wie lokal).
- Deaktivieren, falls nicht gewuenscht:
  - Auf dem Node: `nodeHost.browserProxy.enabled=false`
  - Auf dem Gateway: `gateway.nodes.browser.mode="off"`

## Browserless (gehostetes Remote-CDP)

[Browserless](https://browserless.io) ist ein gehosteter Chromium-Dienst, der
CDP-Endpunkte ueber HTTPS bereitstellt. Sie koennen ein OpenClaw-Browserprofil auf einen
Browserless-Regionsendpunkt verweisen und sich mit Ihrem API-Schluessel authentifizieren.

Beispiel:

```json5
{
  browser: {
    enabled: true,
    defaultProfile: "browserless",
    remoteCdpTimeoutMs: 2000,
    remoteCdpHandshakeTimeoutMs: 4000,
    profiles: {
      browserless: {
        cdpUrl: "https://production-sfo.browserless.io?token=<BROWSERLESS_API_KEY>",
        color: "#00AA00",
      },
    },
  },
}
```

Hinweise:

- Ersetzen Sie `<BROWSERLESS_API_KEY>` durch Ihr echtes Browserless-Token.
- Waehlen Sie den Regionsendpunkt, der zu Ihrem Browserless-Konto passt (siehe deren Dokumentation).

## Sicherheit

Kernideen:

- Die Browser-Steuerung ist nur ueber loopback erreichbar; der Zugriff erfolgt ueber die Authentifizierung des Gateway oder das Node-Pairing.
- Halten Sie das Gateway und alle Node-Hosts in einem privaten Netzwerk (Tailscale); vermeiden Sie oeffentliche Exposition.
- Behandeln Sie Remote-CDP-URLs/Tokens als Geheimnisse; bevorzugen Sie Umgebungsvariablen oder einen Secrets-Manager.

Remote-CDP-Tipps:

- Bevorzugen Sie HTTPS-Endpunkte und kurzlebige Tokens, wenn moeglich.
- Vermeiden Sie es, langlebige Tokens direkt in Konfigurationsdateien einzubetten.

## Profile (Multi-Browser)

OpenClaw unterstuetzt mehrere benannte Profile (Routing-Konfigurationen). Profile koennen sein:

- **openclaw-managed**: eine dedizierte Chromium-basierte Browserinstanz mit eigenem User-Data-Verzeichnis + CDP-Port
- **remote**: eine explizite CDP-URL (Chromium-basierter Browser, der woanders laeuft)
- **extension relay**: Ihre bestehenden Chrome-Tabs ueber das lokale Relay + Chrome-Erweiterung

Standards:

- Das Profil `openclaw` wird automatisch erstellt, falls es fehlt.
- Das Profil `chrome` ist integriert fuer das Chrome-Extension-Relay (verweist standardmaessig auf `http://127.0.0.1:18792`).
- Lokale CDP-Ports werden standardmaessig aus **18800–18899** vergeben.
- Das Loeschen eines Profils verschiebt dessen lokales Datenverzeichnis in den Papierkorb.

Alle Steuerungsendpunkte akzeptieren `?profile=<name>`; die CLI verwendet `--browser-profile`.

## Chrome-Extension-Relay (verwenden Sie Ihren bestehenden Chrome)

OpenClaw kann auch **Ihre bestehenden Chrome-Tabs steuern** (keine separate „openclaw“-Chrome-Instanz) ueber ein lokales CDP-Relay + eine Chrome-Erweiterung.

Vollstaendige Anleitung: [Chrome extension](/tools/chrome-extension)

Ablauf:

- Das Gateway laeuft lokal (derselbe Rechner) oder ein Node-Host laeuft auf dem Browser-Rechner.
- Ein lokaler **Relay-Server** lauscht auf einer loopback-`cdpUrl` (Standard: `http://127.0.0.1:18792`).
- Sie klicken auf das Erweiterungssymbol **OpenClaw Browser Relay** in einem Tab, um anzuhaengen (keine automatische Anhaengung).
- Der Agent steuert diesen Tab ueber das normale `browser`-Werkzeug, indem er das richtige Profil auswaehlt.

Wenn das Gateway woanders laeuft, starten Sie einen Node-Host auf dem Browser-Rechner, damit das Gateway Browser-Aktionen weiterleiten kann.

### Sitzungen in einer Sandbox

Wenn die Agentensitzung sandboxed ist, kann das Werkzeug `browser` standardmaessig auf `target="sandbox"` (Sandbox-Browser) gehen.
Die Uebernahme ueber das Chrome-Extension-Relay erfordert Host-Browser-Steuerung, daher entweder:

- die Sitzung nicht sandboxed ausfuehren oder
- `agents.defaults.sandbox.browser.allowHostControl: true` setzen und beim Aufruf des Werkzeugs `target="host"` verwenden.

### Einrichtung

1. Erweiterung laden (dev/unpacked):

```bash
openclaw browser extension install
```

- Chrome → `chrome://extensions` → „Developer mode“ aktivieren
- „Load unpacked“ → das von `openclaw browser extension path` ausgegebene Verzeichnis auswaehlen
- Erweiterung anheften und dann im gewuenschten Tab anklicken (Badge zeigt `ON`).

2. Verwendung:

- CLI: `openclaw browser --browser-profile chrome tabs`
- Agentenwerkzeug: `browser` mit `profile="chrome"`

Optional: Wenn Sie einen anderen Namen oder Relay-Port moechten, erstellen Sie ein eigenes Profil:

```bash
openclaw browser create-profile \
  --name my-chrome \
  --driver extension \
  --cdp-url http://127.0.0.1:18792 \
  --color "#00AA00"
```

Hinweise:

- Dieser Modus basiert fuer die meisten Operationen (Screenshots/Snapshots/Aktionen) auf Playwright-ueber-CDP.
- Trennen Sie die Verbindung, indem Sie erneut auf das Erweiterungssymbol klicken.

## Isolationsgarantien

- **Dediziertes User-Data-Verzeichnis**: greift niemals auf Ihr persoenliches Browserprofil zu.
- **Dedizierte Ports**: vermeidet `9222`, um Kollisionen mit Entwickler-Workflows zu verhindern.
- **Deterministische Tab-Steuerung**: Ziel-Tabs werden ueber `targetId` angesprochen, nicht ueber „letzter Tab“.

## Browser-Auswahl

Beim lokalen Start waehlt OpenClaw den zuerst verfuegbaren:

1. Chrome
2. Brave
3. Edge
4. Chromium
5. Chrome Canary

Sie koennen dies mit `browser.executablePath` ueberschreiben.

Plattformen:

- macOS: prueft `/Applications` und `~/Applications`.
- Linux: sucht nach `google-chrome`, `brave`, `microsoft-edge`, `chromium` usw.
- Windows: prueft gaengige Installationspfade.

## Control-API (optional)

Nur fuer lokale Integrationen stellt das Gateway eine kleine loopback-HTTP-API bereit:

- Status/Start/Stopp: `GET /`, `POST /start`, `POST /stop`
- Tabs: `GET /tabs`, `POST /tabs/open`, `POST /tabs/focus`, `DELETE /tabs/:targetId`
- Snapshot/Screenshot: `GET /snapshot`, `POST /screenshot`
- Aktionen: `POST /navigate`, `POST /act`
- Hooks: `POST /hooks/file-chooser`, `POST /hooks/dialog`
- Downloads: `POST /download`, `POST /wait/download`
- Debugging: `GET /console`, `POST /pdf`
- Debugging: `GET /errors`, `GET /requests`, `POST /trace/start`, `POST /trace/stop`, `POST /highlight`
- Netzwerk: `POST /response/body`
- Zustand: `GET /cookies`, `POST /cookies/set`, `POST /cookies/clear`
- Zustand: `GET /storage/:kind`, `POST /storage/:kind/set`, `POST /storage/:kind/clear`
- Einstellungen: `POST /set/offline`, `POST /set/headers`, `POST /set/credentials`, `POST /set/geolocation`, `POST /set/media`, `POST /set/timezone`, `POST /set/locale`, `POST /set/device`

Alle Endpunkte akzeptieren `?profile=<name>`.

### Playwright-Anforderung

Einige Funktionen (Navigation/Aktion/AI-Snapshot/Rollen-Snapshot, Element-Screenshots, PDF) erfordern
Playwright. Wenn Playwright nicht installiert ist, liefern diese Endpunkte einen klaren 501-
Fehler. ARIA-Snapshots und einfache Screenshots funktionieren weiterhin fuer openclaw-verwaltetes Chrome.
Fuer den Chrome-Extension-Relay-Treiber erfordern ARIA-Snapshots und Screenshots Playwright.

Wenn Sie `Playwright is not available in this gateway build` sehen, installieren Sie das vollstaendige
Playwright-Paket (nicht `playwright-core`) und starten Sie das Gateway neu oder installieren Sie
OpenClaw mit Browser-Unterstuetzung neu.

#### Docker-Playwright-Installation

Wenn Ihr Gateway in Docker laeuft, vermeiden Sie `npx playwright` (npm-Override-Konflikte).
Verwenden Sie stattdessen die gebuendelte CLI:

```bash
docker compose run --rm openclaw-cli \
  node /app/node_modules/playwright-core/cli.js install chromium
```

Um Browser-Downloads zu persistieren, setzen Sie `PLAYWRIGHT_BROWSERS_PATH` (zum Beispiel
`/home/node/.cache/ms-playwright`) und stellen Sie sicher, dass `/home/node` ueber
`OPENCLAW_HOME_VOLUME` oder ein Bind-Mount persistiert wird. Siehe [Docker](/install/docker).

## Funktionsweise (intern)

Ablauf auf hoher Ebene:

- Ein kleiner **Steuerungsserver** akzeptiert HTTP-Anfragen.
- Er verbindet sich ueber **CDP** mit Chromium-basierten Browsern (Chrome/Brave/Edge/Chromium).
- Fuer erweiterte Aktionen (klicken/tippen/Snapshot/PDF) verwendet er **Playwright** auf CDP.
- Wenn Playwright fehlt, stehen nur Nicht-Playwright-Operationen zur Verfuegung.

Dieses Design haelt den Agenten auf einer stabilen, deterministischen Schnittstelle, waehrend Sie lokale/remote Browser und Profile austauschen koennen.

## CLI-Schnellreferenz

Alle Befehle akzeptieren `--browser-profile <name>`, um ein bestimmtes Profil anzusprechen.
Alle Befehle akzeptieren ausserdem `--json` fuer maschinenlesbare Ausgabe (stabile Payloads).

Grundlagen:

- `openclaw browser status`
- `openclaw browser start`
- `openclaw browser stop`
- `openclaw browser tabs`
- `openclaw browser tab`
- `openclaw browser tab new`
- `openclaw browser tab select 2`
- `openclaw browser tab close 2`
- `openclaw browser open https://example.com`
- `openclaw browser focus abcd1234`
- `openclaw browser close abcd1234`

Inspektion:

- `openclaw browser screenshot`
- `openclaw browser screenshot --full-page`
- `openclaw browser screenshot --ref 12`
- `openclaw browser screenshot --ref e12`
- `openclaw browser snapshot`
- `openclaw browser snapshot --format aria --limit 200`
- `openclaw browser snapshot --interactive --compact --depth 6`
- `openclaw browser snapshot --efficient`
- `openclaw browser snapshot --labels`
- `openclaw browser snapshot --selector "#main" --interactive`
- `openclaw browser snapshot --frame "iframe#main" --interactive`
- `openclaw browser console --level error`
- `openclaw browser errors --clear`
- `openclaw browser requests --filter api --clear`
- `openclaw browser pdf`
- `openclaw browser responsebody "**/api" --max-chars 5000`

Aktionen:

- `openclaw browser navigate https://example.com`
- `openclaw browser resize 1280 720`
- `openclaw browser click 12 --double`
- `openclaw browser click e12 --double`
- `openclaw browser type 23 "hello" --submit`
- `openclaw browser press Enter`
- `openclaw browser hover 44`
- `openclaw browser scrollintoview e12`
- `openclaw browser drag 10 11`
- `openclaw browser select 9 OptionA OptionB`
- `openclaw browser download e12 /tmp/report.pdf`
- `openclaw browser waitfordownload /tmp/report.pdf`
- `openclaw browser upload /tmp/file.pdf`
- `openclaw browser fill --fields '[{"ref":"1","type":"text","value":"Ada"}]'`
- `openclaw browser dialog --accept`
- `openclaw browser wait --text "Done"`
- `openclaw browser wait "#main" --url "**/dash" --load networkidle --fn "window.ready===true"`
- `openclaw browser evaluate --fn '(el) => el.textContent' --ref 7`
- `openclaw browser highlight e12`
- `openclaw browser trace start`
- `openclaw browser trace stop`

Zustand:

- `openclaw browser cookies`
- `openclaw browser cookies set session abc123 --url "https://example.com"`
- `openclaw browser cookies clear`
- `openclaw browser storage local get`
- `openclaw browser storage local set theme dark`
- `openclaw browser storage session clear`
- `openclaw browser set offline on`
- `openclaw browser set headers --json '{"X-Debug":"1"}'`
- `openclaw browser set credentials user pass`
- `openclaw browser set credentials --clear`
- `openclaw browser set geo 37.7749 -122.4194 --origin "https://example.com"`
- `openclaw browser set geo --clear`
- `openclaw browser set media dark`
- `openclaw browser set timezone America/New_York`
- `openclaw browser set locale en-US`
- `openclaw browser set device "iPhone 14"`

Hinweise:

- `upload` und `dialog` sind **Scharfmachungs**-Aufrufe; fuehren Sie sie vor dem Klick/Tastendruck aus,
  der den Auswahl-Dialog ausloest.
- `upload` kann Dateieingaben auch direkt ueber `--input-ref` oder `--element` setzen.
- `snapshot`:
  - `--format ai` (Standard, wenn Playwright installiert ist): gibt einen AI-Snapshot mit numerischen Referenzen (`aria-ref="<n>"`) zurueck.
  - `--format aria`: gibt den Accessibility-Tree zurueck (keine Referenzen; nur Inspektion).
  - `--efficient` (oder `--mode efficient`): kompaktes Rollen-Snapshot-Preset (interaktiv + kompakt + Tiefe + geringere maxChars).
  - Konfigurationsstandard (nur Tool/CLI): setzen Sie `browser.snapshotDefaults.mode: "efficient"`, um effiziente Snapshots zu verwenden, wenn der Aufrufer keinen Modus uebergibt (siehe [Gateway-Konfiguration](/gateway/configuration#browser-openclaw-managed-browser)).
  - Rollen-Snapshot-Optionen (`--interactive`, `--compact`, `--depth`, `--selector`) erzwingen ein rollenbasiertes Snapshot mit Referenzen wie `ref=e12`.
  - `--frame "<iframe selector>"` grenzt Rollen-Snapshots auf ein iframe ein (kombiniert mit Rollen-Referenzen wie `e12`).
  - `--interactive` gibt eine flache, leicht auswaehlbare Liste interaktiver Elemente aus (am besten fuer Aktionen).
  - `--labels` fuegt einen Screenshot nur des Viewports mit ueberlagerten Referenzlabels hinzu (gibt `MEDIA:<path>` aus).
- `click`/`type`/etc. erfordern eine `ref` aus `snapshot` (entweder numerische `12` oder Rollen-Referenz `e12`).
  CSS-Selektoren werden absichtlich nicht fuer Aktionen unterstuetzt.

## Snapshots und Referenzen

OpenClaw unterstuetzt zwei „Snapshot“-Stile:

- **AI-Snapshot (numerische Referenzen)**: `openclaw browser snapshot` (Standard; `--format ai`)
  - Ausgabe: ein Text-Snapshot, das numerische Referenzen enthaelt.
  - Aktionen: `openclaw browser click 12`, `openclaw browser type 23 "hello"`.
  - Intern wird die Referenz ueber Playwrights `aria-ref` aufgeloest.

- **Rollen-Snapshot (Rollen-Referenzen wie `e12`)**: `openclaw browser snapshot --interactive` (oder `--compact`, `--depth`, `--selector`, `--frame`)
  - Ausgabe: eine rollenbasierte Liste/Baum mit `[ref=e12]` (und optional `[nth=1]`).
  - Aktionen: `openclaw browser click e12`, `openclaw browser highlight e12`.
  - Intern wird die Referenz ueber `getByRole(...)` aufgeloest (plus `nth()` bei Duplikaten).
  - Fuegen Sie `--labels` hinzu, um einen Viewport-Screenshot mit ueberlagerten `e12`-Labels einzuschliessen.

Referenzverhalten:

- Referenzen sind **nicht stabil ueber Navigationen hinweg**; wenn etwas fehlschlaegt, fuehren Sie `snapshot` erneut aus und verwenden Sie eine frische Referenz.
- Wenn der Rollen-Snapshot mit `--frame` aufgenommen wurde, sind Rollen-Referenzen bis zum naechsten Rollen-Snapshot auf dieses iframe beschraenkt.

## Wait-Power-ups

Sie koennen auf mehr als nur Zeit/Text warten:

- Warten auf URL (Globs werden von Playwright unterstuetzt):
  - `openclaw browser wait --url "**/dash"`
- Warten auf Ladezustand:
  - `openclaw browser wait --load networkidle`
- Warten auf eine JS-Praedikatfunktion:
  - `openclaw browser wait --fn "window.ready===true"`
- Warten darauf, dass ein Selektor sichtbar wird:
  - `openclaw browser wait "#main"`

Diese koennen kombiniert werden:

```bash
openclaw browser wait "#main" \
  --url "**/dash" \
  --load networkidle \
  --fn "window.ready===true" \
  --timeout-ms 15000
```

## Debug-Workflows

Wenn eine Aktion fehlschlaegt (z. B. „nicht sichtbar“, „Strict-Mode-Verletzung“, „ueberdeckt“):

1. `openclaw browser snapshot --interactive`
2. Verwenden Sie `click <ref>` / `type <ref>` (bevorzugen Sie Rollen-Referenzen im interaktiven Modus)
3. Wenn es weiterhin fehlschlaegt: `openclaw browser highlight <ref>`, um zu sehen, worauf Playwright abzielt
4. Wenn sich die Seite merkwuerdig verhaelt:
   - `openclaw browser errors --clear`
   - `openclaw browser requests --filter api --clear`
5. Fuer tiefgehendes Debugging: zeichnen Sie einen Trace auf:
   - `openclaw browser trace start`
   - reproduzieren Sie das Problem
   - `openclaw browser trace stop` (gibt `TRACE:<path>` aus)

## JSON-Ausgabe

`--json` ist fuer Scripting und strukturierte Tools gedacht.

Beispiele:

```bash
openclaw browser status --json
openclaw browser snapshot --interactive --json
openclaw browser requests --filter api --json
openclaw browser cookies --json
```

Rollen-Snapshots in JSON enthalten `refs` plus einen kleinen `stats`-Block (Zeilen/Zeichen/Referenzen/interaktiv), damit Tools die Payload-Groesse und -Dichte bewerten koennen.

## Zustands- und Umgebungsregler

Diese sind nuetzlich fuer Workflows vom Typ „die Seite soll sich wie X verhalten“:

- Cookies: `cookies`, `cookies set`, `cookies clear`
- Storage: `storage local|session get|set|clear`
- Offline: `set offline on|off`
- Header: `set headers --json '{"X-Debug":"1"}'` (oder `--clear`)
- HTTP-Basic-Auth: `set credentials user pass` (oder `--clear`)
- Geolocation: `set geo <lat> <lon> --origin "https://example.com"` (oder `--clear`)
- Medien: `set media dark|light|no-preference|none`
- Zeitzone / Locale: `set timezone ...`, `set locale ...`
- Geraet / Viewport:
  - `set device "iPhone 14"` (Playwright-Geraete-Presets)
  - `set viewport 1280 720`

## Sicherheit & Datenschutz

- Das openclaw-Browserprofil kann eingeloggte Sitzungen enthalten; behandeln Sie es als sensibel.
- `browser act kind=evaluate` / `openclaw browser evaluate` und `wait --fn`
  fuehren beliebigen JavaScript-Code im Seitenkontext aus. Prompt-Injection kann dies beeinflussen.
  Deaktivieren Sie es mit `browser.evaluateEnabled=false`, wenn Sie es nicht benoetigen.
- Fuer Logins und Anti-Bot-Hinweise (X/Twitter usw.) siehe [Browser login + X/Twitter posting](/tools/browser-login).
- Halten Sie Gateway/Node-Host privat (nur loopback oder Tailnet).
- Remote-CDP-Endpunkte sind maechtig; tunneln und schuetzen Sie sie.

## Fehlerbehebung

Fuer Linux-spezifische Probleme (insbesondere Snap-Chromium) siehe
[Browser troubleshooting](/tools/browser-linux-troubleshooting).

## Agenten-Tools + Funktionsweise der Steuerung

Der Agent erhaelt **ein Werkzeug** fuer Browser-Automatisierung:

- `browser` — Status/Start/Stopp/Tabs/Oeffnen/Fokussieren/Schliessen/Snapshot/Screenshot/Navigation/Aktion

Abbildung:

- `browser snapshot` gibt einen stabilen UI-Baum zurueck (AI oder ARIA).
- `browser act` verwendet die Snapshot-`ref`-IDs zum Klicken/Tippen/Ziehen/Auswaehlen.
- `browser screenshot` erfasst Pixel (ganze Seite oder Element).
- `browser` akzeptiert:
  - `profile`, um ein benanntes Browserprofil auszuwaehlen (openclaw, chrome oder remote CDP).
  - `target` (`sandbox` | `host` | `node`), um auszuwaehlen, wo der Browser lebt.
  - In sandboxed Sitzungen erfordert `target: "host"` `agents.defaults.sandbox.browser.allowHostControl=true`.
  - Wenn `target` fehlt: sandboxed Sitzungen verwenden standardmaessig `sandbox`, nicht-sandboxed Sitzungen standardmaessig `host`.
  - Wenn ein browserfaehiger Node verbunden ist, kann das Werkzeug automatisch dorthin routen, es sei denn, Sie fixieren `target="host"` oder `target="node"`.

Dies haelt den Agenten deterministisch und vermeidet fragile Selektoren.
