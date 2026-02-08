---
summary: "Ejecución en segundo plano y gestión de procesos"
read_when:
  - Al agregar o modificar el comportamiento de ejecución en segundo plano
  - Al depurar tareas de ejecución de larga duración
title: "Ejecución en Segundo Plano y Herramienta de Procesos"
x-i18n:
  source_path: gateway/background-process.md
  source_hash: e11a7d74a75000d6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:51Z
---

# Ejecución en Segundo Plano + Herramienta de Procesos

OpenClaw ejecuta comandos de shell mediante la herramienta `exec` y mantiene las tareas de larga duración en memoria. La herramienta `process` gestiona esas sesiones en segundo plano.

## herramienta exec

Parámetros clave:

- `command` (obligatorio)
- `yieldMs` (predeterminado 10000): pasa automáticamente a segundo plano después de este retraso
- `background` (bool): ejecutar en segundo plano inmediatamente
- `timeout` (segundos, predeterminado 1800): finalizar el proceso después de este tiempo de espera
- `elevated` (bool): ejecutar en el host si el modo elevado está habilitado/permitido
- ¿Necesita un TTY real? Configure `pty: true`.
- `workdir`, `env`

Comportamiento:

- Las ejecuciones en primer plano devuelven la salida directamente.
- Cuando pasa a segundo plano (explícito o por tiempo de espera), la herramienta devuelve `status: "running"` + `sessionId` y un breve fragmento final.
- La salida se mantiene en memoria hasta que la sesión se consulta o se limpia.
- Si la herramienta `process` no está permitida, `exec` se ejecuta de forma sincrónica e ignora `yieldMs`/`background`.

## Puenteo de procesos hijos

Al generar procesos hijos de larga duración fuera de las herramientas exec/process (por ejemplo, reinicios del CLI o ayudantes del Gateway), adjunte el ayudante de puente de procesos hijos para que las señales de terminación se reenvíen y los listeners se desconecten al salir o ante errores. Esto evita procesos huérfanos en systemd y mantiene un comportamiento de apagado consistente entre plataformas.

Anulaciones por variables de entorno:

- `PI_BASH_YIELD_MS`: rendimiento predeterminado (ms)
- `PI_BASH_MAX_OUTPUT_CHARS`: límite de salida en memoria (caracteres)
- `OPENCLAW_BASH_PENDING_MAX_OUTPUT_CHARS`: límite de stdout/stderr pendiente por flujo (caracteres)
- `PI_BASH_JOB_TTL_MS`: TTL para sesiones finalizadas (ms, acotado a 1 m–3 h)

Configuración (preferida):

- `tools.exec.backgroundMs` (predeterminado 10000)
- `tools.exec.timeoutSec` (predeterminado 1800)
- `tools.exec.cleanupMs` (predeterminado 1800000)
- `tools.exec.notifyOnExit` (predeterminado true): encolar un evento del sistema + solicitar heartbeat cuando finaliza una ejecución en segundo plano.

## herramienta process

Acciones:

- `list`: sesiones en ejecución + finalizadas
- `poll`: drenar nueva salida de una sesión (también informa el estado de salida)
- `log`: leer la salida agregada (admite `offset` + `limit`)
- `write`: enviar stdin (`data`, `eof` opcional)
- `kill`: terminar una sesión en segundo plano
- `clear`: eliminar una sesión finalizada de la memoria
- `remove`: matar si está en ejecución; de lo contrario, limpiar si está finalizada

Notas:

- Solo las sesiones en segundo plano se listan y se persisten en memoria.
- Las sesiones se pierden al reiniciar el proceso (sin persistencia en disco).
- Los registros de la sesión solo se guardan en el historial del chat si ejecuta `process poll/log` y el resultado de la herramienta se registra.
- `process` tiene alcance por agente; solo ve sesiones iniciadas por ese agente.
- `process list` incluye un `name` derivado (verbo del comando + destino) para exploraciones rápidas.
- `process log` utiliza `offset`/`limit` basados en líneas (omita `offset` para obtener las últimas N líneas).

## Ejemplos

Ejecute una tarea larga y consulte más tarde:

```json
{ "tool": "exec", "command": "sleep 5 && echo done", "yieldMs": 1000 }
```

```json
{ "tool": "process", "action": "poll", "sessionId": "<id>" }
```

Iniciar inmediatamente en segundo plano:

```json
{ "tool": "exec", "command": "npm run build", "background": true }
```

Enviar stdin:

```json
{ "tool": "process", "action": "write", "sessionId": "<id>", "data": "y\n" }
```
