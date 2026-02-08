---
summary: "Installiere OpenClaw und starte deinen ersten Chat in wenigen Minuten."
read_when:
  - Ersteinrichtung von Grund auf
  - Du willst den schnellsten Weg zu einem funktionierenden Chat
title: "Erste Schritte"
x-i18n:
  generated_at: "2026-02-08T22:00:00Z"
  model: claude-sonnet-4
  provider: pi
  source_hash: 6c93ffa2625c5778e4d8534284eadac80d8d052bab0333185cce495d2acecf01
  source_path: start/getting-started.md
  workflow: 15
---

# Erste Schritte

Ziel: Von Null zum ersten funktionierenden Chat mit minimaler Einrichtung.

<Info>
Schnellster Chat: Öffne die Control UI (keine Kanal-Einrichtung nötig). Führe `openclaw dashboard`
aus und chatte im Browser, oder öffne `http://127.0.0.1:18789/` auf dem
<Tooltip headline="Gateway-Host" tip="Der Rechner, auf dem der OpenClaw Gateway-Dienst läuft.">Gateway-Host</Tooltip>.
Dokumentation: [Dashboard](/web/dashboard) und [Control UI](/web/control-ui).
</Info>

## Voraussetzungen

- Node 22 oder neuer

<Tip>
Prüfe deine Node-Version mit `node --version`, falls du unsicher bist.
</Tip>

## Schnelle Einrichtung (CLI)

<Steps>
  <Step title="OpenClaw installieren (empfohlen)">
    <Tabs>
      <Tab title="macOS/Linux">
        ```bash
        curl -fsSL https://openclaw.ai/install.sh | bash
        ```
      </Tab>
      <Tab title="Windows (PowerShell)">
        ```powershell
        iwr -useb https://openclaw.ai/install.ps1 | iex
        ```
      </Tab>
    </Tabs>

    <Note>
    Andere Installationsmethoden und Anforderungen: [Installation](/install).
    </Note>

  </Step>
  <Step title="Onboarding-Wizard ausführen">
    ```bash
    openclaw onboard --install-daemon
    ```

    Der Wizard konfiguriert Authentifizierung, Gateway-Einstellungen und optionale Kanäle.
    Siehe [Onboarding-Wizard](/start/wizard) für Details.

  </Step>
  <Step title="Gateway prüfen">
    Wenn du den Dienst installiert hast, sollte er bereits laufen:

    ```bash
    openclaw gateway status
    ```

  </Step>
  <Step title="Control UI öffnen">
    ```bash
    openclaw dashboard
    ```
  </Step>
</Steps>

<Check>
Wenn die Control UI lädt, ist dein Gateway einsatzbereit.
</Check>

## Optionale Prüfungen und Extras

<AccordionGroup>
  <Accordion title="Gateway im Vordergrund ausführen">
    Nützlich für schnelle Tests oder Fehlerbehebung.

    ```bash
    openclaw gateway --port 18789
    ```

  </Accordion>
  <Accordion title="Testnachricht senden">
    Erfordert einen konfigurierten Kanal.

    ```bash
    openclaw message send --target +15555550123 --message "Hallo von OpenClaw"
    ```

  </Accordion>
</AccordionGroup>

## Nützliche Umgebungsvariablen

Wenn du OpenClaw als Dienstkonto betreibst oder benutzerdefinierte Pfade für Konfiguration/Status möchtest:

- `OPENCLAW_HOME` legt das Home-Verzeichnis für die interne Pfadauflösung fest.
- `OPENCLAW_STATE_DIR` überschreibt das Status-Verzeichnis.
- `OPENCLAW_CONFIG_PATH` überschreibt den Pfad zur Konfigurationsdatei.

Vollständige Referenz der Umgebungsvariablen: [Umgebungsvariablen](/help/environment).

## Vertiefe dein Wissen

<Columns>
  <Card title="Onboarding-Wizard (Details)" href="/start/wizard">
    Vollständige CLI-Wizard-Referenz und erweiterte Optionen.
  </Card>
  <Card title="macOS-App Onboarding" href="/start/onboarding">
    Erststart-Ablauf für die macOS-App.
  </Card>
</Columns>

## Was du haben wirst

- Ein laufendes Gateway
- Konfigurierte Authentifizierung
- Zugriff auf die Control UI oder einen verbundenen Kanal

## Nächste Schritte

- DM-Sicherheit und Genehmigungen: [Kopplung](/channels/pairing)
- Weitere Kanäle verbinden: [Kanäle](/channels)
- Erweiterte Workflows und aus dem Quellcode: [Einrichtung](/start/setup)
