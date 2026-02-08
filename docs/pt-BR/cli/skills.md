---
summary: "Referencia da CLI para `openclaw skills` (list/info/check) e elegibilidade de Skills"
read_when:
  - Voce quer ver quais Skills estao disponiveis e prontas para executar
  - Voce quer depurar binarios/variaveis de ambiente/configuracao ausentes para Skills
title: "skills"
x-i18n:
  source_path: cli/skills.md
  source_hash: 7878442c88a27ec8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:44Z
---

# `openclaw skills`

Inspecione Skills (empacotadas + workspace + sobrescritas gerenciadas) e veja o que esta elegivel vs requisitos ausentes.

Relacionado:

- Sistema de Skills: [Skills](/tools/skills)
- configuracao de Skills: [Skills config](/tools/skills-config)
- Instalacoes do ClawHub: [ClawHub](/tools/clawhub)

## Comandos

```bash
openclaw skills list
openclaw skills list --eligible
openclaw skills info <name>
openclaw skills check
```
