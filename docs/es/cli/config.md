---
summary: "Referencia de la CLI para `openclaw config` (obtener/establecer/quitar valores de configuracion)"
read_when:
  - Quiere leer o editar la configuracion de forma no interactiva
title: "config"
x-i18n:
  source_path: cli/config.md
  source_hash: d60a35f5330f22bc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:12Z
---

# `openclaw config`

Ayudantes de configuracion: obtener/establecer/quitar valores por ruta. Ejecute sin un subcomando para abrir
el asistente de configuracion (igual que `openclaw configure`).

## Examples

```bash
openclaw config get browser.executablePath
openclaw config set browser.executablePath "/usr/bin/google-chrome"
openclaw config set agents.defaults.heartbeat.every "2h"
openclaw config set agents.list[0].tools.exec.node "node-id-or-name"
openclaw config unset tools.web.search.apiKey
```

## Paths

Las rutas usan notacion de puntos o corchetes:

```bash
openclaw config get agents.defaults.workspace
openclaw config get agents.list[0].id
```

Use el indice de la lista de agentes para apuntar a un agente especifico:

```bash
openclaw config get agents.list
openclaw config set agents.list[1].tools.exec.node "node-id-or-name"
```

## Values

Los valores se analizan como JSON5 cuando es posible; de lo contrario se tratan como cadenas.
Use `--json` para exigir el analisis JSON5.

```bash
openclaw config set agents.defaults.heartbeat.every "0m"
openclaw config set gateway.port 19001 --json
openclaw config set channels.whatsapp.groups '["*"]' --json
```

Reinicie el Gateway despues de las ediciones.
