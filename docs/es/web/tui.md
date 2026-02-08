---
summary: "Interfaz de Usuario de Terminal (TUI): conéctese al Gateway desde cualquier máquina"
read_when:
  - Quiere una guía para principiantes de la TUI
  - Necesita la lista completa de funciones, comandos y atajos de la TUI
title: "TUI"
x-i18n:
  source_path: web/tui.md
  source_hash: 6ab8174870e4722d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:41Z
---

# TUI (Interfaz de Usuario de Terminal)

## Inicio rapido

1. Inicie el Gateway.

```bash
openclaw gateway
```

2. Abra la TUI.

```bash
openclaw tui
```

3. Escriba un mensaje y presione Enter.

Gateway remoto:

```bash
openclaw tui --url ws://<host>:<port> --token <gateway-token>
```

Use `--password` si su Gateway utiliza autenticación por contraseña.

## Lo que ve

- Encabezado: URL de conexión, agente actual, sesion actual.
- Registro de chat: mensajes del usuario, respuestas del asistente, avisos del sistema, tarjetas de herramientas.
- Línea de estado: estado de conexión/ejecución (conectando, en ejecución, transmitiendo, inactivo, error).
- Pie de página: estado de conexión + agente + sesion + modelo + pensar/verboso/razonamiento + conteos de tokens + entrega.
- Entrada: editor de texto con autocompletado.

## Modelo mental: agentes + sesiones

- Los agentes son slugs únicos (p. ej., `main`, `research`). El Gateway expone la lista.
- Las sesiones pertenecen al agente actual.
- Las claves de sesion se almacenan como `agent:<agentId>:<sessionKey>`.
  - Si escribe `/session main`, la TUI lo expande a `agent:<currentAgent>:main`.
  - Si escribe `/session agent:other:main`, cambia explícitamente a esa sesion del agente.
- Alcance de la sesion:
  - `per-sender` (predeterminado): cada agente tiene muchas sesiones.
  - `global`: la TUI siempre usa la sesion `global` (el selector puede estar vacío).
- El agente + la sesion actuales siempre son visibles en el pie de página.

## Envío + entrega

- Los mensajes se envían al Gateway; la entrega a proveedores está desactivada de forma predeterminada.
- Active la entrega:
  - `/deliver on`
  - o el panel de Configuración
  - o inicie con `openclaw tui --deliver`

## Selectores + superposiciones

- Selector de modelos: lista los modelos disponibles y establece la anulación por sesion.
- Selector de agentes: elija un agente diferente.
- Selector de sesiones: muestra solo las sesiones del agente actual.
- Configuración: alterna la entrega, la expansión de salida de herramientas y la visibilidad del pensamiento.

## Atajos de teclado

- Enter: enviar mensaje
- Esc: abortar la ejecución activa
- Ctrl+C: limpiar la entrada (presione dos veces para salir)
- Ctrl+D: salir
- Ctrl+L: selector de modelos
- Ctrl+G: selector de agentes
- Ctrl+P: selector de sesiones
- Ctrl+O: alternar expansión de salida de herramientas
- Ctrl+T: alternar visibilidad del pensamiento (recarga el historial)

## Comandos con barra

Núcleo:

- `/help`
- `/status`
- `/agent <id>` (o `/agents`)
- `/session <key>` (o `/sessions`)
- `/model <provider/model>` (o `/models`)

Controles de sesion:

- `/think <off|minimal|low|medium|high>`
- `/verbose <on|full|off>`
- `/reasoning <on|off|stream>`
- `/usage <off|tokens|full>`
- `/elevated <on|off|ask|full>` (alias: `/elev`)
- `/activation <mention|always>`
- `/deliver <on|off>`

Ciclo de vida de la sesion:

- `/new` o `/reset` (restablecer la sesion)
- `/abort` (abortar la ejecución activa)
- `/settings`
- `/exit`

Otros comandos con barra del Gateway (por ejemplo, `/context`) se reenvían al Gateway y se muestran como salida del sistema. Consulte [Slash commands](/tools/slash-commands).

## Comandos de shell local

- Anteponer una línea con `!` para ejecutar un comando de shell local en el host de la TUI.
- La TUI solicita permiso una vez por sesion para permitir la ejecución local; rechazarlo mantiene `!` deshabilitado para la sesion.
- Los comandos se ejecutan en un shell nuevo y no interactivo en el directorio de trabajo de la TUI (sin `cd`/env persistentes).
- Un `!` solo se envía como un mensaje normal; los espacios iniciales no activan la ejecución local.

## Salida de herramientas

- Las llamadas a herramientas se muestran como tarjetas con argumentos + resultados.
- Ctrl+O alterna entre vistas colapsadas/expandidas.
- Mientras se ejecutan las herramientas, las actualizaciones parciales se transmiten en la misma tarjeta.

## Historial + transmisión

- Al conectarse, la TUI carga el historial más reciente (predeterminado: 200 mensajes).
- Las respuestas transmitidas se actualizan en su lugar hasta finalizar.
- La TUI también escucha eventos de herramientas del agente para tarjetas de herramientas más ricas.

## Detalles de conexión

- La TUI se registra con el Gateway como `mode: "tui"`.
- Las reconexiones muestran un mensaje del sistema; las brechas de eventos se muestran en el registro.

## Opciones

- `--url <url>`: URL de WebSocket del Gateway (predeterminada desde la configuración o `ws://127.0.0.1:<port>`)
- `--token <token>`: token del Gateway (si es requerido)
- `--password <password>`: contraseña del Gateway (si es requerida)
- `--session <key>`: clave de sesion (predeterminada: `main`, o `global` cuando el alcance es global)
- `--deliver`: entregar respuestas del asistente al proveedor (desactivado por defecto)
- `--thinking <level>`: anular el nivel de pensamiento para los envíos
- `--timeout-ms <ms>`: tiempo de espera del agente en ms (predeterminado: `agents.defaults.timeoutSeconds`)

Nota: cuando establece `--url`, la TUI no recurre a credenciales de configuración ni de entorno.
Pase `--token` o `--password` explícitamente. La ausencia de credenciales explícitas es un error.

## Solucion de problemas

No hay salida después de enviar un mensaje:

- Ejecute `/status` en la TUI para confirmar que el Gateway está conectado e inactivo/ocupado.
- Revise los registros del Gateway: `openclaw logs --follow`.
- Confirme que el agente puede ejecutarse: `openclaw status` y `openclaw models status`.
- Si espera mensajes en un canal de chat, habilite la entrega (`/deliver on` o `--deliver`).
- `--history-limit <n>`: entradas del historial a cargar (predeterminado: 200)

## Solucion de problemas de conexión

- `disconnected`: asegúrese de que el Gateway esté en ejecución y de que sus `--url/--token/--password` sean correctos.
- No hay agentes en el selector: verifique `openclaw agents list` y su configuración de enrutamiento.
- Selector de sesiones vacío: podría estar en alcance global o no tener sesiones todavía.
