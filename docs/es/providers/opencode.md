---
summary: "Use OpenCode Zen (modelos curados) con OpenClaw"
read_when:
  - Quiere OpenCode Zen para acceso a modelos
  - Quiere una lista curada de modelos orientados a la programacion
title: "OpenCode Zen"
x-i18n:
  source_path: providers/opencode.md
  source_hash: b3b5c640ac32f317
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:42Z
---

# OpenCode Zen

OpenCode Zen es una **lista curada de modelos** recomendados por el equipo de OpenCode para agentes de programacion.
Es una ruta opcional de acceso a modelos alojada que usa una clave de API y el proveedor `opencode`.
Zen se encuentra actualmente en beta.

## Configuracion de CLI

```bash
openclaw onboard --auth-choice opencode-zen
# or non-interactive
openclaw onboard --opencode-zen-api-key "$OPENCODE_API_KEY"
```

## Fragmento de configuracion

```json5
{
  env: { OPENCODE_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "opencode/claude-opus-4-6" } } },
}
```

## Notas

- `OPENCODE_ZEN_API_KEY` tambien es compatible.
- Usted inicia sesion en Zen, agrega detalles de facturacion y copia su clave de API.
- OpenCode Zen factura por solicitud; consulte el panel de OpenCode para mas detalles.
