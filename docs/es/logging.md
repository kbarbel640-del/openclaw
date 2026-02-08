---
summary: "Descripción general del logging: registros en archivos, salida de consola, seguimiento por CLI y la UI de Control"
read_when:
  - Necesita una descripción general del logging para principiantes
  - Quiere configurar niveles o formatos de logs
  - Está solucionando problemas y necesita encontrar logs rápidamente
title: "Logging"
x-i18n:
  source_path: logging.md
  source_hash: 884fcf4a906adff3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:33Z
---

# Logging

OpenClaw registra en dos lugares:

- **Logs de archivos** (líneas JSON) escritos por el Gateway.
- **Salida de consola** mostrada en terminales y en la UI de Control.

Esta página explica dónde se encuentran los logs, cómo leerlos y cómo configurar
niveles y formatos de logging.

## Dónde se encuentran los logs

De forma predeterminada, el Gateway escribe un archivo de log rotativo en:

`/tmp/openclaw/openclaw-YYYY-MM-DD.log`

La fecha usa la zona horaria local del host del Gateway.

Puede sobrescribir esto en `~/.openclaw/openclaw.json`:

```json
{
  "logging": {
    "file": "/path/to/openclaw.log"
  }
}
```

## Cómo leer los logs

### CLI: seguimiento en vivo (recomendado)

Use la CLI para hacer tail del archivo de log del gateway vía RPC:

```bash
openclaw logs --follow
```

Modos de salida:

- **Sesiones TTY**: líneas de log estructuradas, bonitas y con colores.
- **Sesiones no TTY**: texto plano.
- `--json`: JSON delimitado por líneas (un evento de log por línea).
- `--plain`: forzar texto plano en sesiones TTY.
- `--no-color`: deshabilitar colores ANSI.

En modo JSON, la CLI emite objetos etiquetados con `type`:

- `meta`: metadatos del stream (archivo, cursor, tamaño)
- `log`: entrada de log analizada
- `notice`: pistas de truncamiento / rotación
- `raw`: línea de log no analizada

Si el Gateway no es accesible, la CLI imprime una breve sugerencia para ejecutar:

```bash
openclaw doctor
```

### UI de Control (web)

La pestaña **Logs** de la UI de Control hace tail del mismo archivo usando `logs.tail`.
Vea [/web/control-ui](/web/control-ui) para saber cómo abrirla.

### Logs solo por canal

Para filtrar actividad por canal (WhatsApp/Telegram/etc), use:

```bash
openclaw channels logs --channel whatsapp
```

## Formatos de logs

### Logs de archivos (JSONL)

Cada línea del archivo de log es un objeto JSON. La CLI y la UI de Control analizan
estas entradas para renderizar salida estructurada (hora, nivel, subsistema, mensaje).

### Salida de consola

Los logs de consola son **conscientes de TTY** y están formateados para legibilidad:

- Prefijos de subsistema (p. ej., `gateway/channels/whatsapp`)
- Coloreado por nivel (info/warn/error)
- Modo compacto u opción JSON

El formato de la consola se controla mediante `logging.consoleStyle`.

## Configuración del logging

Toda la configuración de logging vive bajo `logging` en `~/.openclaw/openclaw.json`.

```json
{
  "logging": {
    "level": "info",
    "file": "/tmp/openclaw/openclaw-YYYY-MM-DD.log",
    "consoleLevel": "info",
    "consoleStyle": "pretty",
    "redactSensitive": "tools",
    "redactPatterns": ["sk-.*"]
  }
}
```

### Niveles de log

- `logging.level`: nivel de **logs de archivos** (JSONL).
- `logging.consoleLevel`: nivel de verbosidad de **consola**.

`--verbose` solo afecta la salida de consola; no cambia los niveles de los logs de archivo.

### Estilos de consola

`logging.consoleStyle`:

- `pretty`: amigable para humanos, con colores y marcas de tiempo.
- `compact`: salida más compacta (mejor para sesiones largas).
- `json`: JSON por línea (para procesadores de logs).

### Redacción

Los resúmenes de herramientas pueden redactar tokens sensibles antes de llegar a la consola:

- `logging.redactSensitive`: `off` | `tools` (predeterminado: `tools`)
- `logging.redactPatterns`: lista de cadenas regex para sobrescribir el conjunto predeterminado

La redacción afecta **solo la salida de consola** y no altera los logs de archivo.

## Diagnósticos + OpenTelemetry

Los diagnósticos son eventos estructurados y legibles por máquinas para ejecuciones de modelos **y**
telemetría de flujo de mensajes (webhooks, encolado, estado de sesión). **No**
reemplazan los logs; existen para alimentar métricas, trazas y otros exportadores.

Los eventos de diagnósticos se emiten en proceso, pero los exportadores solo se adjuntan cuando
los diagnósticos y el plugin del exportador están habilitados.

### OpenTelemetry vs OTLP

- **OpenTelemetry (OTel)**: el modelo de datos + SDKs para trazas, métricas y logs.
- **OTLP**: el protocolo de transporte usado para exportar datos OTel a un colector/backend.
- OpenClaw exporta hoy vía **OTLP/HTTP (protobuf)**.

### Señales exportadas

- **Métricas**: contadores + histogramas (uso de tokens, flujo de mensajes, encolado).
- **Trazas**: spans para uso de modelos + procesamiento de webhooks/mensajes.
- **Logs**: exportados vía OTLP cuando `diagnostics.otel.logs` está habilitado. El volumen
  de logs puede ser alto; tenga en cuenta `logging.level` y los filtros del exportador.

### Catálogo de eventos de diagnóstico

Uso de modelos:

- `model.usage`: tokens, costo, duración, contexto, proveedor/modelo/canal, ids de sesión.

Flujo de mensajes:

- `webhook.received`: ingreso de webhooks por canal.
- `webhook.processed`: webhook manejado + duración.
- `webhook.error`: errores del manejador de webhooks.
- `message.queued`: mensaje encolado para procesamiento.
- `message.processed`: resultado + duración + error opcional.

Colas + sesiones:

- `queue.lane.enqueue`: encolado en la cola de comandos por carril + profundidad.
- `queue.lane.dequeue`: desencolado por carril + tiempo de espera.
- `session.state`: transición de estado de sesión + motivo.
- `session.stuck`: advertencia de sesión atascada + antigüedad.
- `run.attempt`: metadatos de reintento/intento de ejecución.
- `diagnostic.heartbeat`: contadores agregados (webhooks/cola/sesión).

### Habilitar diagnósticos (sin exportador)

Use esto si quiere que los eventos de diagnóstico estén disponibles para plugins o sinks personalizados:

```json
{
  "diagnostics": {
    "enabled": true
  }
}
```

### Flags de diagnósticos (logs dirigidos)

Use flags para activar logs de depuración adicionales y dirigidos sin elevar `logging.level`.
Las flags no distinguen mayúsculas/minúsculas y admiten comodines (p. ej., `telegram.*` o `*`).

```json
{
  "diagnostics": {
    "flags": ["telegram.http"]
  }
}
```

Sobrescritura por env (puntual):

```
OPENCLAW_DIAGNOSTICS=telegram.http,telegram.payload
```

Notas:

- Los logs por flags van al archivo de log estándar (el mismo que `logging.file`).
- La salida sigue siendo redactada según `logging.redactSensitive`.
- Guía completa: [/diagnostics/flags](/diagnostics/flags).

### Exportar a OpenTelemetry

Los diagnósticos pueden exportarse mediante el plugin `diagnostics-otel` (OTLP/HTTP). Esto
funciona con cualquier colector/backend de OpenTelemetry que acepte OTLP/HTTP.

```json
{
  "plugins": {
    "allow": ["diagnostics-otel"],
    "entries": {
      "diagnostics-otel": {
        "enabled": true
      }
    }
  },
  "diagnostics": {
    "enabled": true,
    "otel": {
      "enabled": true,
      "endpoint": "http://otel-collector:4318",
      "protocol": "http/protobuf",
      "serviceName": "openclaw-gateway",
      "traces": true,
      "metrics": true,
      "logs": true,
      "sampleRate": 0.2,
      "flushIntervalMs": 60000
    }
  }
}
```

Notas:

- También puede habilitar el plugin con `openclaw plugins enable diagnostics-otel`.
- `protocol` actualmente admite solo `http/protobuf`. `grpc` se ignora.
- Las métricas incluyen uso de tokens, costo, tamaño de contexto, duración de ejecuciones y
  contadores/histogramas de flujo de mensajes (webhooks, encolado, estado de sesión, profundidad/espera de cola).
- Las trazas/métricas pueden activarse o desactivarse con `traces` / `metrics` (predeterminado: activado). Las trazas
  incluyen spans de uso de modelos más spans de procesamiento de webhooks/mensajes cuando están habilitados.
- Configure `headers` cuando su colector requiera autenticación.
- Variables de entorno compatibles: `OTEL_EXPORTER_OTLP_ENDPOINT`,
  `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_PROTOCOL`.

### Métricas exportadas (nombres + tipos)

Uso de modelos:

- `openclaw.tokens` (counter, attrs: `openclaw.token`, `openclaw.channel`,
  `openclaw.provider`, `openclaw.model`)
- `openclaw.cost.usd` (counter, attrs: `openclaw.channel`, `openclaw.provider`,
  `openclaw.model`)
- `openclaw.run.duration_ms` (histogram, attrs: `openclaw.channel`,
  `openclaw.provider`, `openclaw.model`)
- `openclaw.context.tokens` (histogram, attrs: `openclaw.context`,
  `openclaw.channel`, `openclaw.provider`, `openclaw.model`)

Flujo de mensajes:

- `openclaw.webhook.received` (counter, attrs: `openclaw.channel`,
  `openclaw.webhook`)
- `openclaw.webhook.error` (counter, attrs: `openclaw.channel`,
  `openclaw.webhook`)
- `openclaw.webhook.duration_ms` (histogram, attrs: `openclaw.channel`,
  `openclaw.webhook`)
- `openclaw.message.queued` (counter, attrs: `openclaw.channel`,
  `openclaw.source`)
- `openclaw.message.processed` (counter, attrs: `openclaw.channel`,
  `openclaw.outcome`)
- `openclaw.message.duration_ms` (histogram, attrs: `openclaw.channel`,
  `openclaw.outcome`)

Colas + sesiones:

- `openclaw.queue.lane.enqueue` (counter, attrs: `openclaw.lane`)
- `openclaw.queue.lane.dequeue` (counter, attrs: `openclaw.lane`)
- `openclaw.queue.depth` (histogram, attrs: `openclaw.lane` o
  `openclaw.channel=heartbeat`)
- `openclaw.queue.wait_ms` (histogram, attrs: `openclaw.lane`)
- `openclaw.session.state` (counter, attrs: `openclaw.state`, `openclaw.reason`)
- `openclaw.session.stuck` (counter, attrs: `openclaw.state`)
- `openclaw.session.stuck_age_ms` (histogram, attrs: `openclaw.state`)
- `openclaw.run.attempt` (counter, attrs: `openclaw.attempt`)

### Spans exportados (nombres + atributos clave)

- `openclaw.model.usage`
  - `openclaw.channel`, `openclaw.provider`, `openclaw.model`
  - `openclaw.sessionKey`, `openclaw.sessionId`
  - `openclaw.tokens.*` (input/output/cache_read/cache_write/total)
- `openclaw.webhook.processed`
  - `openclaw.channel`, `openclaw.webhook`, `openclaw.chatId`
- `openclaw.webhook.error`
  - `openclaw.channel`, `openclaw.webhook`, `openclaw.chatId`,
    `openclaw.error`
- `openclaw.message.processed`
  - `openclaw.channel`, `openclaw.outcome`, `openclaw.chatId`,
    `openclaw.messageId`, `openclaw.sessionKey`, `openclaw.sessionId`,
    `openclaw.reason`
- `openclaw.session.stuck`
  - `openclaw.state`, `openclaw.ageMs`, `openclaw.queueDepth`,
    `openclaw.sessionKey`, `openclaw.sessionId`

### Muestreo + vaciado

- Muestreo de trazas: `diagnostics.otel.sampleRate` (0.0–1.0, solo spans raíz).
- Intervalo de exportación de métricas: `diagnostics.otel.flushIntervalMs` (mín. 1000 ms).

### Notas del protocolo

- Los endpoints OTLP/HTTP pueden configurarse mediante `diagnostics.otel.endpoint` o
  `OTEL_EXPORTER_OTLP_ENDPOINT`.
- Si el endpoint ya contiene `/v1/traces` o `/v1/metrics`, se usa tal cual.
- Si el endpoint ya contiene `/v1/logs`, se usa tal cual para logs.
- `diagnostics.otel.logs` habilita la exportación de logs OTLP para la salida del logger principal.

### Comportamiento de exportación de logs

- Los logs OTLP usan los mismos registros estructurados escritos en `logging.file`.
- Respetan `logging.level` (nivel de log de archivo). La redacción de consola **no** aplica
  a los logs OTLP.
- Las instalaciones de alto volumen deberían preferir muestreo/filtrado en el colector OTLP.

## Consejos de solucion de problemas

- **¿Gateway no accesible?** Ejecute `openclaw doctor` primero.
- **¿Logs vacíos?** Verifique que el Gateway esté ejecutándose y escribiendo en la ruta del archivo
  indicada en `logging.file`.
- **¿Necesita más detalle?** Configure `logging.level` en `debug` o `trace` y reintente.
