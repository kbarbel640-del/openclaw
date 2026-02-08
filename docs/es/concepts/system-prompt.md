---
summary: "Qué contiene el system prompt de OpenClaw y cómo se ensambla"
read_when:
  - Edición del texto del system prompt, la lista de herramientas o las secciones de tiempo/heartbeat
  - Cambio del bootstrap del workspace o del comportamiento de inyección de Skills
title: "System Prompt"
x-i18n:
  source_path: concepts/system-prompt.md
  source_hash: bef4b2674ba0414c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:44Z
---

# System Prompt

OpenClaw construye un system prompt personalizado para cada ejecución de agente. El prompt es **propiedad de OpenClaw** y no utiliza el prompt predeterminado de p-coding-agent.

El prompt es ensamblado por OpenClaw e inyectado en cada ejecución de agente.

## Estructura

El prompt es intencionalmente compacto y utiliza secciones fijas:

- **Tooling**: lista actual de herramientas + descripciones breves.
- **Safety**: breve recordatorio de barreras de seguridad para evitar comportamientos de búsqueda de poder o eludir la supervisión.
- **Skills** (cuando están disponibles): indica al modelo cómo cargar instrucciones de skills bajo demanda.
- **OpenClaw Self-Update**: cómo ejecutar `config.apply` y `update.run`.
- **Workspace**: directorio de trabajo (`agents.defaults.workspace`).
- **Documentation**: ruta local a la documentación de OpenClaw (repo o paquete npm) y cuándo leerla.
- **Workspace Files (injected)**: indica que los archivos de bootstrap se incluyen a continuación.
- **Sandbox** (cuando está habilitado): indica el runtime en sandbox, las rutas del sandbox y si la ejecución elevada está disponible.
- **Current Date & Time**: hora local del usuario, zona horaria y formato de hora.
- **Reply Tags**: sintaxis opcional de etiquetas de respuesta para proveedores compatibles.
- **Heartbeats**: prompt de heartbeat y comportamiento de ack.
- **Runtime**: host, SO, node, modelo, raíz del repo (cuando se detecta), nivel de thinking (una línea).
- **Reasoning**: nivel actual de visibilidad + pista del interruptor /reasoning.

Las barreras de seguridad en el system prompt son orientativas. Guían el comportamiento del modelo, pero no hacen cumplir la política. Utilice políticas de herramientas, aprobaciones de exec, sandboxing y listas de permitidos de canales para la aplicación estricta; los operadores pueden deshabilitar estas por diseño.

## Modos de prompt

OpenClaw puede renderizar system prompts más pequeños para subagentes. El runtime establece un
`promptMode` para cada ejecución (no es una configuración visible para el usuario):

- `full` (predeterminado): incluye todas las secciones anteriores.
- `minimal`: se utiliza para subagentes; omite **Skills**, **Memory Recall**, **OpenClaw
  Self-Update**, **Model Aliases**, **User Identity**, **Reply Tags**,
  **Messaging**, **Silent Replies** y **Heartbeats**. Tooling, **Safety**,
  Workspace, Sandbox, Current Date & Time (cuando se conoce), Runtime y el contexto
  inyectado permanecen disponibles.
- `none`: devuelve solo la línea base de identidad.

Cuando `promptMode=minimal`, los prompts inyectados adicionales se etiquetan como **Subagent
Context** en lugar de **Group Chat Context**.

## Inyección de bootstrap del workspace

Los archivos de bootstrap se recortan y se anexan bajo **Project Context** para que el modelo vea el contexto de identidad y perfil sin necesidad de lecturas explícitas:

- `AGENTS.md`
- `SOUL.md`
- `TOOLS.md`
- `IDENTITY.md`
- `USER.md`
- `HEARTBEAT.md`
- `BOOTSTRAP.md` (solo en workspaces completamente nuevos)

Los archivos grandes se truncan con un marcador. El tamaño máximo por archivo está controlado por
`agents.defaults.bootstrapMaxChars` (predeterminado: 20000). Los archivos faltantes inyectan un
breve marcador de archivo faltante.

Los hooks internos pueden interceptar este paso mediante `agent:bootstrap` para mutar o reemplazar
los archivos de bootstrap inyectados (por ejemplo, intercambiando `SOUL.md` por una persona alternativa).

Para inspeccionar cuánto contribuye cada archivo inyectado (crudo vs inyectado, truncamiento, además de la sobrecarga del esquema de herramientas), use `/context list` o `/context detail`. Vea [Context](/concepts/context).

## Manejo del tiempo

El system prompt incluye una sección dedicada de **Current Date & Time** cuando se conoce la
zona horaria del usuario. Para mantener estable la caché del prompt, ahora solo incluye
la **zona horaria** (sin reloj dinámico ni formato de hora).

Use `session_status` cuando el agente necesite la hora actual; la tarjeta de estado
incluye una línea de marca de tiempo.

Configure con:

- `agents.defaults.userTimezone`
- `agents.defaults.timeFormat` (`auto` | `12` | `24`)

Vea [Date & Time](/date-time) para obtener detalles completos del comportamiento.

## Skills

Cuando existen skills elegibles, OpenClaw inyecta una **lista compacta de skills disponibles**
(`formatSkillsForPrompt`) que incluye la **ruta del archivo** para cada skill. El
prompt indica al modelo que use `read` para cargar el SKILL.md en la ubicación listada
(workspace, gestionado o incluido). Si no hay skills elegibles, la
sección de Skills se omite.

```
<available_skills>
  <skill>
    <name>...</name>
    <description>...</description>
    <location>...</location>
  </skill>
</available_skills>
```

Esto mantiene pequeño el prompt base mientras sigue habilitando el uso dirigido de skills.

## Documentation

Cuando está disponible, el system prompt incluye una sección de **Documentation** que apunta al
directorio local de documentación de OpenClaw (ya sea `docs/` en el workspace del repo o la documentación
incluida del paquete npm) y también menciona el espejo público, el repo de origen, el Discord de la comunidad y
ClawHub (https://clawhub.com) para el descubrimiento de skills. El prompt indica al modelo que consulte primero la documentación local
para el comportamiento, comandos, configuración o arquitectura de OpenClaw, y que ejecute
`openclaw status` por sí mismo cuando sea posible (preguntando al usuario solo cuando no tenga acceso).
