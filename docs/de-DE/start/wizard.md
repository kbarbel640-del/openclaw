---
read_when:
  - Onboarding-Wizard ausführen oder konfigurieren
  - Einen neuen Rechner einrichten
summary: "CLI Onboarding-Wizard: geführte Einrichtung für Gateway, Workspace, Kanäle und Skills"
title: "Onboarding-Wizard (CLI)"
sidebarTitle: "Onboarding: CLI"
x-i18n:
  generated_at: "2026-02-08T22:00:00Z"
  model: claude-sonnet-4
  provider: pi
  source_hash: 5495d951a2d78ffb74f52276cf637155c386523e04d7edb7c68998939bfa106a
  source_path: start/wizard.md
  workflow: 15
---

# Onboarding-Wizard (CLI)

Der Onboarding-Wizard ist der **empfohlene** Weg, OpenClaw auf macOS, Linux oder
Windows (über WSL2; dringend empfohlen) einzurichten. Er konfiguriert ein lokales Gateway
oder eine Verbindung zu einem entfernten Gateway sowie Kanäle, Skills und
Workspace-Standardwerte in einem geführten Ablauf.

```bash
openclaw onboard
```

<Info>
Schnellster erster Chat: Öffne die Control UI (keine Kanal-Einrichtung nötig). Führe
`openclaw dashboard` aus und chatte im Browser. Dokumentation: [Dashboard](/web/dashboard).
</Info>

Zum späteren Neukonfigurieren:

```bash
openclaw configure
openclaw agents add <name>
```

<Note>
`--json` bedeutet nicht nicht-interaktiver Modus. Für Skripte verwende `--non-interactive`.
</Note>

<Tip>
Empfohlen: Richte einen Brave Search API-Schlüssel ein, damit der Agent `web_search` nutzen kann
(`web_fetch` funktioniert ohne Schlüssel). Einfachster Weg: `openclaw configure --section web`,
das `tools.web.search.apiKey` speichert. Dokumentation: [Web-Tools](/tools/web).
</Tip>

## QuickStart vs Erweitert

Der Wizard startet mit **QuickStart** (Standardwerte) vs **Erweitert** (volle Kontrolle).

<Tabs>
  <Tab title="QuickStart (Standardwerte)">
    - Lokales Gateway (Loopback)
    - Standard-Workspace (oder bestehender Workspace)
    - Gateway-Port **18789**
    - Gateway-Authentifizierung **Token** (automatisch generiert, auch auf Loopback)
    - Tailscale-Freigabe **Aus**
    - Telegram + WhatsApp DMs standardmäßig auf **Allowlist** (du wirst nach deiner Telefonnummer gefragt)
  </Tab>
  <Tab title="Erweitert (volle Kontrolle)">
    - Zeigt jeden Schritt (Modus, Workspace, Gateway, Kanäle, Daemon, Skills).
  </Tab>
</Tabs>

## Was der Wizard konfiguriert

Der **lokale Modus (Standard)** führt dich durch diese Schritte:

1. **Modell/Authentifizierung** — Anthropic API-Schlüssel (empfohlen), OAuth, OpenAI oder andere Provider. Wähle ein Standardmodell.
2. **Workspace** — Speicherort für Agent-Dateien (Standard `~/.openclaw/workspace`). Erstellt Bootstrap-Dateien.
3. **Gateway** — Port, Bind-Adresse, Authentifizierungsmodus, Tailscale-Freigabe.
4. **Kanäle** — WhatsApp, Telegram, Discord, Google Chat, Mattermost, Signal, BlueBubbles oder iMessage.
5. **Daemon** — Installiert einen LaunchAgent (macOS) oder eine systemd-Benutzereinheit (Linux/WSL2).
6. **Gesundheitsprüfung** — Startet das Gateway und überprüft, ob es läuft.
7. **Skills** — Installiert empfohlene Skills und optionale Abhängigkeiten.

<Note>
Das erneute Ausführen des Wizards löscht **nichts**, es sei denn, du wählst ausdrücklich **Zurücksetzen** (oder übergibst `--reset`).
Wenn die Konfiguration ungültig ist oder Legacy-Schlüssel enthält, fordert der Wizard dich auf, zuerst `openclaw doctor` auszuführen.
</Note>

Der **Remote-Modus** konfiguriert nur den lokalen Client für die Verbindung zu einem Gateway anderswo.
Er installiert oder ändert **nichts** auf dem Remote-Host.

## Einen weiteren Agenten hinzufügen

Verwende `openclaw agents add <name>`, um einen separaten Agenten mit eigenem Workspace,
Sitzungen und Authentifizierungsprofilen zu erstellen. Ausführen ohne `--workspace` startet den Wizard.

Was es festlegt:

- `agents.list[].name`
- `agents.list[].workspace`
- `agents.list[].agentDir`

Hinweise:

- Standard-Workspaces folgen `~/.openclaw/workspace-<agentId>`.
- Füge `bindings` hinzu, um eingehende Nachrichten zu routen (der Wizard kann das).
- Nicht-interaktive Flags: `--model`, `--agent-dir`, `--bind`, `--non-interactive`.

## Vollständige Referenz

Für detaillierte Schritt-für-Schritt-Erklärungen, nicht-interaktives Scripting, Signal-Einrichtung,
RPC-API und eine vollständige Liste der vom Wizard geschriebenen Konfigurationsfelder siehe die
[Wizard-Referenz](/reference/wizard).

## Verwandte Dokumentation

- CLI-Befehlsreferenz: [`openclaw onboard`](/cli/onboard)
- macOS-App Onboarding: [Onboarding](/start/onboarding)
- Erststart-Ritual des Agenten: [Agent-Bootstrapping](/start/bootstrapping)
