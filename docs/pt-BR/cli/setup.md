---
summary: "Referencia da CLI para `openclaw setup` (inicializar configuracao + workspace)"
read_when:
  - "Voce esta fazendo a configuracao inicial sem o assistente completo de integracao inicial"
  - "Voce quer definir o caminho padrao do workspace"
title: "configuracao"
x-i18n:
  source_path: cli/setup.md
  source_hash: 7f3fc8b246924edf
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:46Z
---

# `openclaw setup`

Inicialize `~/.openclaw/openclaw.json` e o workspace do agente.

Relacionados:

- Primeiros Passos: [Primeiros Passos](/start/getting-started)
- Assistente: [Integracao Inicial](/start/onboarding)

## Exemplos

```bash
openclaw setup
openclaw setup --workspace ~/.openclaw/workspace
```

Para executar o assistente via setup:

```bash
openclaw setup --wizard
```
