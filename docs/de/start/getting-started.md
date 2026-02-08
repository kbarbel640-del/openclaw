---
summary: "Installieren Sie OpenClaw und starten Sie Ihren ersten Chat in wenigen Minuten."
read_when:
  - Ersteinrichtung von Grund auf
  - Sie moechten den schnellsten Weg zu einem funktionierenden Chat
title: "Erste Schritte"
x-i18n:
  source_path: start/getting-started.md
  source_hash: 27aeeb3d18c49538
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:31Z
---

# Erste Schritte

Ziel: Mit minimalem Setup von null zu einem ersten funktionierenden Chat gelangen.

<Info>
Schnellster Chat: Oeffnen Sie die Control UI (keine Kanal-Einrichtung erforderlich). Fuehren Sie `openclaw dashboard` aus
und chatten Sie im Browser, oder oeffnen Sie `http://127.0.0.1:18789/` auf dem
<Tooltip headline="Gateway host" tip="Die Maschine, auf der der OpenClaw-Gateway-Dienst laeuft.">Gateway-Host</Tooltip>.
Docs: [Dashboard](/web/dashboard) und [Control UI](/web/control-ui).
</Info>

## Voraussetzungen

- Node 22 oder neuer

<Tip>
Pruefen Sie Ihre Node-Version mit `node --version`, falls Sie unsicher sind.
</Tip>

## Schnellstart (CLI)

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
    Weitere Installationsmethoden und Anforderungen: [Install](/install).
    </Note>

  </Step>
  <Step title="Einfuehrungsassistent ausfuehren">
    ```bash
    openclaw onboard --install-daemon
    ```

    Der Assistent konfiguriert Authentifizierung, Gateway-Einstellungen und optionale Kanaele.
    Siehe [Onboarding Wizard](/start/wizard) fuer Details.

  </Step>
  <Step title="Gateway pruefen">
    Wenn Sie den Dienst installiert haben, sollte er bereits laufen:

    ```bash
    openclaw gateway status
    ```

  </Step>
  <Step title="Control UI oeffnen">
    ```bash
    openclaw dashboard
    ```
  </Step>
</Steps>

<Check>
Wenn die Control UI geladen wird, ist Ihr Gateway einsatzbereit.
</Check>

## Optionale Pruefungen und Extras

<AccordionGroup>
  <Accordion title="Gateway im Vordergrund ausfuehren">
    Nuetzlich fuer schnelle Tests oder zur Fehlerbehebung.

    ```bash
    openclaw gateway --port 18789
    ```

  </Accordion>
  <Accordion title="Testnachricht senden">
    Erfordert einen konfigurierten Kanal.

    ```bash
    openclaw message send --target +15555550123 --message "Hello from OpenClaw"
    ```

  </Accordion>
</AccordionGroup>

## Tiefer einsteigen

<Columns>
  <Card title="Onboarding Wizard (Details)" href="/start/wizard">
    Vollstaendige CLI-Referenz des Assistenten und erweiterte Optionen.
  </Card>
  <Card title="macOS-App-Onboarding" href="/start/onboarding">
    Ablauf beim ersten Start der macOS-App.
  </Card>
</Columns>

## Was Sie haben werden

- Ein laufendes Gateway
- Konfigurierte Authentifizierung
- Zugriff auf die Control UI oder einen verbundenen Kanal

## Naechste Schritte

- DM-Sicherheit und Freigaben: [Pairing](/start/pairing)
- Weitere Kanaele verbinden: [Channels](/channels)
- Erweiterte Workflows und Build aus dem Quellcode: [Setup](/start/setup)
