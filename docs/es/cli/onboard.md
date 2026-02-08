---
summary: "Referencia de CLI para `openclaw onboard` (asistente interactivo de incorporacion)"
read_when:
  - Desea una configuracion guiada para Gateway, espacio de trabajo, autenticacion, canales y Skills
title: "onboard"
x-i18n:
  source_path: cli/onboard.md
  source_hash: 69a96accb2d571ff
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:19Z
---

# `openclaw onboard`

Asistente interactivo de incorporacion (configuracion del Gateway local o remoto).

## Guias relacionadas

- Centro de incorporacion de CLI: [Asistente de Incorporacion (CLI)](/start/wizard)
- Referencia de incorporacion de CLI: [Referencia de Incorporacion de CLI](/start/wizard-cli-reference)
- Automatizacion de CLI: [Automatizacion de CLI](/start/wizard-cli-automation)
- Incorporacion en macOS: [Incorporacion (App de macOS)](/start/onboarding)

## Ejemplos

```bash
openclaw onboard
openclaw onboard --flow quickstart
openclaw onboard --flow manual
openclaw onboard --mode remote --remote-url ws://gateway-host:18789
```

Notas del flujo:

- `quickstart`: indicaciones minimas, genera automaticamente un token de gateway.
- `manual`: indicaciones completas para puerto/vinculacion/autenticacion (alias de `advanced`).
- Primer chat mas rapido: `openclaw dashboard` (UI de Control, sin configuracion de canales).

## Comandos comunes posteriores

```bash
openclaw configure
openclaw agents add <name>
```

<Note>
`--json` no implica modo no interactivo. Use `--non-interactive` para scripts.
</Note>
