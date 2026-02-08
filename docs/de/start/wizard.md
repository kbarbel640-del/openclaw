---
summary: "CLI-Einfuehrungsassistent: gefuehrte Einrichtung fuer Gateway, Workspace, Kanaele und Skills"
read_when:
  - Beim Ausfuehren oder Konfigurieren des Einfuehrungsassistenten
  - Beim Einrichten einer neuen Maschine
title: "Einfuehrungsassistent (CLI)"
sidebarTitle: "Onboarding: CLI"
x-i18n:
  source_path: start/wizard.md
  source_hash: 5495d951a2d78ffb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:42Z
---

# Einfuehrungsassistent (CLI)

Der Einfuehrungsassistent ist der **empfohlene** Weg, OpenClaw unter macOS,
Linux oder Windows (ueber WSL2; dringend empfohlen) einzurichten.
Er konfiguriert in einem gefuehrten Ablauf ein lokales Gateway oder eine Remote‑Gateway‑Verbindung sowie Kanaele, Skills
und Workspace‑Standards.

```bash
openclaw onboard
```

<Info>
Schnellster erster Chat: Oeffnen Sie die Control UI (keine Kanaleinrichtung erforderlich). Fuehren Sie
`openclaw dashboard` aus und chatten Sie im Browser. Doku: [Dashboard](/web/dashboard).
</Info>

Spaeter neu konfigurieren:

```bash
openclaw configure
openclaw agents add <name>
```

<Note>
`--json` impliziert keinen nicht‑interaktiven Modus. Fuer Skripte verwenden Sie `--non-interactive`.
</Note>

<Tip>
Empfohlen: Richten Sie einen Brave‑Search‑API‑Schluessel ein, damit der Agent `web_search` verwenden kann
(`web_fetch` funktioniert ohne Schluessel). Der einfachste Weg: `openclaw configure --section web`,
wodurch `tools.web.search.apiKey` gespeichert wird. Doku: [Web tools](/tools/web).
</Tip>

## Schnellstart vs. Erweitert

Der Assistent startet mit **Schnellstart** (Standards) vs. **Erweitert** (volle Kontrolle).

<Tabs>
  <Tab title="Schnellstart (Standards)">
    - Lokales Gateway (local loopback)
    - Workspace‑Standard (oder bestehender Workspace)
    - Gateway‑Port **18789**
    - Gateway‑Authentifizierung **Token** (automatisch generiert, auch bei loopback)
    - Tailscale‑Freigabe **Aus**
    - Telegram‑ und WhatsApp‑Direktnachrichten standardmaessig **Allowlist** (Sie werden nach Ihrer Telefonnummer gefragt)
  </Tab>
  <Tab title="Erweitert (volle Kontrolle)">
    - Legt jeden Schritt offen (Modus, Workspace, Gateway, Kanaele, Daemon, Skills).
  </Tab>
</Tabs>

## Was der Assistent konfiguriert

**Lokaler Modus (Standard)** fuehrt Sie durch diese Schritte:

1. **Modell/Auth** — Anthropic‑API‑Schluessel (empfohlen), OAuth, OpenAI oder andere Anbieter. Waehlen Sie ein Standard‑Modell.
2. **Workspace** — Speicherort fuer Agent‑Dateien (Standard `~/.openclaw/workspace`). Initialisiert Bootstrap‑Dateien.
3. **Gateway** — Port, Bind‑Adresse, Auth‑Modus, Tailscale‑Freigabe.
4. **Kanaele** — WhatsApp, Telegram, Discord, Google Chat, Mattermost, Signal, BlueBubbles oder iMessage.
5. **Daemon** — Installiert einen LaunchAgent (macOS) oder eine systemd‑User‑Unit (Linux/WSL2).
6. **Health‑Check** — Startet das Gateway und prueft, ob es laeuft.
7. **Skills** — Installiert empfohlene Skills und optionale Abhaengigkeiten.

<Note>
Das erneute Ausfuehren des Assistenten loescht **nichts**, es sei denn, Sie waehlen explizit **Reset** (oder uebergeben `--reset`).
Wenn die Konfiguration ungueltig ist oder veraltete Schluessel enthaelt, fordert der Assistent Sie auf, zuerst `openclaw doctor` auszufuehren.
</Note>

**Remote‑Modus** konfiguriert nur den lokalen Client fuer die Verbindung zu einem Gateway an einem anderen Ort.
Er installiert oder aendert **nichts** auf dem Remote‑Host.

## Weiteren Agenten hinzufuegen

Verwenden Sie `openclaw agents add <name>`, um einen separaten Agenten mit eigenem Workspace,
Sitzungen und Auth‑Profilen zu erstellen. Das Ausfuehren ohne `--workspace` startet den Assistenten.

Was eingerichtet wird:

- `agents.list[].name`
- `agents.list[].workspace`
- `agents.list[].agentDir`

Hinweise:

- Standard‑Workspaces folgen `~/.openclaw/workspace-<agentId>`.
- Fuegen Sie `bindings` hinzu, um eingehende Nachrichten zu routen (das kann der Assistent erledigen).
- Nicht‑interaktive Flags: `--model`, `--agent-dir`, `--bind`, `--non-interactive`.

## Vollstaendige Referenz

Fuer detaillierte Schritt‑fuer‑Schritt‑Aufschluesselungen, nicht‑interaktives Scripting, Signal‑Einrichtung,
RPC‑API und eine vollstaendige Liste der Konfigurationsfelder, die der Assistent schreibt, siehe die
[Wizard Reference](/reference/wizard).

## Verwandte Dokumente

- CLI‑Befehlsreferenz: [`openclaw onboard`](/cli/onboard)
- macOS‑App‑Einfuehrung: [Onboarding](/start/onboarding)
- Agent‑Erststart‑Ritual: [Agent Bootstrapping](/start/bootstrapping)
