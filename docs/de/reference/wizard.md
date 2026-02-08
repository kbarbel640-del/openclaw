---
summary: "Vollständige Referenz für den CLI-Einführungsassistenten: jeder Schritt, jedes Flag und jedes Konfigurationsfeld"
read_when:
  - Nachschlagen eines bestimmten Assistenten-Schritts oder Flags
  - Automatisieren der Einführung mit dem nicht‑interaktiven Modus
  - Debuggen des Verhaltens des Assistenten
title: "Referenz des Einführungsassistenten"
sidebarTitle: "Wizard Reference"
x-i18n:
  source_path: reference/wizard.md
  source_hash: 1dd46ad12c53668c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:46Z
---

# Referenz des Einführungsassistenten

Dies ist die vollständige Referenz für den `openclaw onboard` CLI‑Assistenten.
Für eine Übersicht auf hoher Ebene siehe [Einführungsassistent](/start/wizard).

## Ablaufdetails (lokaler Modus)

<Steps>
  <Step title="Erkennung vorhandener Konfiguration">
    - Wenn `~/.openclaw/openclaw.json` existiert, wählen Sie **Beibehalten / Ändern / Zurücksetzen**.
    - Ein erneutes Ausführen des Assistenten löscht **nichts**, es sei denn, Sie wählen ausdrücklich **Zurücksetzen**
      (oder übergeben `--reset`).
    - Wenn die Konfiguration ungültig ist oder veraltete Schlüssel enthält, stoppt der Assistent und fordert Sie auf,
      vor dem Fortfahren `openclaw doctor` auszuführen.
    - Zurücksetzen verwendet `trash` (niemals `rm`) und bietet folgende Umfänge:
      - Nur Konfiguration
      - Konfiguration + Anmeldedaten + Sitzungen
      - Vollständiges Zurücksetzen (entfernt auch den Workspace)
  </Step>
  <Step title="Modell/Auth">
    - **Anthropic API‑Schlüssel (empfohlen)**: verwendet `ANTHROPIC_API_KEY`, falls vorhanden, oder fordert einen Schlüssel an und speichert ihn anschließend für die Daemon‑Nutzung.
    - **Anthropic OAuth (Claude Code CLI)**: unter macOS prüft der Assistent den Schlüsselbund‑Eintrag „Claude Code-credentials“ (wählen Sie „Immer erlauben“, damit Startvorgänge über launchd nicht blockieren); unter Linux/Windows wird `~/.claude/.credentials.json` wiederverwendet, falls vorhanden.
    - **Anthropic‑Token (Setup‑Token einfügen)**: führen Sie `claude setup-token` auf einem beliebigen Rechner aus und fügen Sie dann das Token ein (Sie können es benennen; leer = Standard).
    - **OpenAI Code (Codex)‑Abonnement (Codex CLI)**: wenn `~/.codex/auth.json` existiert, kann der Assistent es wiederverwenden.
    - **OpenAI Code (Codex)‑Abonnement (OAuth)**: Browser‑Ablauf; fügen Sie `code#state` ein.
      - Setzt `agents.defaults.model` auf `openai-codex/gpt-5.2`, wenn das Modell nicht gesetzt ist oder `openai/*`.
    - **OpenAI API‑Schlüssel**: verwendet `OPENAI_API_KEY`, falls vorhanden, oder fordert einen Schlüssel an und speichert ihn anschließend in `~/.openclaw/.env`, damit launchd ihn lesen kann.
    - **OpenCode Zen (Multi‑Modell‑Proxy)**: fordert `OPENCODE_API_KEY` an (oder `OPENCODE_ZEN_API_KEY`; erhalten Sie ihn unter https://opencode.ai/auth).
    - **API‑Schlüssel**: speichert den Schlüssel für Sie.
    - **Vercel AI Gateway (Multi‑Modell‑Proxy)**: fordert `AI_GATEWAY_API_KEY` an.
    - Weitere Details: [Vercel AI Gateway](/providers/vercel-ai-gateway)
    - **Cloudflare AI Gateway**: fordert Account‑ID, Gateway‑ID und `CLOUDFLARE_AI_GATEWAY_API_KEY` an.
    - Weitere Details: [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)
    - **MiniMax M2.1**: Konfiguration wird automatisch geschrieben.
    - Weitere Details: [MiniMax](/providers/minimax)
    - **Synthetic (Anthropic‑kompatibel)**: fordert `SYNTHETIC_API_KEY` an.
    - Weitere Details: [Synthetic](/providers/synthetic)
    - **Moonshot (Kimi K2)**: Konfiguration wird automatisch geschrieben.
    - **Kimi Coding**: Konfiguration wird automatisch geschrieben.
    - Weitere Details: [Moonshot AI (Kimi + Kimi Coding)](/providers/moonshot)
    - **Überspringen**: Noch keine Authentifizierung konfiguriert.
    - Wählen Sie ein Standardmodell aus den erkannten Optionen (oder geben Sie Anbieter/Modell manuell ein).
    - Der Assistent führt eine Modellprüfung aus und warnt, wenn das konfigurierte Modell unbekannt ist oder die Authentifizierung fehlt.
    - OAuth‑Anmeldedaten liegen in `~/.openclaw/credentials/oauth.json`; Auth‑Profile liegen in `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` (API‑Schlüssel + OAuth).
    - Weitere Details: [/concepts/oauth](/concepts/oauth)
    <Note>
    Tipp für Headless/Server: Schließen Sie OAuth auf einem Rechner mit Browser ab und kopieren Sie anschließend
    `~/.openclaw/credentials/oauth.json` (oder `$OPENCLAW_STATE_DIR/credentials/oauth.json`) auf den
    Gateway‑Host.
    </Note>
  </Step>
  <Step title="Workspace">
    - Standardmäßig `~/.openclaw/workspace` (konfigurierbar).
    - Erstellt die für das Bootstrap‑Ritual des Agenten benötigten Workspace‑Dateien.
    - Vollständiges Workspace‑Layout + Backup‑Leitfaden: [Agent‑Workspace](/concepts/agent-workspace)
  </Step>
  <Step title="Gateway">
    - Port, Bind, Auth‑Modus, Tailscale‑Exposition.
    - Auth‑Empfehlung: Behalten Sie **Token** selbst für loopback bei, damit lokale WS‑Clients sich authentifizieren müssen.
    - Deaktivieren Sie Auth nur, wenn Sie jedem lokalen Prozess vollständig vertrauen.
    - Nicht‑loopback‑Binds erfordern weiterhin Auth.
  </Step>
  <Step title="Kanäle">
    - [WhatsApp](/channels/whatsapp): optionaler QR‑Login.
    - [Telegram](/channels/telegram): Bot‑Token.
    - [Discord](/channels/discord): Bot‑Token.
    - [Google Chat](/channels/googlechat): Service‑Account‑JSON + Webhook‑Audience.
    - [Mattermost](/channels/mattermost) (Plugin): Bot‑Token + Basis‑URL.
    - [Signal](/channels/signal): optionale `signal-cli`‑Installation + Konto‑Konfiguration.
    - [BlueBubbles](/channels/bluebubbles): **empfohlen für iMessage**; Server‑URL + Passwort + Webhook.
    - [iMessage](/channels/imessage): veralteter `imsg`‑CLI‑Pfad + DB‑Zugriff.
    - DM‑Sicherheit: Standard ist Pairing. Die erste Direktnachricht sendet einen Code; genehmigen Sie ihn über `openclaw pairing approve <channel> <code>` oder verwenden Sie Allowlists.
  </Step>
  <Step title="Daemon‑Installation">
    - macOS: LaunchAgent
      - Erfordert eine angemeldete Benutzersitzung; für Headless‑Betrieb verwenden Sie einen benutzerdefinierten LaunchDaemon (nicht enthalten).
    - Linux (und Windows über WSL2): systemd‑User‑Unit
      - Der Assistent versucht, Lingering über `loginctl enable-linger <user>` zu aktivieren, damit der Gateway nach dem Abmelden weiterläuft.
      - Kann nach sudo fragen (schreibt `/var/lib/systemd/linger`); zunächst wird es ohne sudo versucht.
    - **Runtime‑Auswahl:** Node (empfohlen; erforderlich für WhatsApp/Telegram). Bun wird **nicht empfohlen**.
  </Step>
  <Step title="Health‑Check">
    - Startet den Gateway (falls erforderlich) und führt `openclaw health` aus.
    - Tipp: `openclaw status --deep` fügt Gateway‑Health‑Probes zur Statusausgabe hinzu (erfordert einen erreichbaren Gateway).
  </Step>
  <Step title="Skills (empfohlen)">
    - Liest die verfügbaren Skills und prüft die Anforderungen.
    - Ermöglicht die Auswahl eines Node‑Managers: **npm / pnpm** (bun nicht empfohlen).
    - Installiert optionale Abhängigkeiten (einige verwenden Homebrew unter macOS).
  </Step>
  <Step title="Abschluss">
    - Zusammenfassung + nächste Schritte, einschließlich iOS/Android/macOS‑Apps für zusätzliche Funktionen.
  </Step>
</Steps>

<Note>
Wenn keine GUI erkannt wird, gibt der Assistent Anweisungen zum SSH‑Port‑Forwarding für die Control UI aus, anstatt einen Browser zu öffnen.
Wenn die Control‑UI‑Assets fehlen, versucht der Assistent, sie zu bauen; Fallback ist `pnpm ui:build` (installiert UI‑Abhängigkeiten automatisch).
</Note>

## Nicht‑interaktiver Modus

Verwenden Sie `--non-interactive`, um die Einführung zu automatisieren oder zu skripten:

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice apiKey \
  --anthropic-api-key "$ANTHROPIC_API_KEY" \
  --gateway-port 18789 \
  --gateway-bind loopback \
  --install-daemon \
  --daemon-runtime node \
  --skip-skills
```

Fügen Sie `--json` hinzu, um eine maschinenlesbare Zusammenfassung zu erhalten.

<Note>
`--json` impliziert **nicht** den nicht‑interaktiven Modus. Verwenden Sie `--non-interactive` (und `--workspace`) für Skripte.
</Note>

<AccordionGroup>
  <Accordion title="Gemini‑Beispiel">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice gemini-api-key \
      --gemini-api-key "$GEMINI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Z.AI‑Beispiel">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice zai-api-key \
      --zai-api-key "$ZAI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Vercel AI Gateway‑Beispiel">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice ai-gateway-api-key \
      --ai-gateway-api-key "$AI_GATEWAY_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Cloudflare AI Gateway‑Beispiel">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice cloudflare-ai-gateway-api-key \
      --cloudflare-ai-gateway-account-id "your-account-id" \
      --cloudflare-ai-gateway-gateway-id "your-gateway-id" \
      --cloudflare-ai-gateway-api-key "$CLOUDFLARE_AI_GATEWAY_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Moonshot‑Beispiel">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice moonshot-api-key \
      --moonshot-api-key "$MOONSHOT_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Synthetic‑Beispiel">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice synthetic-api-key \
      --synthetic-api-key "$SYNTHETIC_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="OpenCode Zen‑Beispiel">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice opencode-zen \
      --opencode-zen-api-key "$OPENCODE_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
</AccordionGroup>

### Agent hinzufügen (nicht‑interaktiv)

```bash
openclaw agents add work \
  --workspace ~/.openclaw/workspace-work \
  --model openai/gpt-5.2 \
  --bind whatsapp:biz \
  --non-interactive \
  --json
```

## Gateway‑Assistent‑RPC

Der Gateway stellt den Assistenten‑Ablauf über RPC bereit (`wizard.start`, `wizard.next`, `wizard.cancel`, `wizard.status`).
Clients (macOS‑App, Control UI) können Schritte rendern, ohne die Einführungslogik neu zu implementieren.

## Signal‑Einrichtung (signal-cli)

Der Assistent kann `signal-cli` aus GitHub‑Releases installieren:

- Lädt das passende Release‑Asset herunter.
- Speichert es unter `~/.openclaw/tools/signal-cli/<version>/`.
- Schreibt `channels.signal.cliPath` in Ihre Konfiguration.

Hinweise:

- JVM‑Builds erfordern **Java 21**.
- Native Builds werden verwendet, wenn verfügbar.
- Windows nutzt WSL2; die signal-cli‑Installation folgt dem Linux‑Ablauf innerhalb von WSL.

## Was der Assistent schreibt

Typische Felder in `~/.openclaw/openclaw.json`:

- `agents.defaults.workspace`
- `agents.defaults.model` / `models.providers` (wenn Minimax gewählt)
- `gateway.*` (Modus, Bind, Auth, Tailscale)
- `channels.telegram.botToken`, `channels.discord.token`, `channels.signal.*`, `channels.imessage.*`
- Kanal‑Allowlists (Slack/Discord/Matrix/Microsoft Teams), wenn Sie während der Prompts zustimmen (Namen werden, wenn möglich, zu IDs aufgelöst).
- `skills.install.nodeManager`
- `wizard.lastRunAt`
- `wizard.lastRunVersion`
- `wizard.lastRunCommit`
- `wizard.lastRunCommand`
- `wizard.lastRunMode`

`openclaw agents add` schreibt `agents.list[]` und optional `bindings`.

WhatsApp‑Anmeldedaten liegen unter `~/.openclaw/credentials/whatsapp/<accountId>/`.
Sitzungen werden unter `~/.openclaw/agents/<agentId>/sessions/` gespeichert.

Einige Kanäle werden als Plugins ausgeliefert. Wenn Sie während der Einführung eines auswählen, fordert der Assistent
zur Installation auf (npm oder ein lokaler Pfad), bevor er konfiguriert werden kann.

## Verwandte Dokumente

- Übersicht des Assistenten: [Einführungsassistent](/start/wizard)
- macOS‑App‑Einführung: [Einführung](/start/onboarding)
- Konfigurationsreferenz: [Gateway‑Konfiguration](/gateway/configuration)
- Anbieter: [WhatsApp](/channels/whatsapp), [Telegram](/channels/telegram), [Discord](/channels/discord), [Google Chat](/channels/googlechat), [Signal](/channels/signal), [BlueBubbles](/channels/bluebubbles) (iMessage), [iMessage](/channels/imessage) (Legacy)
- Skills: [Skills](/tools/skills), [Skills config](/tools/skills-config)
