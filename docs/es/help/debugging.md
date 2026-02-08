---
summary: "Herramientas de depuración: modo watch, flujos de modelo sin procesar y trazado de fugas de razonamiento"
read_when:
  - Necesita inspeccionar la salida sin procesar del modelo para detectar fugas de razonamiento
  - Quiere ejecutar el Gateway en modo watch mientras itera
  - Necesita un flujo de trabajo de depuración repetible
title: "Depuración"
x-i18n:
  source_path: help/debugging.md
  source_hash: 504c824bff479000
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:28Z
---

# Depuración

Esta página cubre ayudas de depuración para salida en streaming, especialmente cuando un
proveedor mezcla razonamiento dentro del texto normal.

## Anulaciones de depuración en tiempo de ejecución

Use `/debug` en el chat para establecer anulaciones de configuración **solo en tiempo de ejecución** (en memoria, no en disco).
`/debug` está deshabilitado por defecto; habilítelo con `commands.debug: true`.
Esto es útil cuando necesita alternar configuraciones poco comunes sin editar `openclaw.json`.

Ejemplos:

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug unset messages.responsePrefix
/debug reset
```

`/debug reset` borra todas las anulaciones y vuelve a la configuración en disco.

## Modo watch del Gateway

Para una iteración rápida, ejecute el gateway bajo el observador de archivos:

```bash
pnpm gateway:watch --force
```

Esto se asigna a:

```bash
tsx watch src/entry.ts gateway --force
```

Agregue cualquier bandera de la CLI del gateway después de `gateway:watch` y se pasarán
en cada reinicio.

## Perfil dev + gateway dev (--dev)

Use el perfil dev para aislar el estado y levantar una configuración segura y desechable para
depuración. Hay **dos** banderas `--dev`:

- **Global `--dev` (perfil):** aísla el estado bajo `~/.openclaw-dev` y
  establece por defecto el puerto del gateway en `19001` (los puertos derivados cambian con él).
- **`gateway --dev`: le indica al Gateway que cree automáticamente una configuración +
  espacio de trabajo predeterminados** cuando faltan (y omite BOOTSTRAP.md).

Flujo recomendado (perfil dev + bootstrap dev):

```bash
pnpm gateway:dev
OPENCLAW_PROFILE=dev openclaw tui
```

Si aún no tiene una instalación global, ejecute la CLI vía `pnpm openclaw ...`.

Qué hace esto:

1. **Aislamiento de perfil** (global `--dev`)
   - `OPENCLAW_PROFILE=dev`
   - `OPENCLAW_STATE_DIR=~/.openclaw-dev`
   - `OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json`
   - `OPENCLAW_GATEWAY_PORT=19001` (el navegador/canvas se ajusta en consecuencia)

2. **Bootstrap dev** (`gateway --dev`)
   - Escribe una configuración mínima si falta (`gateway.mode=local`, bind loopback).
   - Establece `agent.workspace` al espacio de trabajo dev.
   - Establece `agent.skipBootstrap=true` (sin BOOTSTRAP.md).
   - Siembra los archivos del espacio de trabajo si faltan:
     `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`.
   - Identidad predeterminada: **C3‑PO** (droide de protocolo).
   - Omite proveedores de canal en modo dev (`OPENCLAW_SKIP_CHANNELS=1`).

Flujo de reinicio (inicio limpio):

```bash
pnpm gateway:dev:reset
```

Nota: `--dev` es una bandera de perfil **global** y algunos ejecutores la consumen.
Si necesita especificarla explícitamente, use la forma de variable de entorno:

```bash
OPENCLAW_PROFILE=dev openclaw gateway --dev --reset
```

`--reset` borra la configuración, credenciales, sesiones y el espacio de trabajo dev (usando
`trash`, no `rm`), y luego recrea la configuración dev predeterminada.

Consejo: si ya se está ejecutando un gateway no dev (launchd/systemd), deténgalo primero:

```bash
openclaw gateway stop
```

## Registro de flujo sin procesar (OpenClaw)

OpenClaw puede registrar el **flujo sin procesar del asistente** antes de cualquier filtrado/formateo.
Esta es la mejor manera de ver si el razonamiento llega como deltas de texto plano
(o como bloques de pensamiento separados).

Habilítelo vía CLI:

```bash
pnpm gateway:watch --force --raw-stream
```

Anulación opcional de ruta:

```bash
pnpm gateway:watch --force --raw-stream --raw-stream-path ~/.openclaw/logs/raw-stream.jsonl
```

Variables de entorno equivalentes:

```bash
OPENCLAW_RAW_STREAM=1
OPENCLAW_RAW_STREAM_PATH=~/.openclaw/logs/raw-stream.jsonl
```

Archivo predeterminado:

`~/.openclaw/logs/raw-stream.jsonl`

## Registro de fragmentos sin procesar (pi-mono)

Para capturar **fragmentos sin procesar compatibles con OpenAI** antes de que se analicen en bloques,
pi-mono expone un registrador separado:

```bash
PI_RAW_STREAM=1
```

Ruta opcional:

```bash
PI_RAW_STREAM_PATH=~/.pi-mono/logs/raw-openai-completions.jsonl
```

Archivo predeterminado:

`~/.pi-mono/logs/raw-openai-completions.jsonl`

> Nota: esto solo lo emiten procesos que usan el proveedor
> `openai-completions` de pi-mono.

## Notas de seguridad

- Los registros de flujo sin procesar pueden incluir prompts completos, salida de herramientas y datos de usuario.
- Mantenga los registros locales y elimínelos después de depurar.
- Si comparte registros, elimine primero secretos y PII.
