---
summary: „Manuelle Anmeldungen für Browser-Automatisierung + Posten auf X/Twitter“
read_when:
  - Sie müssen sich für Browser-Automatisierung bei Websites anmelden
  - Sie möchten Updates auf X/Twitter posten
title: „Browser-Anmeldung“
x-i18n:
  source_path: tools/browser-login.md
  source_hash: 8ceea2d5258836e3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:39Z
---

# Browser-Anmeldung + Posten auf X/Twitter

## Manuelle Anmeldung (empfohlen)

Wenn eine Website eine Anmeldung erfordert, **melden Sie sich manuell** im **Host**-Browserprofil an (dem OpenClaw-Browser).

Geben Sie dem Modell **keine** Zugangsdaten. Automatisierte Anmeldungen lösen häufig Anti‑Bot‑Mechanismen aus und können das Konto sperren.

Zurück zur Hauptdokumentation des Browsers: [Browser](/tools/browser).

## Welches Chrome-Profil wird verwendet?

OpenClaw steuert ein **dediziertes Chrome-Profil** (mit dem Namen `openclaw`, orange getönte Benutzeroberfläche). Dieses ist von Ihrem täglichen Browserprofil getrennt.

Zwei einfache Möglichkeiten, darauf zuzugreifen:

1. **Bitten Sie den Agenten, den Browser zu öffnen**, und melden Sie sich anschließend selbst an.
2. **Öffnen Sie ihn über die CLI**:

```bash
openclaw browser start
openclaw browser open https://x.com
```

Wenn Sie mehrere Profile haben, übergeben Sie `--browser-profile <name>` (der Standard ist `openclaw`).

## X/Twitter: empfohlener Ablauf

- **Lesen/Suchen/Threads:** Verwenden Sie das **bird** CLI-Skill (kein Browser, stabil).
  - Repo: https://github.com/steipete/bird
- **Updates posten:** Verwenden Sie den **Host**-Browser (manuelle Anmeldung).

## Sandboxing + Zugriff auf den Host-Browser

Browser-Sitzungen in einer Sandbox lösen **wahrscheinlicher** Bot-Erkennung aus. Für X/Twitter (und andere strenge Websites) bevorzugen Sie den **Host**-Browser.

Wenn der Agent in einer Sandbox läuft, verwendet das Browser-Werkzeug standardmäßig die Sandbox. Um Host-Steuerung zu erlauben:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        browser: {
          allowHostControl: true,
        },
      },
    },
  },
}
```

Zielen Sie anschließend auf den Host-Browser:

```bash
openclaw browser open https://x.com --browser-profile openclaw --target host
```

Oder deaktivieren Sie Sandboxing für den Agenten, der Updates postet.
