---
summary: "Chrome-Erweiterung: OpenClaw steuert Ihren bestehenden Chrome-Tab"
read_when:
  - Sie möchten, dass der Agent einen bestehenden Chrome-Tab steuert (Toolbar-Schaltfläche)
  - Sie benötigen einen entfernten Gateway + lokale Browser-Automatisierung über Tailscale
  - Sie möchten die Sicherheitsauswirkungen einer Browser-Übernahme verstehen
title: "Chrome-Erweiterung"
x-i18n:
  source_path: tools/chrome-extension.md
  source_hash: 3b77bdad7d3dab6a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:49Z
---

# Chrome-Erweiterung (Browser-Relay)

Die OpenClaw Chrome-Erweiterung ermöglicht es dem Agenten, Ihre **bestehenden Chrome-Tabs** (Ihr normales Chrome-Fenster) zu steuern, anstatt ein separates, von OpenClaw verwaltetes Chrome-Profil zu starten.

Das Anhängen/Trennen erfolgt über **eine einzelne Chrome-Toolbar-Schaltfläche**.

## Was es ist (Konzept)

Es gibt drei Bestandteile:

- **Browser-Steuerungsdienst** (Gateway oder Node): die API, die der Agent/das Werkzeug aufruft (über den Gateway)
- **Lokaler Relay-Server** (loopback CDP): vermittelt zwischen dem Steuerungsserver und der Erweiterung (standardmäßig `http://127.0.0.1:18792`)
- **Chrome MV3-Erweiterung**: hängt sich mit `chrome.debugger` an den aktiven Tab an und leitet CDP-Nachrichten an das Relay weiter

OpenClaw steuert den angehängten Tab anschließend über die normale `browser`-Werkzeugoberfläche (unter Auswahl des richtigen Profils).

## Installieren / Laden (unpacked)

1. Installieren Sie die Erweiterung in einen stabilen lokalen Pfad:

```bash
openclaw browser extension install
```

2. Geben Sie den installierten Erweiterungsverzeichnis-Pfad aus:

```bash
openclaw browser extension path
```

3. Chrome → `chrome://extensions`

- „Developer mode“ aktivieren
- „Load unpacked“ → das oben ausgegebene Verzeichnis auswählen

4. Die Erweiterung anpinnen.

## Updates (kein Build-Schritt)

Die Erweiterung wird innerhalb der OpenClaw-Version (npm-Paket) als statische Dateien ausgeliefert. Es gibt keinen separaten „Build“-Schritt.

Nach einem Upgrade von OpenClaw:

- Führen Sie `openclaw browser extension install` erneut aus, um die installierten Dateien unter Ihrem OpenClaw-Zustandsverzeichnis zu aktualisieren.
- Chrome → `chrome://extensions` → klicken Sie bei der Erweiterung auf „Reload“.

## Nutzung (keine zusätzliche Konfiguration)

OpenClaw wird mit einem integrierten Browserprofil namens `chrome` ausgeliefert, das auf das Erweiterungs-Relay am Standardport zielt.

So verwenden Sie es:

- CLI: `openclaw browser --browser-profile chrome tabs`
- Agent-Werkzeug: `browser` mit `profile="chrome"`

Wenn Sie einen anderen Namen oder einen anderen Relay-Port möchten, erstellen Sie Ihr eigenes Profil:

```bash
openclaw browser create-profile \
  --name my-chrome \
  --driver extension \
  --cdp-url http://127.0.0.1:18792 \
  --color "#00AA00"
```

## Anhängen / Trennen (Toolbar-Schaltfläche)

- Öffnen Sie den Tab, den OpenClaw steuern soll.
- Klicken Sie auf das Erweiterungssymbol.
  - Das Badge zeigt `ON` an, wenn angehängt.
- Klicken Sie erneut, um zu trennen.

## Welchen Tab steuert es?

- Es steuert **nicht** automatisch „den Tab, den Sie gerade ansehen“.
- Es steuert **nur die Tabs, die Sie explizit angehängt** haben, indem Sie auf die Toolbar-Schaltfläche geklickt haben.
- Zum Wechseln: Öffnen Sie den anderen Tab und klicken Sie dort auf das Erweiterungssymbol.

## Badge + häufige Fehler

- `ON`: angehängt; OpenClaw kann diesen Tab steuern.
- `…`: Verbindung zum lokalen Relay wird hergestellt.
- `!`: Relay nicht erreichbar (am häufigsten: der Browser-Relay-Server läuft auf diesem Rechner nicht).

Wenn Sie `!` sehen:

- Stellen Sie sicher, dass der Gateway lokal läuft (Standardeinrichtung), oder starten Sie einen Node-Host auf diesem Rechner, wenn der Gateway woanders läuft.
- Öffnen Sie die Optionsseite der Erweiterung; dort wird angezeigt, ob das Relay erreichbar ist.

## Remote Gateway (Node-Host verwenden)

### Lokaler Gateway (gleicher Rechner wie Chrome) — in der Regel **keine zusätzlichen Schritte**

Wenn der Gateway auf demselben Rechner wie Chrome läuft, startet er den Browser-Steuerungsdienst auf loopback
und startet den Relay-Server automatisch. Die Erweiterung spricht mit dem lokalen Relay; die CLI-/Werkzeugaufrufe gehen an den Gateway.

### Remote Gateway (Gateway läuft woanders) — **Node-Host ausführen**

Wenn Ihr Gateway auf einem anderen Rechner läuft, starten Sie einen Node-Host auf dem Rechner, auf dem Chrome läuft.
Der Gateway proxyt Browser-Aktionen zu diesem Node; die Erweiterung + das Relay bleiben lokal auf dem Browser-Rechner.

Wenn mehrere Nodes verbunden sind, fixieren Sie einen mit `gateway.nodes.browser.node` oder setzen Sie `gateway.nodes.browser.mode`.

## Sandboxing (Werkzeug-Container)

Wenn Ihre Agent-Sitzung in einer Sandbox läuft (`agents.defaults.sandbox.mode != "off"`), kann das `browser`-Werkzeug eingeschränkt sein:

- Standardmäßig zielen Sitzungen in einer Sandbox oft auf den **Sandbox-Browser** (`target="sandbox"`), nicht auf Ihren Host-Chrome.
- Die Übernahme über das Chrome-Erweiterungs-Relay erfordert die Kontrolle des **Host**-Browser-Steuerungsservers.

Optionen:

- Am einfachsten: Verwenden Sie die Erweiterung aus einer **nicht in einer Sandbox** laufenden Sitzung/einem Agenten.
- Oder erlauben Sie die Host-Browser-Steuerung für Sitzungen in einer Sandbox:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        browser: {
          allowHostControl: true,
        },
      },
    },
  },
}
```

Stellen Sie anschließend sicher, dass das Werkzeug nicht durch die Werkzeugrichtlinie verweigert wird, und rufen Sie (falls erforderlich) `browser` mit `target="host"` auf.

Debugging: `openclaw sandbox explain`

## Tipps für den Remote-Zugriff

- Halten Sie Gateway und Node-Host im selben Tailnet; vermeiden Sie es, Relay-Ports im LAN oder im öffentlichen Internet freizugeben.
- Koppeln Sie Nodes bewusst; deaktivieren Sie das Browser-Proxy-Routing, wenn Sie keine Fernsteuerung möchten (`gateway.nodes.browser.mode="off"`).

## Wie der „extension path“ funktioniert

`openclaw browser extension path` gibt das **installierte** Verzeichnis auf der Festplatte aus, das die Erweiterungsdateien enthält.

Die CLI gibt absichtlich **keinen** `node_modules`-Pfad aus. Führen Sie immer zuerst `openclaw browser extension install` aus, um die Erweiterung an einen stabilen Ort unter Ihrem OpenClaw-Zustandsverzeichnis zu kopieren.

Wenn Sie dieses Installationsverzeichnis verschieben oder löschen, markiert Chrome die Erweiterung als defekt, bis Sie sie von einem gültigen Pfad erneut laden.

## Sicherheitsauswirkungen (bitte lesen)

Dies ist leistungsfähig und riskant. Behandeln Sie es so, als würden Sie dem Modell „Hände an Ihrem Browser“ geben.

- Die Erweiterung nutzt die Debugger-API von Chrome (`chrome.debugger`). Wenn sie angehängt ist, kann das Modell:
  - klicken/schreiben/navigieren in diesem Tab
  - Seiteninhalte lesen
  - auf alles zugreifen, worauf die angemeldete Sitzung des Tabs Zugriff hat
- **Dies ist nicht isoliert** wie das dedizierte, von OpenClaw verwaltete Profil.
  - Wenn Sie Ihr tägliches Profil/Tab anhängen, gewähren Sie Zugriff auf diesen Kontozustand.

Empfehlungen:

- Bevorzugen Sie ein dediziertes Chrome-Profil (getrennt von Ihrem persönlichen Surfen) für die Nutzung des Erweiterungs-Relays.
- Halten Sie den Gateway und alle Node-Hosts ausschließlich im Tailnet; verlassen Sie sich auf Gateway-Authentifizierung + Node-Kopplung.
- Vermeiden Sie es, Relay-Ports über das LAN freizugeben (`0.0.0.0`) und vermeiden Sie Funnel (öffentlich).
- Das Relay blockiert Nicht-Erweiterungs-Ursprünge und erfordert ein internes Auth-Token für CDP-Clients.

Verwandt:

- Übersicht zum Browser-Werkzeug: [Browser](/tools/browser)
- Sicherheitsaudit: [Security](/gateway/security)
- Tailscale-Einrichtung: [Tailscale](/gateway/tailscale)
