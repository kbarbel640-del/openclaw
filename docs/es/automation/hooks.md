---
summary: "Hooks: automatización basada en eventos para comandos y eventos del ciclo de vida"
read_when:
  - Quiere automatización basada en eventos para /new, /reset, /stop y eventos del ciclo de vida del agente
  - Quiere crear, instalar o depurar hooks
title: "Hooks"
x-i18n:
  source_path: automation/hooks.md
  source_hash: 9fbcf9e04fd9e62c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:40Z
---

# Hooks

Los hooks proporcionan un sistema extensible basado en eventos para automatizar acciones en respuesta a comandos y eventos del agente. Los hooks se descubren automáticamente desde directorios y pueden gestionarse mediante comandos de la CLI, de forma similar a cómo funcionan las Skills en OpenClaw.

## Orientación

Los hooks son pequeños scripts que se ejecutan cuando ocurre algo. Hay dos tipos:

- **Hooks** (esta página): se ejecutan dentro del Gateway cuando se disparan eventos del agente, como `/new`, `/reset`, `/stop` o eventos del ciclo de vida.
- **Webhooks**: webhooks HTTP externos que permiten que otros sistemas activen trabajo en OpenClaw. Consulte [Webhook Hooks](/automation/webhook) o use `openclaw webhooks` para comandos auxiliares de Gmail.

Los hooks también pueden incluirse dentro de plugins; consulte [Plugins](/tools/plugin#plugin-hooks).

Usos comunes:

- Guardar una instantánea de memoria cuando reinicia una sesión
- Mantener un registro de auditoría de comandos para solución de problemas o cumplimiento
- Activar automatización de seguimiento cuando una sesión comienza o termina
- Escribir archivos en el espacio de trabajo del agente o llamar a APIs externas cuando se disparan eventos

Si puede escribir una pequeña función en TypeScript, puede escribir un hook. Los hooks se descubren automáticamente, y usted los habilita o deshabilita mediante la CLI.

## Descripción general

El sistema de hooks le permite:

- Guardar el contexto de la sesión en memoria cuando se emite `/new`
- Registrar todos los comandos para auditoría
- Activar automatizaciones personalizadas en eventos del ciclo de vida del agente
- Extender el comportamiento de OpenClaw sin modificar el código principal

## Primeros Pasos

### Hooks incluidos

OpenClaw incluye cuatro hooks integrados que se descubren automáticamente:

- **💾 session-memory**: Guarda el contexto de la sesión en el espacio de trabajo de su agente (por defecto `~/.openclaw/workspace/memory/`) cuando emite `/new`
- **📝 command-logger**: Registra todos los eventos de comandos en `~/.openclaw/logs/commands.log`
- **🚀 boot-md**: Ejecuta `BOOT.md` cuando se inicia el gateway (requiere hooks internos habilitados)
- **😈 soul-evil**: Intercambia contenido inyectado de `SOUL.md` con `SOUL_EVIL.md` durante una ventana de purga o por probabilidad aleatoria

Listar hooks disponibles:

```bash
openclaw hooks list
```

Habilitar un hook:

```bash
openclaw hooks enable session-memory
```

Comprobar el estado del hook:

```bash
openclaw hooks check
```

Obtener información detallada:

```bash
openclaw hooks info session-memory
```

### Incorporacion

Durante la incorporación (`openclaw onboard`), se le pedirá habilitar hooks recomendados. El asistente descubre automáticamente los hooks elegibles y los presenta para su selección.

## Descubrimiento de Hooks

Los hooks se descubren automáticamente desde tres directorios (en orden de precedencia):

1. **Hooks del espacio de trabajo**: `<workspace>/hooks/` (por agente, máxima precedencia)
2. **Hooks gestionados**: `~/.openclaw/hooks/` (instalados por el usuario, compartidos entre espacios de trabajo)
3. **Hooks incluidos**: `<openclaw>/dist/hooks/bundled/` (incluidos con OpenClaw)

Los directorios de hooks gestionados pueden ser un **hook único** o un **paquete de hooks** (directorio de paquete).

Cada hook es un directorio que contiene:

```
my-hook/
├── HOOK.md          # Metadata + documentation
└── handler.ts       # Handler implementation
```

## Paquetes de Hooks (npm/archivos)

Los paquetes de hooks son paquetes npm estándar que exportan uno o más hooks mediante `openclaw.hooks` en
`package.json`. Instálelos con:

```bash
openclaw hooks install <path-or-spec>
```

Ejemplo de `package.json`:

```json
{
  "name": "@acme/my-hooks",
  "version": "0.1.0",
  "openclaw": {
    "hooks": ["./hooks/my-hook", "./hooks/other-hook"]
  }
}
```

Cada entrada apunta a un directorio de hook que contiene `HOOK.md` y `handler.ts` (o `index.ts`).
Los paquetes de hooks pueden incluir dependencias; se instalarán en `~/.openclaw/hooks/<id>`.

## Estructura del Hook

### Formato de HOOK.md

El archivo `HOOK.md` contiene metadatos en frontmatter YAML más documentación en Markdown:

```markdown
---
name: my-hook
description: "Short description of what this hook does"
homepage: https://docs.openclaw.ai/hooks#my-hook
metadata:
  { "openclaw": { "emoji": "🔗", "events": ["command:new"], "requires": { "bins": ["node"] } } }
---

# My Hook

Detailed documentation goes here...

## What It Does

- Listens for `/new` commands
- Performs some action
- Logs the result

## Requirements

- Node.js must be installed

## Configuration

No configuration needed.
```

### Campos de metadatos

El objeto `metadata.openclaw` admite:

- **`emoji`**: Emoji de visualización para la CLI (p. ej., `"💾"`)
- **`events`**: Arreglo de eventos a escuchar (p. ej., `["command:new", "command:reset"]`)
- **`export`**: Exportación nombrada a usar (por defecto `"default"`)
- **`homepage`**: URL de documentación
- **`requires`**: Requisitos opcionales
  - **`bins`**: Binarios requeridos en PATH (p. ej., `["git", "node"]`)
  - **`anyBins`**: Al menos uno de estos binarios debe estar presente
  - **`env`**: Variables de entorno requeridas
  - **`config`**: Rutas de configuración requeridas (p. ej., `["workspace.dir"]`)
  - **`os`**: Plataformas requeridas (p. ej., `["darwin", "linux"]`)
- **`always`**: Omitir comprobaciones de elegibilidad (booleano)
- **`install`**: Métodos de instalación (para hooks incluidos: `[{"id":"bundled","kind":"bundled"}]`)

### Implementación del manejador

El archivo `handler.ts` exporta una función `HookHandler`:

```typescript
import type { HookHandler } from "../../src/hooks/hooks.js";

const myHandler: HookHandler = async (event) => {
  // Only trigger on 'new' command
  if (event.type !== "command" || event.action !== "new") {
    return;
  }

  console.log(`[my-hook] New command triggered`);
  console.log(`  Session: ${event.sessionKey}`);
  console.log(`  Timestamp: ${event.timestamp.toISOString()}`);

  // Your custom logic here

  // Optionally send message to user
  event.messages.push("✨ My hook executed!");
};

export default myHandler;
```

#### Contexto del evento

Cada evento incluye:

```typescript
{
  type: 'command' | 'session' | 'agent' | 'gateway',
  action: string,              // e.g., 'new', 'reset', 'stop'
  sessionKey: string,          // Session identifier
  timestamp: Date,             // When the event occurred
  messages: string[],          // Push messages here to send to user
  context: {
    sessionEntry?: SessionEntry,
    sessionId?: string,
    sessionFile?: string,
    commandSource?: string,    // e.g., 'whatsapp', 'telegram'
    senderId?: string,
    workspaceDir?: string,
    bootstrapFiles?: WorkspaceBootstrapFile[],
    cfg?: OpenClawConfig
  }
}
```

## Tipos de eventos

### Eventos de comandos

Se activan cuando se emiten comandos del agente:

- **`command`**: Todos los eventos de comandos (escucha general)
- **`command:new`**: Cuando se emite el comando `/new`
- **`command:reset`**: Cuando se emite el comando `/reset`
- **`command:stop`**: Cuando se emite el comando `/stop`

### Eventos del agente

- **`agent:bootstrap`**: Antes de que se inyecten los archivos de arranque del espacio de trabajo (los hooks pueden mutar `context.bootstrapFiles`)

### Eventos del Gateway

Se activan cuando se inicia el gateway:

- **`gateway:startup`**: Después de que los canales se inician y los hooks se cargan

### Hooks de resultados de herramientas (API de plugins)

Estos hooks no son oyentes de flujo de eventos; permiten a los plugins ajustar sincrónicamente los resultados de herramientas antes de que OpenClaw los persista.

- **`tool_result_persist`**: Transformar resultados de herramientas antes de que se escriban en la transcripción de la sesión. Debe ser sincrónico; devuelva la carga útil actualizada del resultado de la herramienta o `undefined` para mantenerla sin cambios. Consulte [Agent Loop](/concepts/agent-loop).

### Eventos futuros

Tipos de eventos planificados:

- **`session:start`**: Cuando comienza una nueva sesión
- **`session:end`**: Cuando termina una sesión
- **`agent:error`**: Cuando un agente encuentra un error
- **`message:sent`**: Cuando se envía un mensaje
- **`message:received`**: Cuando se recibe un mensaje

## Creación de Hooks personalizados

### 1. Elegir ubicación

- **Hooks del espacio de trabajo** (`<workspace>/hooks/`): Por agente, máxima precedencia
- **Hooks gestionados** (`~/.openclaw/hooks/`): Compartidos entre espacios de trabajo

### 2. Crear estructura de directorios

```bash
mkdir -p ~/.openclaw/hooks/my-hook
cd ~/.openclaw/hooks/my-hook
```

### 3. Crear HOOK.md

```markdown
---
name: my-hook
description: "Does something useful"
metadata: { "openclaw": { "emoji": "🎯", "events": ["command:new"] } }
---

# My Custom Hook

This hook does something useful when you issue `/new`.
```

### 4. Crear handler.ts

```typescript
import type { HookHandler } from "../../src/hooks/hooks.js";

const handler: HookHandler = async (event) => {
  if (event.type !== "command" || event.action !== "new") {
    return;
  }

  console.log("[my-hook] Running!");
  // Your logic here
};

export default handler;
```

### 5. Habilitar y probar

```bash
# Verify hook is discovered
openclaw hooks list

# Enable it
openclaw hooks enable my-hook

# Restart your gateway process (menu bar app restart on macOS, or restart your dev process)

# Trigger the event
# Send /new via your messaging channel
```

## Configuración

### Nuevo formato de configuración (recomendado)

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "session-memory": { "enabled": true },
        "command-logger": { "enabled": false }
      }
    }
  }
}
```

### Configuración por hook

Los hooks pueden tener configuración personalizada:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "my-hook": {
          "enabled": true,
          "env": {
            "MY_CUSTOM_VAR": "value"
          }
        }
      }
    }
  }
}
```

### Directorios adicionales

Cargar hooks desde directorios adicionales:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "load": {
        "extraDirs": ["/path/to/more/hooks"]
      }
    }
  }
}
```

### Formato de configuración heredado (aún compatible)

El formato de configuración antiguo sigue funcionando por compatibilidad retroactiva:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "handlers": [
        {
          "event": "command:new",
          "module": "./hooks/handlers/my-handler.ts",
          "export": "default"
        }
      ]
    }
  }
}
```

**Migración**: Use el nuevo sistema basado en descubrimiento para hooks nuevos. Los manejadores heredados se cargan después de los hooks basados en directorios.

## Comandos de la CLI

### Listar hooks

```bash
# List all hooks
openclaw hooks list

# Show only eligible hooks
openclaw hooks list --eligible

# Verbose output (show missing requirements)
openclaw hooks list --verbose

# JSON output
openclaw hooks list --json
```

### Información del hook

```bash
# Show detailed info about a hook
openclaw hooks info session-memory

# JSON output
openclaw hooks info session-memory --json
```

### Comprobar elegibilidad

```bash
# Show eligibility summary
openclaw hooks check

# JSON output
openclaw hooks check --json
```

### Habilitar/Deshabilitar

```bash
# Enable a hook
openclaw hooks enable session-memory

# Disable a hook
openclaw hooks disable command-logger
```

## Referencia de hooks incluidos

### session-memory

Guarda el contexto de la sesión en memoria cuando emite `/new`.

**Eventos**: `command:new`

**Requisitos**: `workspace.dir` debe estar configurado

**Salida**: `<workspace>/memory/YYYY-MM-DD-slug.md` (por defecto `~/.openclaw/workspace`)

**Qué hace**:

1. Usa la entrada de la sesión previa al reinicio para localizar la transcripción correcta
2. Extrae las últimas 15 líneas de la conversación
3. Usa el LLM para generar un slug descriptivo de nombre de archivo
4. Guarda los metadatos de la sesión en un archivo de memoria con fecha

**Ejemplo de salida**:

```markdown
# Session: 2026-01-16 14:30:00 UTC

- **Session Key**: agent:main:main
- **Session ID**: abc123def456
- **Source**: telegram
```

**Ejemplos de nombres de archivo**:

- `2026-01-16-vendor-pitch.md`
- `2026-01-16-api-design.md`
- `2026-01-16-1430.md` (marca de tiempo de respaldo si falla la generación del slug)

**Habilitar**:

```bash
openclaw hooks enable session-memory
```

### command-logger

Registra todos los eventos de comandos en un archivo de auditoría centralizado.

**Eventos**: `command`

**Requisitos**: Ninguno

**Salida**: `~/.openclaw/logs/commands.log`

**Qué hace**:

1. Captura detalles del evento (acción del comando, marca de tiempo, clave de sesión, ID del remitente, origen)
2. Añade al archivo de registro en formato JSONL
3. Se ejecuta silenciosamente en segundo plano

**Ejemplos de entradas de registro**:

```jsonl
{"timestamp":"2026-01-16T14:30:00.000Z","action":"new","sessionKey":"agent:main:main","senderId":"+1234567890","source":"telegram"}
{"timestamp":"2026-01-16T15:45:22.000Z","action":"stop","sessionKey":"agent:main:main","senderId":"user@example.com","source":"whatsapp"}
```

**Ver registros**:

```bash
# View recent commands
tail -n 20 ~/.openclaw/logs/commands.log

# Pretty-print with jq
cat ~/.openclaw/logs/commands.log | jq .

# Filter by action
grep '"action":"new"' ~/.openclaw/logs/commands.log | jq .
```

**Habilitar**:

```bash
openclaw hooks enable command-logger
```

### soul-evil

Intercambia contenido inyectado de `SOUL.md` con `SOUL_EVIL.md` durante una ventana de purga o por probabilidad aleatoria.

**Eventos**: `agent:bootstrap`

**Documentación**: [SOUL Evil Hook](/hooks/soul-evil)

**Salida**: No se escriben archivos; los intercambios ocurren solo en memoria.

**Habilitar**:

```bash
openclaw hooks enable soul-evil
```

**Configuración**:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "soul-evil": {
          "enabled": true,
          "file": "SOUL_EVIL.md",
          "chance": 0.1,
          "purge": { "at": "21:00", "duration": "15m" }
        }
      }
    }
  }
}
```

### boot-md

Ejecuta `BOOT.md` cuando se inicia el gateway (después de que se inician los canales).
Los hooks internos deben estar habilitados para que esto se ejecute.

**Eventos**: `gateway:startup`

**Requisitos**: `workspace.dir` debe estar configurado

**Qué hace**:

1. Lee `BOOT.md` desde su espacio de trabajo
2. Ejecuta las instrucciones mediante el ejecutor del agente
3. Envía cualquier mensaje saliente solicitado mediante la herramienta de mensajes

**Habilitar**:

```bash
openclaw hooks enable boot-md
```

## Mejores prácticas

### Mantener los manejadores rápidos

Los hooks se ejecutan durante el procesamiento de comandos. Manténgalos livianos:

```typescript
// ✓ Good - async work, returns immediately
const handler: HookHandler = async (event) => {
  void processInBackground(event); // Fire and forget
};

// ✗ Bad - blocks command processing
const handler: HookHandler = async (event) => {
  await slowDatabaseQuery(event);
  await evenSlowerAPICall(event);
};
```

### Manejar errores con elegancia

Envuelva siempre las operaciones riesgosas:

```typescript
const handler: HookHandler = async (event) => {
  try {
    await riskyOperation(event);
  } catch (err) {
    console.error("[my-handler] Failed:", err instanceof Error ? err.message : String(err));
    // Don't throw - let other handlers run
  }
};
```

### Filtrar eventos temprano

Retorne temprano si el evento no es relevante:

```typescript
const handler: HookHandler = async (event) => {
  // Only handle 'new' commands
  if (event.type !== "command" || event.action !== "new") {
    return;
  }

  // Your logic here
};
```

### Usar claves de eventos específicas

Especifique eventos exactos en los metadatos cuando sea posible:

```yaml
metadata: { "openclaw": { "events": ["command:new"] } } # Specific
```

En lugar de:

```yaml
metadata: { "openclaw": { "events": ["command"] } } # General - more overhead
```

## Depuración

### Habilitar registro de hooks

El gateway registra la carga de hooks al inicio:

```
Registered hook: session-memory -> command:new
Registered hook: command-logger -> command
Registered hook: boot-md -> gateway:startup
```

### Comprobar descubrimiento

Listar todos los hooks descubiertos:

```bash
openclaw hooks list --verbose
```

### Comprobar registro

En su manejador, registre cuando es llamado:

```typescript
const handler: HookHandler = async (event) => {
  console.log("[my-handler] Triggered:", event.type, event.action);
  // Your logic
};
```

### Verificar elegibilidad

Compruebe por qué un hook no es elegible:

```bash
openclaw hooks info my-hook
```

Busque requisitos faltantes en la salida.

## Pruebas

### Registros del Gateway

Monitoree los registros del gateway para ver la ejecución de hooks:

```bash
# macOS
./scripts/clawlog.sh -f

# Other platforms
tail -f ~/.openclaw/gateway.log
```

### Probar hooks directamente

Pruebe sus manejadores de forma aislada:

```typescript
import { test } from "vitest";
import { createHookEvent } from "./src/hooks/hooks.js";
import myHandler from "./hooks/my-hook/handler.js";

test("my handler works", async () => {
  const event = createHookEvent("command", "new", "test-session", {
    foo: "bar",
  });

  await myHandler(event);

  // Assert side effects
});
```

## Arquitectura

### Componentes principales

- **`src/hooks/types.ts`**: Definiciones de tipos
- **`src/hooks/workspace.ts`**: Escaneo y carga de directorios
- **`src/hooks/frontmatter.ts`**: Análisis de metadatos de HOOK.md
- **`src/hooks/config.ts`**: Comprobación de elegibilidad
- **`src/hooks/hooks-status.ts`**: Reporte de estado
- **`src/hooks/loader.ts`**: Cargador dinámico de módulos
- **`src/cli/hooks-cli.ts`**: Comandos de la CLI
- **`src/gateway/server-startup.ts`**: Carga hooks al inicio del gateway
- **`src/auto-reply/reply/commands-core.ts`**: Dispara eventos de comandos

### Flujo de descubrimiento

```
Gateway startup
    ↓
Scan directories (workspace → managed → bundled)
    ↓
Parse HOOK.md files
    ↓
Check eligibility (bins, env, config, os)
    ↓
Load handlers from eligible hooks
    ↓
Register handlers for events
```

### Flujo de eventos

```
User sends /new
    ↓
Command validation
    ↓
Create hook event
    ↓
Trigger hook (all registered handlers)
    ↓
Command processing continues
    ↓
Session reset
```

## Solucion de problemas

### Hook no descubierto

1. Compruebe la estructura de directorios:

   ```bash
   ls -la ~/.openclaw/hooks/my-hook/
   # Should show: HOOK.md, handler.ts
   ```

2. Verifique el formato de HOOK.md:

   ```bash
   cat ~/.openclaw/hooks/my-hook/HOOK.md
   # Should have YAML frontmatter with name and metadata
   ```

3. Liste todos los hooks descubiertos:

   ```bash
   openclaw hooks list
   ```

### Hook no elegible

Compruebe los requisitos:

```bash
openclaw hooks info my-hook
```

Busque faltantes:

- Binarios (verifique PATH)
- Variables de entorno
- Valores de configuración
- Compatibilidad del sistema operativo

### Hook no se ejecuta

1. Verifique que el hook esté habilitado:

   ```bash
   openclaw hooks list
   # Should show ✓ next to enabled hooks
   ```

2. Reinicie su proceso del gateway para que los hooks se recarguen.

3. Revise los registros del gateway por errores:

   ```bash
   ./scripts/clawlog.sh | grep hook
   ```

### Errores del manejador

Revise errores de TypeScript/importación:

```bash
# Test import directly
node -e "import('./path/to/handler.ts').then(console.log)"
```

## Guía de migración

### De configuración heredada a descubrimiento

**Antes**:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "handlers": [
        {
          "event": "command:new",
          "module": "./hooks/handlers/my-handler.ts"
        }
      ]
    }
  }
}
```

**Después**:

1. Cree el directorio del hook:

   ```bash
   mkdir -p ~/.openclaw/hooks/my-hook
   mv ./hooks/handlers/my-handler.ts ~/.openclaw/hooks/my-hook/handler.ts
   ```

2. Cree HOOK.md:

   ```markdown
   ---
   name: my-hook
   description: "My custom hook"
   metadata: { "openclaw": { "emoji": "🎯", "events": ["command:new"] } }
   ---

   # My Hook

   Does something useful.
   ```

3. Actualice la configuración:

   ```json
   {
     "hooks": {
       "internal": {
         "enabled": true,
         "entries": {
           "my-hook": { "enabled": true }
         }
       }
     }
   }
   ```

4. Verifique y reinicie su proceso del gateway:

   ```bash
   openclaw hooks list
   # Should show: 🎯 my-hook ✓
   ```

**Beneficios de la migración**:

- Descubrimiento automático
- Gestión mediante CLI
- Comprobación de elegibilidad
- Mejor documentación
- Estructura consistente

## Ver también

- [Referencia de la CLI: hooks](/cli/hooks)
- [README de Hooks incluidos](https://github.com/openclaw/openclaw/tree/main/src/hooks/bundled)
- [Webhook Hooks](/automation/webhook)
- [Configuración](/gateway/configuration#hooks)
