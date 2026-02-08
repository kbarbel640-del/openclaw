---
summary: "CLI-Referenz für `openclaw security` (Audit und Behebung häufiger Sicherheitsfallstricke)"
read_when:
  - Sie möchten ein schnelles Sicherheitsaudit von Konfiguration/Zustand durchführen
  - Sie möchten sichere „Fix“-Vorschläge anwenden (chmod, Standards verschärfen)
title: "Sicherheit"
x-i18n:
  source_path: cli/security.md
  source_hash: 96542b4784e53933
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:48Z
---

# `openclaw security`

Sicherheitswerkzeuge (Audit + optionale Korrekturen).

Verwandt:

- Sicherheitsleitfaden: [Sicherheit](/gateway/security)

## Audit

```bash
openclaw security audit
openclaw security audit --deep
openclaw security audit --fix
```

Das Audit warnt, wenn mehrere DM-Absender die Hauptsitzung teilen, und empfiehlt den **sicheren Direktnachrichtenmodus**: `session.dmScope="per-channel-peer"` (oder `per-account-channel-peer` für Mehrkonto-Kanäle) für gemeinsame Posteingänge.
Es warnt außerdem, wenn kleine Modelle (`<=300B`) ohne sandboxing und mit aktivierten Web-/Browser-Werkzeugen verwendet werden.
