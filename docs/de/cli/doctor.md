---
summary: "CLI-Referenz für `openclaw doctor` (Zustandsprüfungen + geführte Reparaturen)"
read_when:
  - Sie haben Verbindungs-/Authentifizierungsprobleme und möchten geführte Korrekturen
  - Sie haben aktualisiert und möchten eine Plausibilitätsprüfung
title: "doctor"
x-i18n:
  source_path: cli/doctor.md
  source_hash: 92310aa3f3d111e9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:45Z
---

# `openclaw doctor`

Zustandsprüfungen + schnelle Korrekturen für den Gateway und Kanäle.

Verwandt:

- Fehlerbehebung: [Troubleshooting](/gateway/troubleshooting)
- Sicherheitsprüfung: [Security](/gateway/security)

## Beispiele

```bash
openclaw doctor
openclaw doctor --repair
openclaw doctor --deep
```

Hinweise:

- Interaktive Eingabeaufforderungen (wie Schlüsselbund-/OAuth-Korrekturen) werden nur ausgeführt, wenn stdin ein TTY ist und `--non-interactive` **nicht** gesetzt ist. Headless-Ausführungen (cron, Telegram, ohne Terminal) überspringen Eingabeaufforderungen.
- `--fix` (Alias für `--repair`) schreibt eine Sicherung nach `~/.openclaw/openclaw.json.bak` und entfernt unbekannte Konfigurationsschlüssel, wobei jede Entfernung aufgelistet wird.

## macOS: `launchctl` Umgebungsvariablen-Overrides

Wenn Sie zuvor `launchctl setenv OPENCLAW_GATEWAY_TOKEN ...` (oder `...PASSWORD`) ausgeführt haben, überschreibt dieser Wert Ihre Konfigurationsdatei und kann zu dauerhaften „nicht autorisiert“-Fehlern führen.

```bash
launchctl getenv OPENCLAW_GATEWAY_TOKEN
launchctl getenv OPENCLAW_GATEWAY_PASSWORD

launchctl unsetenv OPENCLAW_GATEWAY_TOKEN
launchctl unsetenv OPENCLAW_GATEWAY_PASSWORD
```
