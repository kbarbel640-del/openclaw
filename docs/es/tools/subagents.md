---
summary: "Subagentes: generación de ejecuciones de agentes aisladas que anuncian resultados de vuelta al chat solicitante"
read_when:
  - Desea trabajo en segundo plano/paralelo mediante el agente
  - Está cambiando sessions_spawn o la política de herramientas de subagentes
title: "Subagentes"
x-i18n:
  source_path: tools/subagents.md
  source_hash: 3c83eeed69a65dbb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:24Z
---

# Subagentes

Los subagentes son ejecuciones de agentes en segundo plano generadas a partir de una ejecución de agente existente. Se ejecutan en su propia sesión (`agent:<agentId>:subagent:<uuid>`) y, cuando finalizan, **anuncian** su resultado de vuelta al canal de chat solicitante.

## Comando de barra

Use `/subagents` para inspeccionar o controlar ejecuciones de subagentes para la **sesión actual**:

- `/subagents list`
- `/subagents stop <id|#|all>`
- `/subagents log <id|#> [limit] [tools]`
- `/subagents info <id|#>`
- `/subagents send <id|#> <message>`

`/subagents info` muestra metadatos de la ejecución (estado, marcas de tiempo, id de sesión, ruta de la transcripción, limpieza).

Objetivos principales:

- Paralelizar trabajo de “investigación / tareas largas / herramientas lentas” sin bloquear la ejecución principal.
- Mantener los subagentes aislados de forma predeterminada (separación de sesiones + sandboxing opcional).
- Mantener la superficie de herramientas difícil de usar incorrectamente: los subagentes **no** obtienen herramientas de sesión de forma predeterminada.
- Evitar la ramificación anidada: los subagentes no pueden generar subagentes.

Nota de costos: cada subagente tiene su **propio** contexto y uso de tokens. Para tareas pesadas o repetitivas, establezca un modelo más barato para los subagentes y mantenga su agente principal en un modelo de mayor calidad. Puede configurar esto mediante `agents.defaults.subagents.model` o anulaciones por agente.

## Herramienta

Use `sessions_spawn`:

- Inicia una ejecución de subagente (`deliver: false`, carril global: `subagent`)
- Luego ejecuta un paso de anuncio y publica la respuesta de anuncio en el canal de chat solicitante
- Modelo predeterminado: hereda del llamador a menos que establezca `agents.defaults.subagents.model` (o por agente `agents.list[].subagents.model`); una `sessions_spawn.model` explícita sigue prevaleciendo.
- Pensamiento predeterminado: hereda del llamador a menos que establezca `agents.defaults.subagents.thinking` (o por agente `agents.list[].subagents.thinking`); una `sessions_spawn.thinking` explícita sigue prevaleciendo.

Parámetros de la herramienta:

- `task` (obligatorio)
- `label?` (opcional)
- `agentId?` (opcional; generar bajo otro id de agente si está permitido)
- `model?` (opcional; anula el modelo del subagente; los valores inválidos se omiten y el subagente se ejecuta en el modelo predeterminado con una advertencia en el resultado de la herramienta)
- `thinking?` (opcional; anula el nivel de pensamiento para la ejecución del subagente)
- `runTimeoutSeconds?` (predeterminado `0`; cuando se establece, la ejecución del subagente se aborta después de N segundos)
- `cleanup?` (`delete|keep`, predeterminado `keep`)

Lista de permitidos:

- `agents.list[].subagents.allowAgents`: lista de ids de agente que pueden ser objetivo mediante `agentId` (`["*"]` para permitir cualquiera). Predeterminado: solo el agente solicitante.

Descubrimiento:

- Use `agents_list` para ver qué ids de agente están permitidos actualmente para `sessions_spawn`.

Archivado automático:

- Las sesiones de subagentes se archivan automáticamente después de `agents.defaults.subagents.archiveAfterMinutes` (predeterminado: 60).
- El archivo usa `sessions.delete` y renombra la transcripción a `*.deleted.<timestamp>` (misma carpeta).
- `cleanup: "delete"` archiva inmediatamente después del anuncio (aún conserva la transcripción mediante el renombrado).
- El archivado automático es de mejor esfuerzo; los temporizadores pendientes se pierden si el Gateway se reinicia.
- `runTimeoutSeconds` **no** archiva automáticamente; solo detiene la ejecución. La sesión permanece hasta el archivado automático.

## Autenticación

La autenticación de subagentes se resuelve por **id de agente**, no por tipo de sesión:

- La clave de sesión del subagente es `agent:<agentId>:subagent:<uuid>`.
- El almacén de autenticación se carga desde el `agentDir` de ese agente.
- Los perfiles de autenticación del agente principal se combinan como **respaldo**; los perfiles del agente anulan a los perfiles principales en caso de conflicto.

Nota: la combinación es aditiva, por lo que los perfiles principales siempre están disponibles como respaldo. La autenticación completamente aislada por agente aún no es compatible.

## Anuncio

Los subagentes informan de vuelta mediante un paso de anuncio:

- El paso de anuncio se ejecuta dentro de la sesión del subagente (no en la sesión solicitante).
- Si el subagente responde exactamente `ANNOUNCE_SKIP`, no se publica nada.
- De lo contrario, la respuesta de anuncio se publica en el canal de chat solicitante mediante una llamada de seguimiento `agent` (`deliver=true`).
- Las respuestas de anuncio conservan el enrutamiento de hilos/temas cuando está disponible (hilos de Slack, temas de Telegram, hilos de Matrix).
- Los mensajes de anuncio se normalizan a una plantilla estable:
  - `Status:` derivado del resultado de la ejecución (`success`, `error`, `timeout` o `unknown`).
  - `Result:` el contenido del resumen del paso de anuncio (o `(not available)` si falta).
  - `Notes:` detalles de errores y otro contexto útil.
- `Status` no se infiere de la salida del modelo; proviene de señales de resultado en tiempo de ejecución.

Las cargas útiles de anuncio incluyen una línea de estadísticas al final (incluso cuando están envueltas):

- Tiempo de ejecución (p. ej., `runtime 5m12s`)
- Uso de tokens (entrada/salida/total)
- Costo estimado cuando el precio del modelo está configurado (`models.providers.*.models[].cost`)
- `sessionKey`, `sessionId` y la ruta de la transcripción (para que el agente principal pueda obtener el historial mediante `sessions_history` o inspeccionar el archivo en disco)

## Política de herramientas (herramientas de subagentes)

De forma predeterminada, los subagentes obtienen **todas las herramientas excepto las herramientas de sesión**:

- `sessions_list`
- `sessions_history`
- `sessions_send`
- `sessions_spawn`

Anular mediante configuración:

```json5
{
  agents: {
    defaults: {
      subagents: {
        maxConcurrent: 1,
      },
    },
  },
  tools: {
    subagents: {
      tools: {
        // deny wins
        deny: ["gateway", "cron"],
        // if allow is set, it becomes allow-only (deny still wins)
        // allow: ["read", "exec", "process"]
      },
    },
  },
}
```

## Concurrencia

Los subagentes usan un carril de cola dedicado en proceso:

- Nombre del carril: `subagent`
- Concurrencia: `agents.defaults.subagents.maxConcurrent` (predeterminado `8`)

## Detención

- Enviar `/stop` en el chat solicitante aborta la sesión solicitante y detiene cualquier ejecución de subagente activa generada a partir de ella.

## Limitaciones

- El anuncio de subagentes es de **mejor esfuerzo**. Si el Gateway se reinicia, el trabajo pendiente de “anunciar de vuelta” se pierde.
- Los subagentes aún comparten los mismos recursos de proceso del Gateway; trate `maxConcurrent` como una válvula de seguridad.
- `sessions_spawn` siempre es no bloqueante: devuelve `{ status: "accepted", runId, childSessionKey }` de inmediato.
- El contexto del subagente solo inyecta `AGENTS.md` + `TOOLS.md` (sin `SOUL.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md` o `BOOTSTRAP.md`).
