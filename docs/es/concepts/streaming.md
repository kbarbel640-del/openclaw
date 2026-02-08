---
summary: "Comportamiento de streaming + fragmentacion (respuestas en bloques, streaming de borradores, limites)"
read_when:
  - Explicar como funciona el streaming o la fragmentacion en los canales
  - Cambiar el comportamiento del streaming por bloques o la fragmentacion por canal
  - Depurar respuestas en bloques duplicadas o tempranas, o streaming de borradores
title: "Streaming y Fragmentacion"
x-i18n:
  source_path: concepts/streaming.md
  source_hash: f014eb1898c4351b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:48Z
---

# Streaming + fragmentacion

OpenClaw tiene dos capas separadas de “streaming”:

- **Streaming por bloques (canales):** emite **bloques** completados a medida que el asistente escribe. Estos son mensajes normales del canal (no deltas de tokens).
- **Streaming tipo tokens (solo Telegram):** actualiza una **burbuja de borrador** con texto parcial mientras se genera; el mensaje final se envía al final.

Hoy **no existe streaming real de tokens** hacia mensajes de canales externos. El streaming de borradores de Telegram es la única superficie de streaming parcial.

## Streaming por bloques (mensajes de canal)

El streaming por bloques envía la salida del asistente en fragmentos gruesos a medida que está disponible.

```
Model output
  └─ text_delta/events
       ├─ (blockStreamingBreak=text_end)
       │    └─ chunker emits blocks as buffer grows
       └─ (blockStreamingBreak=message_end)
            └─ chunker flushes at message_end
                   └─ channel send (block replies)
```

Leyenda:

- `text_delta/events`: eventos de streaming del modelo (pueden ser escasos para modelos sin streaming).
- `chunker`: `EmbeddedBlockChunker` aplicando limites min/max + preferencia de corte.
- `channel send`: mensajes salientes reales (respuestas en bloques).

**Controles:**

- `agents.defaults.blockStreamingDefault`: `"on"`/`"off"` (apagado por defecto).
- Anulaciones por canal: `*.blockStreaming` (y variantes por cuenta) para forzar `"on"`/`"off"` por canal.
- `agents.defaults.blockStreamingBreak`: `"text_end"` o `"message_end"`.
- `agents.defaults.blockStreamingChunk`: `{ minChars, maxChars, breakPreference? }`.
- `agents.defaults.blockStreamingCoalesce`: `{ minChars?, maxChars?, idleMs? }` (fusionar bloques transmitidos antes de enviar).
- Limite estricto del canal: `*.textChunkLimit` (p. ej., `channels.whatsapp.textChunkLimit`).
- Modo de fragmentacion del canal: `*.chunkMode` (`length` por defecto, `newline` divide en lineas en blanco (limites de parrafo) antes de fragmentar por longitud).
- Limite flexible de Discord: `channels.discord.maxLinesPerMessage` (17 por defecto) divide respuestas altas para evitar recortes de la UI.

**Semantica de limites:**

- `text_end`: transmite bloques tan pronto como el fragmentador emite; vacia en cada `text_end`.
- `message_end`: espera hasta que el mensaje del asistente finalice y luego vacia la salida en buffer.

`message_end` aun usa el fragmentador si el texto en buffer supera `maxChars`, por lo que puede emitir multiples fragmentos al final.

## Algoritmo de fragmentacion (limites bajo/alto)

La fragmentacion por bloques esta implementada por `EmbeddedBlockChunker`:

- **Limite bajo:** no emitir hasta que el buffer >= `minChars` (a menos que se fuerce).
- **Limite alto:** preferir cortes antes de `maxChars`; si se fuerza, cortar en `maxChars`.
- **Preferencia de corte:** `paragraph` → `newline` → `sentence` → `whitespace` → corte duro.
- **Bloques de codigo:** nunca dividir dentro de cercas; cuando se fuerza en `maxChars`, cerrar y reabrir la cerca para mantener Markdown valido.

`maxChars` se limita al `textChunkLimit` del canal, por lo que no puede exceder los limites por canal.

## Coalescencia (fusionar bloques transmitidos)

Cuando el streaming por bloques esta habilitado, OpenClaw puede **fusionar fragmentos consecutivos**
antes de enviarlos. Esto reduce el “spam de una sola linea” mientras sigue proporcionando
salida progresiva.

- La coalescencia espera **intervalos de inactividad** (`idleMs`) antes de vaciar.
- Los buffers estan limitados por `maxChars` y se vaciaran si lo exceden.
- `minChars` evita que se envien fragmentos diminutos hasta que se acumule suficiente texto
  (el vaciado final siempre envia el texto restante).
- El conector se deriva de `blockStreamingChunk.breakPreference`
  (`paragraph` → `\n\n`, `newline` → `\n`, `sentence` → espacio).
- Hay anulaciones por canal disponibles via `*.blockStreamingCoalesce` (incluidas configuraciones por cuenta).
- El `minChars` de coalescencia por defecto se eleva a 1500 para Signal/Slack/Discord a menos que se anule.

## Ritmo humano entre bloques

Cuando el streaming por bloques esta habilitado, puede agregar una **pausa aleatoria**
entre respuestas en bloques (despues del primer bloque). Esto hace que las respuestas
con multiples burbujas se sientan mas naturales.

- Configuracion: `agents.defaults.humanDelay` (anular por agente via `agents.list[].humanDelay`).
- Modos: `off` (por defecto), `natural` (800–2500ms), `custom` (`minMs`/`maxMs`).
- Aplica solo a **respuestas en bloques**, no a respuestas finales ni a resumenes de herramientas.

## “Transmitir fragmentos o todo”

Esto se asigna a:

- **Transmitir fragmentos:** `blockStreamingDefault: "on"` + `blockStreamingBreak: "text_end"` (emitir a medida que avanza). Los canales que no son Telegram tambien necesitan `*.blockStreaming: true`.
- **Transmitir todo al final:** `blockStreamingBreak: "message_end"` (vaciar una vez, posiblemente en multiples fragmentos si es muy largo).
- **Sin streaming por bloques:** `blockStreamingDefault: "off"` (solo respuesta final).

**Nota del canal:** Para canales que no son Telegram, el streaming por bloques esta **apagado a menos que**
`*.blockStreaming` se establezca explicitamente en `true`. Telegram puede transmitir borradores
(`channels.telegram.streamMode`) sin respuestas en bloques.

Recordatorio de ubicacion de configuracion: los valores predeterminados de `blockStreaming*` viven bajo
`agents.defaults`, no en la configuracion raiz.

## Streaming de borradores de Telegram (tipo tokens)

Telegram es el unico canal con streaming de borradores:

- Usa la API de Bot `sendMessageDraft` en **chats privados con temas**.
- `channels.telegram.streamMode: "partial" | "block" | "off"`.
  - `partial`: actualizaciones del borrador con el texto mas reciente del streaming.
  - `block`: actualizaciones del borrador en bloques fragmentados (mismas reglas del fragmentador).
  - `off`: sin streaming de borradores.
- Configuracion de fragmentos del borrador (solo para `streamMode: "block"`): `channels.telegram.draftChunk` (valores predeterminados: `minChars: 200`, `maxChars: 800`).
- El streaming de borradores es independiente del streaming por bloques; las respuestas en bloques estan apagadas por defecto y solo se habilitan mediante `*.blockStreaming: true` en canales que no son Telegram.
- La respuesta final sigue siendo un mensaje normal.
- `/reasoning stream` escribe el razonamiento en la burbuja del borrador (solo Telegram).

Cuando el streaming de borradores esta activo, OpenClaw deshabilita el streaming por bloques para esa respuesta para evitar doble streaming.

```
Telegram (private + topics)
  └─ sendMessageDraft (draft bubble)
       ├─ streamMode=partial → update latest text
       └─ streamMode=block   → chunker updates draft
  └─ final reply → normal message
```

Leyenda:

- `sendMessageDraft`: burbuja de borrador de Telegram (no es un mensaje real).
- `final reply`: envio normal de mensaje de Telegram.
