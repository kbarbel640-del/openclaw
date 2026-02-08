---
summary: "Runtime del agente (pi-mono integrado), contrato del workspace y arranque de sesion"
read_when:
  - Al cambiar el runtime del agente, el arranque del workspace o el comportamiento de la sesion
title: "Runtime del Agente"
x-i18n:
  source_path: concepts/agent.md
  source_hash: 04b4e0bc6345d2af
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:35Z
---

# Runtime del Agente 🤖

OpenClaw ejecuta un unico runtime de agente integrado derivado de **pi-mono**.

## Workspace (requerido)

OpenClaw utiliza un unico directorio de workspace del agente (`agents.defaults.workspace`) como el **unico** directorio de trabajo (`cwd`) del agente para herramientas y contexto.

Recomendado: use `openclaw setup` para crear `~/.openclaw/openclaw.json` si falta e inicializar los archivos del workspace.

Diseno completo del workspace + guia de respaldos: [Workspace del agente](/concepts/agent-workspace)

Si `agents.defaults.sandbox` esta habilitado, las sesiones que no son la principal pueden sobrescribir esto con
workspaces por sesion bajo `agents.defaults.sandbox.workspaceRoot` (vea
[Configuracion del Gateway](/gateway/configuration)).

## Archivos de arranque (inyectados)

Dentro de `agents.defaults.workspace`, OpenClaw espera estos archivos editables por el usuario:

- `AGENTS.md` — instrucciones operativas + “memoria”
- `SOUL.md` — personalidad, limites, tono
- `TOOLS.md` — notas de herramientas mantenidas por el usuario (p. ej., `imsg`, `sag`, convenciones)
- `BOOTSTRAP.md` — ritual unico de primera ejecucion (se elimina tras completarse)
- `IDENTITY.md` — nombre/vibra/emoji del agente
- `USER.md` — perfil del usuario + forma de tratamiento preferida

En el primer turno de una nueva sesion, OpenClaw inyecta el contenido de estos archivos directamente en el contexto del agente.

Los archivos en blanco se omiten. Los archivos grandes se recortan y se truncan con un marcador para mantener los prompts ligeros (lea el archivo para el contenido completo).

Si falta un archivo, OpenClaw inyecta una unica linea con el marcador de “archivo faltante” (y `openclaw setup` creara una plantilla predeterminada segura).

`BOOTSTRAP.md` solo se crea para un **workspace completamente nuevo** (no hay otros archivos de arranque presentes). Si lo elimina despues de completar el ritual, no deberia recrearse en reinicios posteriores.

Para deshabilitar por completo la creacion de archivos de arranque (para workspaces pre-sembrados), configure:

```json5
{ agent: { skipBootstrap: true } }
```

## Herramientas integradas

Las herramientas principales (leer/ejecutar/editar/escribir y herramientas del sistema relacionadas) siempre estan disponibles,
sujetas a la politica de herramientas. `apply_patch` es opcional y esta protegido por
`tools.exec.applyPatch`. `TOOLS.md` **no** controla que herramientas existen; es
orientacion sobre como _usted_ desea que se usen.

## Skills

OpenClaw carga Skills desde tres ubicaciones (el workspace gana en conflictos de nombre):

- Integradas (incluidas con la instalacion)
- Gestionadas/locales: `~/.openclaw/skills`
- Workspace: `<workspace>/skills`

Las Skills pueden estar protegidas por configuracion/variables de entorno (vea `skills` en [Configuracion del Gateway](/gateway/configuration)).

## Integracion con pi-mono

OpenClaw reutiliza partes del codigo de pi-mono (modelos/herramientas), pero **la gestion de sesiones, el descubrimiento y el cableado de herramientas son propiedad de OpenClaw**.

- Sin runtime de agente pi-coding.
- No se consultan configuraciones de `~/.pi/agent` ni `<workspace>/.pi`.

## Sesiones

Las transcripciones de sesion se almacenan como JSONL en:

- `~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl`

El ID de sesion es estable y lo elige OpenClaw.
Las carpetas de sesiones heredadas de Pi/Tau **no** se leen.

## Direccion durante el streaming

Cuando el modo de cola es `steer`, los mensajes entrantes se inyectan en la ejecucion actual.
La cola se verifica **despues de cada llamada a herramienta**; si hay un mensaje en cola,
se omiten las llamadas a herramientas restantes del mensaje actual del asistente (resultados de herramienta de error con "Skipped due to queued user message."), luego el mensaje del usuario en cola
se inyecta antes de la siguiente respuesta del asistente.

Cuando el modo de cola es `followup` o `collect`, los mensajes entrantes se retienen hasta que termina el
turno actual; luego comienza un nuevo turno del agente con las cargas utiles en cola. Vea
[Queue](/concepts/queue) para el comportamiento de modo + debounce/cap.

El envio por bloques de streaming envia bloques completos del asistente tan pronto como terminan; esta
**desactivado por defecto** (`agents.defaults.blockStreamingDefault: "off"`).
Ajuste el limite mediante `agents.defaults.blockStreamingBreak` (`text_end` vs `message_end`; el valor predeterminado es text_end).
Controle el fragmentado suave de bloques con `agents.defaults.blockStreamingChunk` (predeterminado
800–1200 caracteres; prefiere saltos de parrafo, luego nuevas lineas; las oraciones al final).
Agrupe fragmentos transmitidos con `agents.defaults.blockStreamingCoalesce` para reducir
el spam de una sola linea (fusion basada en inactividad antes del envio). Los canales que no son Telegram requieren
`*.blockStreaming: true` explicito para habilitar respuestas por bloques.
Se emiten resúmenes detallados de herramientas al inicio de la herramienta (sin debounce); la UI de Control
transmite la salida de la herramienta mediante eventos del agente cuando esta disponible.
Mas detalles: [Streaming + fragmentacion](/concepts/streaming).

## Referencias de modelo

Las referencias de modelo en la configuracion (por ejemplo `agents.defaults.model` y `agents.defaults.models`) se analizan dividiendolas por el **primer** `/`.

- Use `provider/model` al configurar modelos.
- Si el ID del modelo en si contiene `/` (estilo OpenRouter), incluya el prefijo del proveedor (ejemplo: `openrouter/moonshotai/kimi-k2`).
- Si omite el proveedor, OpenClaw trata la entrada como un alias o un modelo para el **proveedor predeterminado** (solo funciona cuando no hay `/` en el ID del modelo).

## Configuracion (minima)

Como minimo, configure:

- `agents.defaults.workspace`
- `channels.whatsapp.allowFrom` (fuertemente recomendado)

---

_Siguiente: [Chats Grupales](/concepts/group-messages)_ 🦞
