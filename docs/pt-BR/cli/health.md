---
summary: "Referencia da CLI para `openclaw health` (endpoint de saude do Gateway via RPC)"
read_when:
  - Voce quer verificar rapidamente a saude do Gateway em execucao
title: "saude"
x-i18n:
  source_path: cli/health.md
  source_hash: 82a78a5a97123f7a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:39Z
---

# `openclaw health`

Busca a saude do Gateway em execucao.

```bash
openclaw health
openclaw health --json
openclaw health --verbose
```

Notas:

- `--verbose` executa sondas ao vivo e imprime tempos por conta quando varias contas estao configuradas.
- A saida inclui armazenamentos de sessao por agente quando varios agentes estao configurados.
