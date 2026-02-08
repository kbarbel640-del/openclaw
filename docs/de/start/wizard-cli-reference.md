---
summary: "Vollstaendige Referenz fuer den CLI-Onboarding-Ablauf, Auth-/Modell-Setup, Ausgaben und Interna"
read_when:
  - Sie benoetigen detailliertes Verhalten fuer openclaw onboard
  - Sie debuggen Onboarding-Ergebnisse oder integrieren Onboarding-Clients
title: "CLI-Onboarding-Referenz"
sidebarTitle: "CLI-Referenz"
x-i18n:
  source_path: start/wizard-cli-reference.md
  source_hash: 0ef6f01c3e29187b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:50Z
---

# CLI-Onboarding-Referenz

Diese Seite ist die vollstaendige Referenz fuer `openclaw onboard`.
Fuer die Kurzanleitung siehe [Onboarding-Assistent (CLI)](/start/wizard).

## Was der Assistent macht

Der lokale Modus (Standard) fuehrt Sie durch:

- Modell- und Auth-Setup (OpenAI Code Subscription OAuth, Anthropic API-Schluessel oder Setup-Token sowie MiniMax-, GLM-, Moonshot- und AI-Gateway-Optionen)
- Workspace-Speicherort und Bootstrap-Dateien
- Gateway-Einstellungen (Port, Bind, Auth, Tailscale)
- Kanaele und Anbieter (Telegram, WhatsApp, Discord, Google Chat, Mattermost-Plugin, Signal)
- Daemon-Installation (LaunchAgent oder systemd-User-Unit)
- Gesundheitscheck
- Skills-Setup

Der Remote-Modus konfiguriert diese Maschine, um sich mit einem Gateway an einem anderen Ort zu verbinden.
Er installiert oder aendert nichts auf dem Remote-Host.

## Details zum lokalen Ablauf

<Steps>
  <Step title="Erkennung bestehender Konfiguration">
    - Wenn `~/.openclaw/openclaw.json` existiert, waehlen Sie Behalten, Aendern oder Zuruecksetzen.
    - Ein erneutes Ausfuehren des Assistenten loescht nichts, es sei denn, Sie waehlen explizit Zuruecksetzen (oder uebergeben `--reset`).
    - Wenn die Konfiguration ungueltig ist oder veraltete Schluessel enthaelt, stoppt der Assistent und fordert Sie auf, vor dem Fortfahren `openclaw doctor` auszufuehren.
    - Zuruecksetzen verwendet `trash` und bietet Umfaenge:
      - Nur Konfiguration
      - Konfiguration + Zugangsdaten + Sitzungen
      - Vollstaendiges Zuruecksetzen (entfernt auch den Workspace)
  </Step>
  <Step title="Modell und Auth">
    - Die vollstaendige Optionsmatrix finden Sie unter [Auth- und Modelloptionen](#auth-and-model-options).
  </Step>
  <Step title="Workspace">
    - Standard `~/.openclaw/workspace` (konfigurierbar).
    - Erstellt Workspace-Dateien, die fuer das Bootstrap-Ritual beim ersten Start benoetigt werden.
    - Workspace-Layout: [Agent-Workspace](/concepts/agent-workspace).
  </Step>
  <Step title="Gateway">
    - Abfragen zu Port, Bind, Auth-Modus und Tailscale-Exposition.
    - Empfehlung: Token-Auth auch bei Loopback aktiviert lassen, damit lokale WS-Clients sich authentifizieren muessen.
    - Deaktivieren Sie Auth nur, wenn Sie jedem lokalen Prozess vollstaendig vertrauen.
    - Nicht-Loopback-Binds erfordern weiterhin Auth.
  </Step>
  <Step title="Kanaele">
    - [WhatsApp](/channels/whatsapp): optionaler QR-Login
    - [Telegram](/channels/telegram): Bot-Token
    - [Discord](/channels/discord): Bot-Token
    - [Google Chat](/channels/googlechat): Service-Account-JSON + Webhook-Audience
    - [Mattermost](/channels/mattermost) Plugin: Bot-Token + Basis-URL
    - [Signal](/channels/signal): optionale `signal-cli`-Installation + Kontokonfiguration
    - [BlueBubbles](/channels/bluebubbles): empfohlen fuer iMessage; Server-URL + Passwort + Webhook
    - [iMessage](/channels/imessage): legacy `imsg`-CLI-Pfad + DB-Zugriff
    - DM-Sicherheit: Standard ist Pairing. Die erste Direktnachricht sendet einen Code; genehmigen Sie ueber
      `openclaw pairing approve <channel> <code>` oder verwenden Sie Allowlists.
  </Step>
  <Step title="Daemon-Installation">
    - macOS: LaunchAgent
      - Erfordert eine angemeldete Benutzersitzung; fuer Headless-Betrieb einen benutzerdefinierten LaunchDaemon verwenden (nicht enthalten).
    - Linux und Windows ueber WSL2: systemd-User-Unit
      - Der Assistent versucht `loginctl enable-linger <user>`, damit das Gateway nach dem Logout weiterlaeuft.
      - Kann nach sudo fragen (schreibt `/var/lib/systemd/linger`); zuerst wird es ohne sudo versucht.
    - Laufzeitauswahl: Node (empfohlen; erforderlich fuer WhatsApp und Telegram). Bun wird nicht empfohlen.
  </Step>
  <Step title="Gesundheitscheck">
    - Startet das Gateway (falls noetig) und fuehrt `openclaw health` aus.
    - `openclaw status --deep` fuegt Gateway-Gesundheitspruefungen zur Statusausgabe hinzu.
  </Step>
  <Step title="Skills">
    - Liest verfuegbare Skills und prueft Anforderungen.
    - Laesst Sie den Node-Manager waehlen: npm oder pnpm (bun nicht empfohlen).
    - Installiert optionale Abhaengigkeiten (einige nutzen Homebrew unter macOS).
  </Step>
  <Step title="Abschluss">
    - Zusammenfassung und naechste Schritte, einschliesslich iOS-, Android- und macOS-App-Optionen.
  </Step>
</Steps>

<Note>
Wenn keine GUI erkannt wird, gibt der Assistent SSH-Port-Forwarding-Anweisungen fuer die Control UI aus, anstatt einen Browser zu oeffnen.
Wenn Control-UI-Assets fehlen, versucht der Assistent, sie zu bauen; Fallback ist `pnpm ui:build` (installiert UI-Abhaengigkeiten automatisch).
</Note>

## Details zum Remote-Modus

Der Remote-Modus konfiguriert diese Maschine, um sich mit einem Gateway an einem anderen Ort zu verbinden.

<Info>
Der Remote-Modus installiert oder aendert nichts auf dem Remote-Host.
</Info>

Was Sie festlegen:

- Remote-Gateway-URL (`ws://...`)
- Token, falls Remote-Gateway-Auth erforderlich ist (empfohlen)

<Note>
- Wenn das Gateway nur Loopback ist, verwenden Sie SSH-Tunneling oder ein Tailnet.
- Erkennungshinweise:
  - macOS: Bonjour (`dns-sd`)
  - Linux: Avahi (`avahi-browse`)
</Note>

## Auth- und Modelloptionen

<AccordionGroup>
  <Accordion title="Anthropic API-Schluessel (empfohlen)">
    Verwendet `ANTHROPIC_API_KEY`, falls vorhanden, oder fragt nach einem Schluessel und speichert ihn fuer die Daemon-Nutzung.
  </Accordion>
  <Accordion title="Anthropic OAuth (Claude Code CLI)">
    - macOS: prueft den Keychain-Eintrag „Claude Code-credentials“
    - Linux und Windows: verwendet `~/.claude/.credentials.json` wieder, falls vorhanden

    Waehlen Sie unter macOS „Always Allow“, damit Startvorgaenge von launchd nicht blockiert werden.

  </Accordion>
  <Accordion title="Anthropic-Token (Setup-Token einfuegen)">
    Fuehren Sie `claude setup-token` auf einer beliebigen Maschine aus und fuegen Sie dann den Token ein.
    Sie koennen ihn benennen; leer verwendet den Standard.
  </Accordion>
  <Accordion title="OpenAI Code Subscription (Wiederverwendung der Codex CLI)">
    Wenn `~/.codex/auth.json` existiert, kann der Assistent es wiederverwenden.
  </Accordion>
  <Accordion title="OpenAI Code Subscription (OAuth)">
    Browser-Ablauf; fuegen Sie `code#state` ein.

    Setzt `agents.defaults.model` auf `openai-codex/gpt-5.3-codex`, wenn das Modell nicht gesetzt ist oder `openai/*`.

  </Accordion>
  <Accordion title="OpenAI API-Schluessel">
    Verwendet `OPENAI_API_KEY`, falls vorhanden, oder fragt nach einem Schluessel und speichert ihn in
    `~/.openclaw/.env`, damit launchd ihn lesen kann.

    Setzt `agents.defaults.model` auf `openai/gpt-5.1-codex`, wenn das Modell nicht gesetzt ist, `openai/*` oder `openai-codex/*`.

  </Accordion>
  <Accordion title="OpenCode Zen">
    Fragt nach `OPENCODE_API_KEY` (oder `OPENCODE_ZEN_API_KEY`).
    Setup-URL: [opencode.ai/auth](https://opencode.ai/auth).
  </Accordion>
  <Accordion title="API-Schluessel (generisch)">
    Speichert den Schluessel fuer Sie.
  </Accordion>
  <Accordion title="Vercel AI Gateway">
    Fragt nach `AI_GATEWAY_API_KEY`.
    Weitere Details: [Vercel AI Gateway](/providers/vercel-ai-gateway).
  </Accordion>
  <Accordion title="Cloudflare AI Gateway">
    Fragt nach Account-ID, Gateway-ID und `CLOUDFLARE_AI_GATEWAY_API_KEY`.
    Weitere Details: [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway).
  </Accordion>
  <Accordion title="MiniMax M2.1">
    Die Konfiguration wird automatisch geschrieben.
    Weitere Details: [MiniMax](/providers/minimax).
  </Accordion>
  <Accordion title="Synthetic (Anthropic-kompatibel)">
    Fragt nach `SYNTHETIC_API_KEY`.
    Weitere Details: [Synthetic](/providers/synthetic).
  </Accordion>
  <Accordion title="Moonshot und Kimi Coding">
    Moonshot (Kimi K2) und Kimi-Coding-Konfigurationen werden automatisch geschrieben.
    Weitere Details: [Moonshot AI (Kimi + Kimi Coding)](/providers/moonshot).
  </Accordion>
  <Accordion title="Ueberspringen">
    Laesst Auth unkonfiguriert.
  </Accordion>
</AccordionGroup>

Modellverhalten:

- Waehlt ein Standardmodell aus den erkannten Optionen oder geben Sie Anbieter und Modell manuell ein.
- Der Assistent fuehrt eine Modellpruefung aus und warnt, wenn das konfigurierte Modell unbekannt ist oder Auth fehlt.

Zugangs- und Profilpfade:

- OAuth-Zugangsdaten: `~/.openclaw/credentials/oauth.json`
- Auth-Profile (API-Schluessel + OAuth): `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`

<Note>
Headless- und Server-Tipp: Schliessen Sie OAuth auf einer Maschine mit Browser ab und kopieren Sie anschliessend
`~/.openclaw/credentials/oauth.json` (oder `$OPENCLAW_STATE_DIR/credentials/oauth.json`)
auf den Gateway-Host.
</Note>

## Ausgaben und Interna

Typische Felder in `~/.openclaw/openclaw.json`:

- `agents.defaults.workspace`
- `agents.defaults.model` / `models.providers` (wenn Minimax gewaehlt)
- `gateway.*` (Modus, Bind, Auth, Tailscale)
- `channels.telegram.botToken`, `channels.discord.token`, `channels.signal.*`, `channels.imessage.*`
- Kanal-Allowlists (Slack, Discord, Matrix, Microsoft Teams), wenn Sie waehrend der Abfragen zustimmen (Namen werden nach Moeglichkeit zu IDs aufgeloest)
- `skills.install.nodeManager`
- `wizard.lastRunAt`
- `wizard.lastRunVersion`
- `wizard.lastRunCommit`
- `wizard.lastRunCommand`
- `wizard.lastRunMode`

`openclaw agents add` schreibt `agents.list[]` und optional `bindings`.

WhatsApp-Zugangsdaten liegen unter `~/.openclaw/credentials/whatsapp/<accountId>/`.
Sitzungen werden unter `~/.openclaw/agents/<agentId>/sessions/` gespeichert.

<Note>
Einige Kanaele werden als Plugins ausgeliefert. Wenn sie waehrend des Onboardings ausgewaehlt werden, fordert der Assistent zur Installation des Plugins (npm oder lokaler Pfad) auf, bevor die Kanal-Konfiguration erfolgt.
</Note>

Gateway-Assistent-RPC:

- `wizard.start`
- `wizard.next`
- `wizard.cancel`
- `wizard.status`

Clients (macOS-App und Control UI) koennen Schritte rendern, ohne die Onboarding-Logik neu zu implementieren.

Signal-Setup-Verhalten:

- Laedt das passende Release-Asset herunter
- Speichert es unter `~/.openclaw/tools/signal-cli/<version>/`
- Schreibt `channels.signal.cliPath` in die Konfiguration
- JVM-Builds erfordern Java 21
- Native Builds werden verwendet, wenn verfuegbar
- Windows nutzt WSL2 und folgt dem Linux-signal-cli-Ablauf innerhalb von WSL

## Verwandte Dokumente

- Onboarding-Hub: [Onboarding Wizard (CLI)](/start/wizard)
- Automatisierung und Skripte: [CLI Automation](/start/wizard-cli-automation)
- Befehlsreferenz: [`openclaw onboard`](/cli/onboard)
