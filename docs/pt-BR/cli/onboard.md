---
summary: "Referencia da CLI para `openclaw onboard` (assistente interativo de integracao inicial)"
read_when:
  - Voce quer configuracao guiada para gateway, workspace, autenticacao, canais e skills
title: "onboard"
x-i18n:
  source_path: cli/onboard.md
  source_hash: 69a96accb2d571ff
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:44Z
---

# `openclaw onboard`

Assistente interativo de integracao inicial (configuracao local ou remota do Gateway).

## Guias relacionados

- Hub de integracao inicial da CLI: [Onboarding Wizard (CLI)](/start/wizard)
- Referencia de integracao inicial da CLI: [CLI Onboarding Reference](/start/wizard-cli-reference)
- Automacao da CLI: [CLI Automation](/start/wizard-cli-automation)
- Integracao inicial no macOS: [Onboarding (macOS App)](/start/onboarding)

## Exemplos

```bash
openclaw onboard
openclaw onboard --flow quickstart
openclaw onboard --flow manual
openclaw onboard --mode remote --remote-url ws://gateway-host:18789
```

Notas do fluxo:

- `quickstart`: prompts minimos, gera automaticamente um token de gateway.
- `manual`: prompts completos para porta/bind/autenticacao (alias de `advanced`).
- Primeiro chat mais rapido: `openclaw dashboard` (UI de controle, sem configuracao de canais).

## Comandos comuns de acompanhamento

```bash
openclaw configure
openclaw agents add <name>
```

<Note>
`--json` nao implica modo nao interativo. Use `--non-interactive` para scripts.
</Note>
