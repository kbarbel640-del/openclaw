---
summary: "Análisis profundo: almacenamiento de sesiones + transcripciones, ciclo de vida e internos de (auto)compactación"
read_when:
  - Necesita depurar ids de sesión, JSONL de transcripciones o campos de sessions.json
  - Está cambiando el comportamiento de la auto-compactación o agregando tareas de mantenimiento de “pre-compactación”
  - Quiere implementar vaciados de memoria o turnos silenciosos del sistema
title: "Análisis Profundo de la Gestión de Sesiones"
x-i18n:
  source_path: reference/session-management-compaction.md
  source_hash: bf3715770ba63436
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:10Z
---

# Gestión de Sesiones y Compactación (Análisis Profundo)

Este documento explica cómo OpenClaw gestiona las sesiones de extremo a extremo:

- **Enrutamiento de sesiones** (cómo los mensajes entrantes se asignan a un `sessionKey`)
- **Almacén de sesiones** (`sessions.json`) y qué registra
- **Persistencia de transcripciones** (`*.jsonl`) y su estructura
- **Higiene de transcripciones** (ajustes específicos del proveedor antes de las ejecuciones)
- **Límites de contexto** (ventana de contexto vs. tokens registrados)
- **Compactación** (compactación manual + automática) y dónde enganchar trabajo de pre-compactación
- **Mantenimiento silencioso** (p. ej., escrituras de memoria que no deberían producir salida visible para el usuario)

Si desea primero una visión de alto nivel, comience con:

- [/concepts/session](/concepts/session)
- [/concepts/compaction](/concepts/compaction)
- [/concepts/session-pruning](/concepts/session-pruning)
- [/reference/transcript-hygiene](/reference/transcript-hygiene)

---

## Fuente de la verdad: el Gateway

OpenClaw está diseñado en torno a un único **proceso Gateway** que posee el estado de las sesiones.

- Las interfaces (app de macOS, UI web de Control, TUI) deben consultar al Gateway para obtener listas de sesiones y conteos de tokens.
- En modo remoto, los archivos de sesión están en el host remoto; “revisar sus archivos locales del Mac” no reflejará lo que el Gateway está usando.

---

## Dos capas de persistencia

OpenClaw persiste las sesiones en dos capas:

1. **Almacén de sesiones (`sessions.json`)**
   - Mapa clave/valor: `sessionKey -> SessionEntry`
   - Pequeño, mutable, seguro de editar (o eliminar entradas)
   - Registra metadatos de la sesión (id de sesión actual, última actividad, toggles, contadores de tokens, etc.)

2. **Transcripción (`<sessionId>.jsonl`)**
   - Transcripción de solo anexado con estructura de árbol (las entradas tienen `id` + `parentId`)
   - Almacena la conversación real + llamadas a herramientas + resúmenes de compactación
   - Se usa para reconstruir el contexto del modelo para turnos futuros

---

## Ubicaciones en disco

Por agente, en el host del Gateway:

- Almacén: `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- Transcripciones: `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`
  - Sesiones por tema de Telegram: `.../<sessionId>-topic-<threadId>.jsonl`

OpenClaw resuelve estas rutas mediante `src/config/sessions.ts`.

---

## Claves de sesión (`sessionKey`)

Una `sessionKey` identifica _en qué contenedor de conversación_ se encuentra (enrutamiento + aislamiento).

Patrones comunes:

- Chat principal/directo (por agente): `agent:<agentId>:<mainKey>` (predeterminado `main`)
- Grupo: `agent:<agentId>:<channel>:group:<id>`
- Sala/canal (Discord/Slack): `agent:<agentId>:<channel>:channel:<id>` o `...:room:<id>`
- Cron: `cron:<job.id>`
- Webhook: `hook:<uuid>` (a menos que se sobrescriba)

Las reglas canónicas están documentadas en [/concepts/session](/concepts/session).

---

## Ids de sesión (`sessionId`)

Cada `sessionKey` apunta a un `sessionId` actual (el archivo de transcripción que continúa la conversación).

Reglas prácticas:

- **Reinicio** (`/new`, `/reset`) crea un nuevo `sessionId` para esa `sessionKey`.
- **Reinicio diario** (predeterminado a las 4:00 a. m. hora local en el host del Gateway) crea un nuevo `sessionId` en el siguiente mensaje después del límite de reinicio.
- **Expiración por inactividad** (`session.reset.idleMinutes` o heredado `session.idleMinutes`) crea un nuevo `sessionId` cuando llega un mensaje después de la ventana de inactividad. Cuando diario + inactividad están ambos configurados, gana el que expire primero.

Detalle de implementación: la decisión ocurre en `initSessionState()` en `src/auto-reply/reply/session.ts`.

---

## Esquema del almacén de sesiones (`sessions.json`)

El tipo de valor del almacén es `SessionEntry` en `src/config/sessions.ts`.

Campos clave (no exhaustivo):

- `sessionId`: id de transcripción actual (el nombre del archivo se deriva de esto a menos que se establezca `sessionFile`)
- `updatedAt`: marca de tiempo de la última actividad
- `sessionFile`: anulación opcional explícita de la ruta de transcripción
- `chatType`: `direct | group | room` (ayuda a las UIs y a la política de envío)
- `provider`, `subject`, `room`, `space`, `displayName`: metadatos para el etiquetado de grupos/canales
- Toggles:
  - `thinkingLevel`, `verboseLevel`, `reasoningLevel`, `elevatedLevel`
  - `sendPolicy` (anulación por sesión)
- Selección de modelo:
  - `providerOverride`, `modelOverride`, `authProfileOverride`
- Contadores de tokens (mejor esfuerzo / dependientes del proveedor):
  - `inputTokens`, `outputTokens`, `totalTokens`, `contextTokens`
- `compactionCount`: con qué frecuencia se completó la auto-compactación para esta clave de sesión
- `memoryFlushAt`: marca de tiempo del último vaciado de memoria previo a la compactación
- `memoryFlushCompactionCount`: conteo de compactación cuando se ejecutó el último vaciado

El almacén es seguro de editar, pero el Gateway es la autoridad: puede reescribir o rehidratar entradas a medida que se ejecutan las sesiones.

---

## Estructura de la transcripción (`*.jsonl`)

Las transcripciones son gestionadas por el `SessionManager` de `@mariozechner/pi-coding-agent`.

El archivo es JSONL:

- Primera línea: encabezado de sesión (`type: "session"`, incluye `id`, `cwd`, `timestamp`, `parentSession` opcional)
- Luego: entradas de sesión con `id` + `parentId` (árbol)

Tipos de entradas notables:

- `message`: mensajes de usuario/asistente/resultado de herramienta
- `custom_message`: mensajes inyectados por extensiones que _sí_ entran en el contexto del modelo (pueden ocultarse de la UI)
- `custom`: estado de extensiones que _no_ entra en el contexto del modelo
- `compaction`: resumen de compactación persistido con `firstKeptEntryId` y `tokensBefore`
- `branch_summary`: resumen persistido al navegar una rama del árbol

OpenClaw intencionalmente **no** “corrige” transcripciones; el Gateway usa `SessionManager` para leerlas/escribirlas.

---

## Ventanas de contexto vs. tokens registrados

Importan dos conceptos distintos:

1. **Ventana de contexto del modelo**: límite duro por modelo (tokens visibles para el modelo)
2. **Contadores del almacén de sesiones**: estadísticas continuas escritas en `sessions.json` (usadas para /status y paneles)

Si está ajustando límites:

- La ventana de contexto proviene del catálogo de modelos (y puede sobrescribirse vía configuración).
- `contextTokens` en el almacén es un valor de estimación/reporte en tiempo de ejecución; no lo trate como una garantía estricta.

Para más información, vea [/token-use](/token-use).

---

## Compactación: qué es

La compactación resume conversaciones antiguas en una entrada persistida `compaction` en la transcripción y mantiene intactos los mensajes recientes.

Después de la compactación, los turnos futuros ven:

- El resumen de compactación
- Los mensajes posteriores a `firstKeptEntryId`

La compactación es **persistente** (a diferencia del podado de sesiones). Vea [/concepts/session-pruning](/concepts/session-pruning).

---

## Cuándo ocurre la auto-compactación (runtime de Pi)

En el agente Pi integrado, la auto-compactación se activa en dos casos:

1. **Recuperación por desbordamiento**: el modelo devuelve un error de desbordamiento de contexto → compactar → reintentar.
2. **Mantenimiento por umbral**: después de un turno exitoso, cuando:

`contextTokens > contextWindow - reserveTokens`

Donde:

- `contextWindow` es la ventana de contexto del modelo
- `reserveTokens` es el margen reservado para prompts + la siguiente salida del modelo

Estas son semánticas del runtime de Pi (OpenClaw consume los eventos, pero Pi decide cuándo compactar).

---

## Configuración de compactación (`reserveTokens`, `keepRecentTokens`)

La configuración de compactación de Pi vive en la configuración de Pi:

```json5
{
  compaction: {
    enabled: true,
    reserveTokens: 16384,
    keepRecentTokens: 20000,
  },
}
```

OpenClaw también aplica un piso de seguridad para ejecuciones integradas:

- Si `compaction.reserveTokens < reserveTokensFloor`, OpenClaw lo incrementa.
- El piso predeterminado es `20000` tokens.
- Establezca `agents.defaults.compaction.reserveTokensFloor: 0` para desactivar el piso.
- Si ya es más alto, OpenClaw lo deja como está.

Por qué: dejar suficiente margen para mantenimiento de múltiples turnos (como escrituras de memoria) antes de que la compactación sea inevitable.

Implementación: `ensurePiCompactionReserveTokens()` en `src/agents/pi-settings.ts`
(llamado desde `src/agents/pi-embedded-runner.ts`).

---

## Superficies visibles para el usuario

Puede observar la compactación y el estado de la sesión mediante:

- `/status` (en cualquier sesión de chat)
- `openclaw status` (CLI)
- `openclaw sessions` / `sessions --json`
- Modo verboso: `🧹 Auto-compaction complete` + conteo de compactación

---

## Mantenimiento silencioso (`NO_REPLY`)

OpenClaw admite turnos “silenciosos” para tareas en segundo plano donde el usuario no debería ver salida intermedia.

Convención:

- El asistente comienza su salida con `NO_REPLY` para indicar “no entregar una respuesta al usuario”.
- OpenClaw elimina/suprime esto en la capa de entrega.

A partir de `2026.1.10`, OpenClaw también suprime el **streaming de borrador/escritura** cuando un fragmento parcial comienza con `NO_REPLY`, de modo que las operaciones silenciosas no filtren salida parcial a mitad de turno.

---

## “Vaciado de memoria” previo a la compactación (implementado)

Objetivo: antes de que ocurra la auto-compactación, ejecutar un turno agente silencioso que escriba
estado duradero en disco (p. ej., `memory/YYYY-MM-DD.md` en el espacio de trabajo del agente) para que la compactación no pueda
borrar contexto crítico.

OpenClaw usa el enfoque de **vaciado previo al umbral**:

1. Monitorear el uso de contexto de la sesión.
2. Cuando cruza un “umbral suave” (por debajo del umbral de compactación de Pi), ejecutar una directiva silenciosa
   de “escribir memoria ahora” al agente.
3. Usar `NO_REPLY` para que el usuario no vea nada.

Configuración (`agents.defaults.compaction.memoryFlush`):

- `enabled` (predeterminado: `true`)
- `softThresholdTokens` (predeterminado: `4000`)
- `prompt` (mensaje de usuario para el turno de vaciado)
- `systemPrompt` (prompt del sistema adicional anexado para el turno de vaciado)

Notas:

- El prompt predeterminado/prompt del sistema incluyen una pista `NO_REPLY` para suprimir la entrega.
- El vaciado se ejecuta una vez por ciclo de compactación (registrado en `sessions.json`).
- El vaciado se ejecuta solo para sesiones Pi integradas (los backends de CLI lo omiten).
- El vaciado se omite cuando el espacio de trabajo de la sesión es de solo lectura (`workspaceAccess: "ro"` o `"none"`).
- Vea [Memory](/concepts/memory) para el diseño de archivos del espacio de trabajo y los patrones de escritura.

Pi también expone un gancho `session_before_compact` en la API de extensiones, pero la
lógica de vaciado de OpenClaw vive hoy del lado del Gateway.

---

## Lista de verificación de solucion de problemas

- ¿Clave de sesión incorrecta? Comience con [/concepts/session](/concepts/session) y confirme el `sessionKey` en `/status`.
- ¿Desajuste entre almacén y transcripción? Confirme el host del Gateway y la ruta del almacén desde `openclaw status`.
- ¿Demasiada compactación? Verifique:
  - ventana de contexto del modelo (demasiado pequeña)
  - configuración de compactación (`reserveTokens` demasiado alta para la ventana del modelo puede causar compactación temprana)
  - hinchazón de resultados de herramientas: habilite/ajuste el podado de sesiones
- ¿Turnos silenciosos filtrándose? Confirme que la respuesta comienza con `NO_REPLY` (token exacto) y que está en una compilación que incluye la corrección de supresión de streaming.
