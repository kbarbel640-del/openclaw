---
summary: "Referencia de CLI para `openclaw dns` (auxiliares de descoberta de area ampla)"
read_when:
  - Voce quer descoberta de area ampla (DNS-SD) via Tailscale + CoreDNS
  - Voce esta configurando DNS dividido para um dominio de descoberta personalizado (exemplo: openclaw.internal)
title: "dns"
x-i18n:
  source_path: cli/dns.md
  source_hash: d2011e41982ffb4b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:36Z
---

# `openclaw dns`

Auxiliares de DNS para descoberta de area ampla (Tailscale + CoreDNS). Atualmente focado em macOS + Homebrew CoreDNS.

Relacionado:

- Descoberta do Gateway: [Descoberta](/gateway/discovery)
- Configuracao de descoberta de area ampla: [Configuracao](/gateway/configuration)

## Configuracao

```bash
openclaw dns setup
openclaw dns setup --apply
```
