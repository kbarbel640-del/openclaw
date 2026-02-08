---
summary: "Referencia de la CLI para `openclaw hooks` (hooks de agente)"
read_when:
  - Desea administrar hooks de agente
  - Desea instalar o actualizar hooks
title: "hooks"
x-i18n:
  source_path: cli/hooks.md
  source_hash: e2032e61ff4b9135
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:23Z
---

# `openclaw hooks`

Administre hooks de agente (automatizaciones basadas en eventos para comandos como `/new`, `/reset` y el inicio del Gateway).

Relacionado:

- Hooks: [Hooks](/hooks)
- Hooks de plugins: [Plugins](/plugin#plugin-hooks)

## Listar todos los hooks

```bash
openclaw hooks list
```

Enumera todos los hooks descubiertos desde los directorios del workspace, administrados y empaquetados.

**Opciones:**

- `--eligible`: Mostrar solo hooks elegibles (requisitos cumplidos)
- `--json`: Salida en JSON
- `-v, --verbose`: Mostrar información detallada, incluidos los requisitos faltantes

**Salida de ejemplo:**

```
Hooks (4/4 ready)

Ready:
  🚀 boot-md ✓ - Run BOOT.md on gateway startup
  📝 command-logger ✓ - Log all command events to a centralized audit file
  💾 session-memory ✓ - Save session context to memory when /new command is issued
  😈 soul-evil ✓ - Swap injected SOUL content during a purge window or by random chance
```

**Ejemplo (detallado):**

```bash
openclaw hooks list --verbose
```

Muestra los requisitos faltantes para los hooks no elegibles.

**Ejemplo (JSON):**

```bash
openclaw hooks list --json
```

Devuelve JSON estructurado para uso programático.

## Obtener información de un hook

```bash
openclaw hooks info <name>
```

Muestra información detallada sobre un hook específico.

**Argumentos:**

- `<name>`: Nombre del hook (p. ej., `session-memory`)

**Opciones:**

- `--json`: Salida en JSON

**Ejemplo:**

```bash
openclaw hooks info session-memory
```

**Salida:**

```
💾 session-memory ✓ Ready

Save session context to memory when /new command is issued

Details:
  Source: openclaw-bundled
  Path: /path/to/openclaw/hooks/bundled/session-memory/HOOK.md
  Handler: /path/to/openclaw/hooks/bundled/session-memory/handler.ts
  Homepage: https://docs.openclaw.ai/hooks#session-memory
  Events: command:new

Requirements:
  Config: ✓ workspace.dir
```

## Comprobar la elegibilidad de hooks

```bash
openclaw hooks check
```

Muestra un resumen del estado de elegibilidad de los hooks (cuántos están listos vs. no listos).

**Opciones:**

- `--json`: Salida en JSON

**Salida de ejemplo:**

```
Hooks Status

Total hooks: 4
Ready: 4
Not ready: 0
```

## Habilitar un hook

```bash
openclaw hooks enable <name>
```

Habilite un hook específico agregándolo a su configuración (`~/.openclaw/config.json`).

**Nota:** Los hooks administrados por plugins muestran `plugin:<id>` en `openclaw hooks list` y
no se pueden habilitar/deshabilitar aquí. Habilite o deshabilite el plugin en su lugar.

**Argumentos:**

- `<name>`: Nombre del hook (p. ej., `session-memory`)

**Ejemplo:**

```bash
openclaw hooks enable session-memory
```

**Salida:**

```
✓ Enabled hook: 💾 session-memory
```

**Qué hace:**

- Verifica si el hook existe y es elegible
- Actualiza `hooks.internal.entries.<name>.enabled = true` en su configuración
- Guarda la configuración en el disco

**Después de habilitar:**

- Reinicie el Gateway para que los hooks se recarguen (reinicio de la app de la barra de menús en macOS, o reinicie su proceso del Gateway en desarrollo).

## Deshabilitar un hook

```bash
openclaw hooks disable <name>
```

Deshabilite un hook específico actualizando su configuración.

**Argumentos:**

- `<name>`: Nombre del hook (p. ej., `command-logger`)

**Ejemplo:**

```bash
openclaw hooks disable command-logger
```

**Salida:**

```
⏸ Disabled hook: 📝 command-logger
```

**Después de deshabilitar:**

- Reinicie el Gateway para que los hooks se recarguen

## Instalar hooks

```bash
openclaw hooks install <path-or-spec>
```

Instale un paquete de hooks desde una carpeta/archivo local o npm.

**Qué hace:**

- Copia el paquete de hooks en `~/.openclaw/hooks/<id>`
- Habilita los hooks instalados en `hooks.internal.entries.*`
- Registra la instalación en `hooks.internal.installs`

**Opciones:**

- `-l, --link`: Enlazar un directorio local en lugar de copiarlo (lo agrega a `hooks.internal.load.extraDirs`)

**Archivos compatibles:** `.zip`, `.tgz`, `.tar.gz`, `.tar`

**Ejemplos:**

```bash
# Local directory
openclaw hooks install ./my-hook-pack

# Local archive
openclaw hooks install ./my-hook-pack.zip

# NPM package
openclaw hooks install @openclaw/my-hook-pack

# Link a local directory without copying
openclaw hooks install -l ./my-hook-pack
```

## Actualizar hooks

```bash
openclaw hooks update <id>
openclaw hooks update --all
```

Actualice los paquetes de hooks instalados (solo instalaciones desde npm).

**Opciones:**

- `--all`: Actualizar todos los paquetes de hooks rastreados
- `--dry-run`: Mostrar qué cambiaría sin escribir

## Hooks empaquetados

### session-memory

Guarda el contexto de la sesión en memoria cuando emite `/new`.

**Habilitar:**

```bash
openclaw hooks enable session-memory
```

**Salida:** `~/.openclaw/workspace/memory/YYYY-MM-DD-slug.md`

**Ver:** [documentación de session-memory](/hooks#session-memory)

### command-logger

Registra todos los eventos de comandos en un archivo de auditoría centralizado.

**Habilitar:**

```bash
openclaw hooks enable command-logger
```

**Salida:** `~/.openclaw/logs/commands.log`

**Ver registros:**

```bash
# Recent commands
tail -n 20 ~/.openclaw/logs/commands.log

# Pretty-print
cat ~/.openclaw/logs/commands.log | jq .

# Filter by action
grep '"action":"new"' ~/.openclaw/logs/commands.log | jq .
```

**Ver:** [documentación de command-logger](/hooks#command-logger)

### soul-evil

Intercambia contenido `SOUL.md` inyectado por `SOUL_EVIL.md` durante una ventana de purga o por probabilidad aleatoria.

**Habilitar:**

```bash
openclaw hooks enable soul-evil
```

**Ver:** [SOUL Evil Hook](/hooks/soul-evil)

### boot-md

Ejecuta `BOOT.md` cuando el Gateway se inicia (después de que los canales se inician).

**Eventos**: `gateway:startup`

**Habilitar**:

```bash
openclaw hooks enable boot-md
```

**Ver:** [documentación de boot-md](/hooks#boot-md)
