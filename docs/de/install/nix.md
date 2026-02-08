---
summary: "OpenClaw deklarativ mit Nix installieren"
read_when:
  - Sie moechten reproduzierbare, rueckrollfaehige Installationen
  - Sie verwenden bereits Nix/NixOS/Home Manager
  - Sie moechten, dass alles gepinnt und deklarativ verwaltet wird
title: "Nix"
x-i18n:
  source_path: install/nix.md
  source_hash: f1452194cfdd7461
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:45Z
---

# Nix-Installation

Der empfohlene Weg, OpenClaw mit Nix auszufuehren, ist **[nix-openclaw](https://github.com/openclaw/nix-openclaw)** — ein Home-Manager-Modul mit allem Nötigen.

## Schnellstart

Fuegen Sie dies in Ihren KI-Agenten ein (Claude, Cursor usw.):

```text
I want to set up nix-openclaw on my Mac.
Repository: github:openclaw/nix-openclaw

What I need you to do:
1. Check if Determinate Nix is installed (if not, install it)
2. Create a local flake at ~/code/openclaw-local using templates/agent-first/flake.nix
3. Help me create a Telegram bot (@BotFather) and get my chat ID (@userinfobot)
4. Set up secrets (bot token, Anthropic key) - plain files at ~/.secrets/ is fine
5. Fill in the template placeholders and run home-manager switch
6. Verify: launchd running, bot responds to messages

Reference the nix-openclaw README for module options.
```

> **📦 Vollstaendige Anleitung: [github.com/openclaw/nix-openclaw](https://github.com/openclaw/nix-openclaw)**
>
> Das Repository nix-openclaw ist die maßgebliche Quelle fuer die Nix-Installation. Diese Seite ist nur eine kurze Uebersicht.

## Was Sie erhalten

- Gateway + macOS-App + Werkzeuge (whisper, spotify, cameras) — alles gepinnt
- Launchd-Dienst, der Neustarts uebersteht
- Plugin-System mit deklarativer Konfiguration
- Sofortiger Rollback: `home-manager switch --rollback`

---

## Laufzeitverhalten im Nix-Modus

Wenn `OPENCLAW_NIX_MODE=1` gesetzt ist (automatisch mit nix-openclaw):

OpenClaw unterstuetzt einen **Nix-Modus**, der die Konfiguration deterministisch macht und Auto-Installationsablaeufe deaktiviert.
Aktivieren Sie ihn, indem Sie exportieren:

```bash
OPENCLAW_NIX_MODE=1
```

Unter macOS erbt die GUI-App Shell-Umgebungsvariablen nicht automatisch. Sie koennen
den Nix-Modus auch ueber defaults aktivieren:

```bash
defaults write bot.molt.mac openclaw.nixMode -bool true
```

### Konfigurations- und Statuspfade

OpenClaw liest JSON5-Konfiguration aus `OPENCLAW_CONFIG_PATH` und speichert veraenderliche Daten in `OPENCLAW_STATE_DIR`.

- `OPENCLAW_STATE_DIR` (Standard: `~/.openclaw`)
- `OPENCLAW_CONFIG_PATH` (Standard: `$OPENCLAW_STATE_DIR/openclaw.json`)

Bei der Ausfuehrung unter Nix setzen Sie diese explizit auf von Nix verwaltete Speicherorte, damit Laufzeitstatus und Konfiguration
aus dem unveraenderlichen Store herausgehalten werden.

### Laufzeitverhalten im Nix-Modus

- Auto-Installation und Selbstmutation sind deaktiviert
- Fehlende Abhaengigkeiten liefern Nix-spezifische Hinweise zur Behebung
- Die UI zeigt ein schreibgeschuetztes Nix-Modus-Banner an, wenn vorhanden

## Packaging-Hinweis (macOS)

Der macOS-Packaging-Ablauf erwartet eine stabile Info.plist-Vorlage unter:

```
apps/macos/Sources/OpenClaw/Resources/Info.plist
```

[`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh) kopiert diese Vorlage in das App-Bundle und patched dynamische Felder
(Bundle-ID, Version/Build, Git-SHA, Sparkle-Schluessel). Dadurch bleibt die plist deterministisch fuer SwiftPM-
Packaging und Nix-Builds (die nicht auf eine vollstaendige Xcode-Toolchain angewiesen sind).

## Verwandt

- [nix-openclaw](https://github.com/openclaw/nix-openclaw) — vollstaendige Einrichtungsanleitung
- [Wizard](/start/wizard) — CLI-Einrichtung ohne Nix
- [Docker](/install/docker) — containerisierte Einrichtung
