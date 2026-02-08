---
summary: "Referencia de la CLI para `openclaw dns` (ayudantes de descubrimiento de area amplia)"
read_when:
  - Quiere descubrimiento de area amplia (DNS-SD) mediante Tailscale + CoreDNS
  - Esta configurando DNS dividido para un dominio de descubrimiento personalizado (ejemplo: openclaw.internal)
title: "dns"
x-i18n:
  source_path: cli/dns.md
  source_hash: d2011e41982ffb4b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:10Z
---

# `openclaw dns`

Ayudantes de DNS para descubrimiento de area amplia (Tailscale + CoreDNS). Actualmente enfocado en macOS + Homebrew CoreDNS.

Relacionado:

- Descubrimiento del Gateway: [Discovery](/gateway/discovery)
- Configuracion de descubrimiento de area amplia: [Configuration](/gateway/configuration)

## Configuracion

```bash
openclaw dns setup
openclaw dns setup --apply
```
