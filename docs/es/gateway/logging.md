---
summary: "Superficies de registro, registros en archivos, estilos de registro WS y formato de consola"
read_when:
  - Cambiar la salida o los formatos de registro
  - Depurar la salida de la CLI o del gateway
title: "Registro"
x-i18n:
  source_path: gateway/logging.md
  source_hash: efb8eda5e77e3809
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:58Z
---

# Registro

Para una vista general orientada al usuario (CLI + Control UI + configuración), consulte [/logging](/logging).

OpenClaw tiene dos “superficies” de registro:

- **Salida de consola** (lo que usted ve en la terminal / UI de depuración).
- **Registros en archivos** (líneas JSON) escritos por el registrador del gateway.

## Registrador basado en archivos

- El archivo de registro rotativo predeterminado está bajo `/tmp/openclaw/` (un archivo por día): `openclaw-YYYY-MM-DD.log`
  - La fecha usa la zona horaria local del host del gateway.
- La ruta y el nivel del archivo de registro se pueden configurar mediante `~/.openclaw/openclaw.json`:
  - `logging.file`
  - `logging.level`

El formato del archivo es un objeto JSON por línea.

La pestaña Logs del Control UI hace _tail_ de este archivo a través del gateway (`logs.tail`).
La CLI puede hacer lo mismo:

```bash
openclaw logs --follow
```

**Verbosidad vs. niveles de registro**

- **Los registros en archivos** se controlan exclusivamente mediante `logging.level`.
- `--verbose` solo afecta la **verbosidad de la consola** (y el estilo de registro WS); **no**
  eleva el nivel de registro del archivo.
- Para capturar detalles solo verbosos en los registros de archivos, establezca `logging.level` en `debug` o
  `trace`.

## Captura de consola

La CLI captura `console.log/info/warn/error/debug/trace` y los escribe en los registros de archivos,
mientras sigue imprimiendo en stdout/stderr.

Usted puede ajustar la verbosidad de la consola de forma independiente mediante:

- `logging.consoleLevel` (predeterminado `info`)
- `logging.consoleStyle` (`pretty` | `compact` | `json`)

## Redacción del resumen de herramientas

Los resúmenes verbosos de herramientas (p. ej., `🛠️ Exec: ...`) pueden enmascarar tokens sensibles antes de llegar al
flujo de la consola. Esto es **solo para herramientas** y no altera los registros de archivos.

- `logging.redactSensitive`: `off` | `tools` (predeterminado: `tools`)
- `logging.redactPatterns`: arreglo de cadenas regex (anula los valores predeterminados)
  - Use cadenas regex crudas (auto `gi`), o `/pattern/flags` si necesita banderas personalizadas.
  - Las coincidencias se enmascaran conservando los primeros 6 + los últimos 4 caracteres (longitud >= 18); de lo contrario `***`.
  - Los valores predeterminados cubren asignaciones de claves comunes, banderas de la CLI, campos JSON, encabezados bearer, bloques PEM y prefijos de tokens populares.

## Registros WebSocket del gateway

El gateway imprime registros del protocolo WebSocket en dos modos:

- **Modo normal (sin `--verbose`)**: solo se imprimen resultados RPC “interesantes”:
  - errores (`ok=false`)
  - llamadas lentas (umbral predeterminado: `>= 50ms`)
  - errores de análisis
- **Modo verboso (`--verbose`)**: imprime todo el tráfico de solicitud/respuesta WS.

### Estilo de registro WS

`openclaw gateway` admite un cambio de estilo por gateway:

- `--ws-log auto` (predeterminado): el modo normal está optimizado; el modo verboso usa salida compacta
- `--ws-log compact`: salida compacta (solicitud/respuesta emparejadas) cuando es verboso
- `--ws-log full`: salida completa por trama cuando es verboso
- `--compact`: alias de `--ws-log compact`

Ejemplos:

```bash
# optimized (only errors/slow)
openclaw gateway

# show all WS traffic (paired)
openclaw gateway --verbose --ws-log compact

# show all WS traffic (full meta)
openclaw gateway --verbose --ws-log full
```

## Formato de consola (registro por subsistemas)

El formateador de consola es **consciente de TTY** e imprime líneas coherentes con prefijos.
Los registradores por subsistema mantienen la salida agrupada y fácil de escanear.

Comportamiento:

- **Prefijos de subsistema** en cada línea (p. ej., `[gateway]`, `[canvas]`, `[tailscale]`)
- **Colores por subsistema** (estables por subsistema) además del coloreado por nivel
- **Color cuando la salida es un TTY o el entorno parece una terminal rica** (`TERM`/`COLORTERM`/`TERM_PROGRAM`), respeta `NO_COLOR`
- **Prefijos de subsistema acortados**: elimina el `gateway/` inicial + `channels/`, conserva los últimos 2 segmentos (p. ej., `whatsapp/outbound`)
- **Sub-registradores por subsistema** (prefijo automático + campo estructurado `{ subsystem }`)
- **`logRaw()`** para salida QR/UX (sin prefijo, sin formato)
- **Estilos de consola** (p. ej., `pretty | compact | json`)
- **Nivel de registro de consola** separado del nivel de registro en archivos (el archivo conserva el detalle completo cuando `logging.level` se establece en `debug`/`trace`)
- **Los cuerpos de mensajes de WhatsApp** se registran en `debug` (use `--verbose` para verlos)

Esto mantiene estables los registros de archivos existentes mientras hace que la salida interactiva sea fácil de escanear.
