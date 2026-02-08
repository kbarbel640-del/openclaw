---
summary: "CLI-Referenz für `openclaw onboard` (interaktiver Einrichtungsassistent)"
read_when:
  - Sie möchten eine geführte Einrichtung für Gateway, Workspace, Auth, Kanäle und Skills
title: "onboard"
x-i18n:
  source_path: cli/onboard.md
  source_hash: 69a96accb2d571ff
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:48Z
---

# `openclaw onboard`

Interaktiver Einrichtungsassistent (lokales oder entferntes Gateway-Setup).

## Zugehörige Anleitungen

- CLI-Onboarding-Hub: [Onboarding Wizard (CLI)](/start/wizard)
- CLI-Onboarding-Referenz: [CLI Onboarding Reference](/start/wizard-cli-reference)
- CLI-Automatisierung: [CLI Automation](/start/wizard-cli-automation)
- macOS-Onboarding: [Onboarding (macOS App)](/start/onboarding)

## Beispiele

```bash
openclaw onboard
openclaw onboard --flow quickstart
openclaw onboard --flow manual
openclaw onboard --mode remote --remote-url ws://gateway-host:18789
```

Ablaufhinweise:

- `quickstart`: minimale Eingabeaufforderungen, erzeugt automatisch ein Gateway-Token.
- `manual`: vollständige Eingabeaufforderungen für Port/Bind/Auth (Alias von `advanced`).
- Schnellster erster Chat: `openclaw dashboard` (Control UI, keine Kanal-Einrichtung).

## Häufige Anschlussbefehle

```bash
openclaw configure
openclaw agents add <name>
```

<Note>
`--json` impliziert keinen nicht-interaktiven Modus. Verwenden Sie `--non-interactive` für Skripte.
</Note>
