---
summary: "Backends CLI: respaldo solo de texto mediante CLIs de IA locales"
read_when:
  - Quiere un respaldo confiable cuando los proveedores de API fallan
  - Está ejecutando Claude Code CLI u otros CLIs de IA locales y quiere reutilizarlos
  - Necesita una vía solo de texto, sin herramientas, que aun así admita sesiones e imágenes
title: "Backends CLI"
x-i18n:
  source_path: gateway/cli-backends.md
  source_hash: 8285f4829900bc81
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:56Z
---

# Backends CLI (entorno de ejecución de respaldo)

OpenClaw puede ejecutar **CLIs de IA locales** como un **respaldo solo de texto** cuando los proveedores de API están caídos,
limitados por cuota o se comportan mal temporalmente. Esto es intencionalmente conservador:

- **Las herramientas están deshabilitadas** (sin llamadas a herramientas).
- **Texto entra → texto sale** (confiable).
- **Se admiten sesiones** (para que los turnos de seguimiento se mantengan coherentes).
- **Las imágenes pueden pasarse** si el CLI acepta rutas de imágenes.

Esto está diseñado como una **red de seguridad** en lugar de una vía principal. Úselo cuando
quiera respuestas de texto que “siempre funcionan” sin depender de APIs externas.

## Inicio rápido para principiantes

Puede usar Claude Code CLI **sin ninguna configuración** (OpenClaw incluye un valor predeterminado integrado):

```bash
openclaw agent --message "hi" --model claude-cli/opus-4.6
```

Codex CLI también funciona de inmediato:

```bash
openclaw agent --message "hi" --model codex-cli/gpt-5.3-codex
```

Si su Gateway se ejecuta bajo launchd/systemd y PATH es mínimo, agregue solo la
ruta del comando:

```json5
{
  agents: {
    defaults: {
      cliBackends: {
        "claude-cli": {
          command: "/opt/homebrew/bin/claude",
        },
      },
    },
  },
}
```

Eso es todo. No se necesitan claves ni configuración de autenticación adicional más allá del propio CLI.

## Uso como respaldo

Agregue un backend CLI a su lista de respaldo para que solo se ejecute cuando fallen los modelos principales:

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-opus-4-6",
        fallbacks: ["claude-cli/opus-4.6", "claude-cli/opus-4.5"],
      },
      models: {
        "anthropic/claude-opus-4-6": { alias: "Opus" },
        "claude-cli/opus-4.6": {},
        "claude-cli/opus-4.5": {},
      },
    },
  },
}
```

Notas:

- Si usa `agents.defaults.models` (allowlist), debe incluir `claude-cli/...`.
- Si el proveedor principal falla (autenticación, límites de cuota, tiempos de espera), OpenClaw
  intentará el backend CLI a continuación.

## Descripción general de la configuración

Todos los backends CLI viven bajo:

```
agents.defaults.cliBackends
```

Cada entrada está indexada por un **id de proveedor** (por ejemplo, `claude-cli`, `my-cli`).
El id de proveedor se convierte en el lado izquierdo de su referencia de modelo:

```
<provider>/<model>
```

### Ejemplo de configuración

```json5
{
  agents: {
    defaults: {
      cliBackends: {
        "claude-cli": {
          command: "/opt/homebrew/bin/claude",
        },
        "my-cli": {
          command: "my-cli",
          args: ["--json"],
          output: "json",
          input: "arg",
          modelArg: "--model",
          modelAliases: {
            "claude-opus-4-6": "opus",
            "claude-opus-4-5": "opus",
            "claude-sonnet-4-5": "sonnet",
          },
          sessionArg: "--session",
          sessionMode: "existing",
          sessionIdFields: ["session_id", "conversation_id"],
          systemPromptArg: "--system",
          systemPromptWhen: "first",
          imageArg: "--image",
          imageMode: "repeat",
          serialize: true,
        },
      },
    },
  },
}
```

## Cómo funciona

1. **Selecciona un backend** según el prefijo del proveedor (`claude-cli/...`).
2. **Construye un prompt del sistema** usando el mismo prompt de OpenClaw + el contexto del espacio de trabajo.
3. **Ejecuta el CLI** con un id de sesión (si es compatible) para que el historial se mantenga consistente.
4. **Analiza la salida** (JSON o texto plano) y devuelve el texto final.
5. **Persiste los ids de sesión** por backend, para que los seguimientos reutilicen la misma sesión del CLI.

## Sesiones

- Si el CLI admite sesiones, configure `sessionArg` (por ejemplo, `--session-id`) o
  `sessionArgs` (marcador de posición `{sessionId}`) cuando el id necesite insertarse
  en múltiples flags.
- Si el CLI usa un **subcomando de reanudación** con flags diferentes, configure
  `resumeArgs` (reemplaza `args` al reanudar) y, opcionalmente, `resumeOutput`
  (para reanudaciones no JSON).
- `sessionMode`:
  - `always`: siempre envía un id de sesión (UUID nuevo si no hay uno almacenado).
  - `existing`: solo envía un id de sesión si se almacenó uno previamente.
  - `none`: nunca envía un id de sesión.

## Imágenes (paso directo)

Si su CLI acepta rutas de imágenes, configure `imageArg`:

```json5
imageArg: "--image",
imageMode: "repeat"
```

OpenClaw escribirá las imágenes base64 en archivos temporales. Si se establece `imageArg`, esas
rutas se pasan como argumentos del CLI. Si falta `imageArg`, OpenClaw agrega las
rutas de los archivos al prompt (inyección de rutas), lo cual es suficiente para CLIs que cargan
automáticamente archivos locales a partir de rutas simples (comportamiento de Claude Code CLI).

## Entradas / salidas

- `output: "json"` (predeterminado) intenta analizar JSON y extraer texto + id de sesión.
- `output: "jsonl"` analiza flujos JSONL (Codex CLI `--json`) y extrae el
  último mensaje del agente más `thread_id` cuando está presente.
- `output: "text"` trata stdout como la respuesta final.

Modos de entrada:

- `input: "arg"` (predeterminado) pasa el prompt como el último argumento del CLI.
- `input: "stdin"` envía el prompt vía stdin.
- Si el prompt es muy largo y se establece `maxPromptArgChars`, se usa stdin.

## Valores predeterminados (integrados)

OpenClaw incluye un valor predeterminado para `claude-cli`:

- `command: "claude"`
- `args: ["-p", "--output-format", "json", "--dangerously-skip-permissions"]`
- `resumeArgs: ["-p", "--output-format", "json", "--dangerously-skip-permissions", "--resume", "{sessionId}"]`
- `modelArg: "--model"`
- `systemPromptArg: "--append-system-prompt"`
- `sessionArg: "--session-id"`
- `systemPromptWhen: "first"`
- `sessionMode: "always"`

OpenClaw también incluye un valor predeterminado para `codex-cli`:

- `command: "codex"`
- `args: ["exec","--json","--color","never","--sandbox","read-only","--skip-git-repo-check"]`
- `resumeArgs: ["exec","resume","{sessionId}","--color","never","--sandbox","read-only","--skip-git-repo-check"]`
- `output: "jsonl"`
- `resumeOutput: "text"`
- `modelArg: "--model"`
- `imageArg: "--image"`
- `sessionMode: "existing"`

Anule solo si es necesario (común: ruta absoluta de `command`).

## Limitaciones

- **Sin herramientas de OpenClaw** (el backend CLI nunca recibe llamadas a herramientas). Algunos CLIs
  aún pueden ejecutar su propio tooling de agente.
- **Sin streaming** (la salida del CLI se recopila y luego se devuelve).
- **Salidas estructuradas** dependen del formato JSON del CLI.
- **Las sesiones de Codex CLI** se reanudan mediante salida de texto (sin JSONL), lo cual es menos
  estructurado que la ejecución inicial de `--json`. Las sesiones de OpenClaw siguen funcionando
  normalmente.

## Solucion de problemas

- **CLI no encontrado**: configure `command` con una ruta completa.
- **Nombre de modelo incorrecto**: use `modelAliases` para mapear `provider/model` → modelo del CLI.
- **Sin continuidad de sesión**: asegúrese de que `sessionArg` esté configurado y que `sessionMode` no sea
  `none` (Codex CLI actualmente no puede reanudar con salida JSON).
- **Imágenes ignoradas**: configure `imageArg` (y verifique que el CLI admita rutas de archivos).
