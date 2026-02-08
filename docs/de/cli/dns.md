---
summary: "CLI-Referenz fuer `openclaw dns` (Hilfsprogramme fuer die standortuebergreifende Erkennung)"
read_when:
  - Sie moechten standortuebergreifende Erkennung (DNS-SD) ueber Tailscale + CoreDNS
  - Sie richten Split-DNS fuer eine benutzerdefinierte Erkennungsdomain ein (Beispiel: openclaw.internal)
title: "dns"
x-i18n:
  source_path: cli/dns.md
  source_hash: d2011e41982ffb4b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:40Z
---

# `openclaw dns`

DNS-Hilfsprogramme fuer die standortuebergreifende Erkennung (Tailscale + CoreDNS). Aktuell auf macOS + Homebrew CoreDNS fokussiert.

Verwandt:

- Gateway-Erkennung: [Erkennung](/gateway/discovery)
- Konfiguration der standortuebergreifenden Erkennung: [Konfiguration](/gateway/configuration)

## Einrichtung

```bash
openclaw dns setup
openclaw dns setup --apply
```
