---
summary: "Flujo de mensajes, sesiones, encolado y visibilidad del razonamiento"
read_when:
  - Explicar cómo los mensajes entrantes se convierten en respuestas
  - Aclarar sesiones, modos de encolado o comportamiento de streaming
  - Documentar la visibilidad del razonamiento y sus implicaciones de uso
title: "Mensajes"
x-i18n:
  source_path: concepts/messages.md
  source_hash: 32a1b0c50616c550
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:38Z
---

# Mensajes

Esta página integra cómo OpenClaw maneja los mensajes entrantes, las sesiones, el encolado,
el streaming y la visibilidad del razonamiento.

## Flujo de mensajes (alto nivel)

```
Inbound message
  -> routing/bindings -> session key
  -> queue (if a run is active)
  -> agent run (streaming + tools)
  -> outbound replies (channel limits + chunking)
```

Los controles clave viven en la configuracion:

- `messages.*` para prefijos, encolado y comportamiento en grupos.
- `agents.defaults.*` para streaming por bloques y valores predeterminados de fragmentación.
- Anulaciones por canal (`channels.whatsapp.*`, `channels.telegram.*`, etc.) para límites y alternancias de streaming.

Consulte [Configuración](/gateway/configuration) para el esquema completo.

## Dedupe entrante

Los canales pueden volver a entregar el mismo mensaje después de reconexiones. OpenClaw mantiene un
caché de corta duración con clave por canal/cuenta/par/sesión/id de mensaje para que las entregas
duplicadas no disparen otra ejecución del agente.

## Debouncing entrante

Mensajes consecutivos rápidos del **mismo remitente** pueden agruparse en un solo
turno del agente mediante `messages.inbound`. El debouncing se delimita por canal + conversación
y usa el mensaje más reciente para el encadenamiento de respuestas/IDs.

Configuración (valor global predeterminado + anulaciones por canal):

```json5
{
  messages: {
    inbound: {
      debounceMs: 2000,
      byChannel: {
        whatsapp: 5000,
        slack: 1500,
        discord: 1500,
      },
    },
  },
}
```

Notas:

- El debouncing aplica a mensajes **solo de texto**; los medios/adjuntos se envían de inmediato.
- Los comandos de control omiten el debouncing para que permanezcan independientes.

## Sesiones y dispositivos

Las sesiones pertenecen al Gateway, no a los clientes.

- Los chats directos se colapsan en la clave de sesión principal del agente.
- Los grupos/canales obtienen sus propias claves de sesión.
- El almacén de sesiones y las transcripciones viven en el host del Gateway.

Varios dispositivos/canales pueden mapear a la misma sesión, pero el historial no se sincroniza
por completo de vuelta a cada cliente. Recomendación: use un dispositivo principal para
conversaciones largas y evitar contexto divergente. La IU de Control y la TUI siempre muestran
la transcripción de la sesión respaldada por el Gateway, por lo que son la fuente de verdad.

Detalles: [Gestión de sesiones](/concepts/session).

## Cuerpos entrantes y contexto de historial

OpenClaw separa el **cuerpo del prompt** del **cuerpo del comando**:

- `Body`: texto del prompt enviado al agente. Esto puede incluir envolturas del canal y
  envolturas de historial opcionales.
- `CommandBody`: texto bruto del usuario para el análisis de directivas/comandos.
- `RawBody`: alias heredado de `CommandBody` (se mantiene por compatibilidad).

Cuando un canal suministra historial, usa una envoltura compartida:

- `[Chat messages since your last reply - for context]`
- `[Current message - respond to this]`

Para **chats no directos** (grupos/canales/salas), el **cuerpo del mensaje actual** se antepone con la
etiqueta del remitente (el mismo estilo usado para las entradas del historial). Esto mantiene
consistentes los mensajes en tiempo real y los encolados/de historial en el prompt del agente.

Los búferes de historial son **solo pendientes**: incluyen mensajes de grupo que _no_
dispararon una ejecución (por ejemplo, mensajes con puerta por mención) y **excluyen** mensajes
ya presentes en la transcripción de la sesión.

La eliminación de directivas solo aplica a la sección del **mensaje actual**, de modo que el
historial permanece intacto. Los canales que envuelven historial deben establecer `CommandBody` (o
`RawBody`) al texto original del mensaje y mantener `Body` como el prompt combinado.
Los búferes de historial son configurables mediante `messages.groupChat.historyLimit` (valor global
predeterminado) y anulaciones por canal como `channels.slack.historyLimit` o
`channels.telegram.accounts.<id>.historyLimit` (establezca `0` para deshabilitar).

## Encolado y seguimientos

Si ya hay una ejecución activa, los mensajes entrantes pueden encolarse, dirigirse a la
ejecución actual o recopilarse para un turno de seguimiento.

- Configure mediante `messages.queue` (y `messages.queue.byChannel`).
- Modos: `interrupt`, `steer`, `followup`, `collect`, además de variantes con backlog.

Detalles: [Encolado](/concepts/queue).

## Streaming, fragmentación y agrupación

El streaming por bloques envía respuestas parciales a medida que el modelo produce bloques de texto.
La fragmentación respeta los límites de texto del canal y evita dividir código cercado.

Ajustes clave:

- `agents.defaults.blockStreamingDefault` (`on|off`, desactivado por defecto)
- `agents.defaults.blockStreamingBreak` (`text_end|message_end`)
- `agents.defaults.blockStreamingChunk` (`minChars|maxChars|breakPreference`)
- `agents.defaults.blockStreamingCoalesce` (agrupación basada en inactividad)
- `agents.defaults.humanDelay` (pausa tipo humana entre respuestas por bloques)
- Anulaciones por canal: `*.blockStreaming` y `*.blockStreamingCoalesce` (los canales no Telegram requieren `*.blockStreaming: true` explícito)

Detalles: [Streaming + fragmentación](/concepts/streaming).

## Visibilidad del razonamiento y tokens

OpenClaw puede exponer u ocultar el razonamiento del modelo:

- `/reasoning on|off|stream` controla la visibilidad.
- El contenido de razonamiento sigue contando para el uso de tokens cuando el modelo lo produce.
- Telegram admite el streaming del razonamiento en el globo de borrador.

Detalles: [Directivas de pensamiento + razonamiento](/tools/thinking) y [Uso de tokens](/token-use).

## Prefijos, encadenamiento y respuestas

El formato de mensajes salientes se centraliza en `messages`:

- `messages.responsePrefix`, `channels.<channel>.responsePrefix` y `channels.<channel>.accounts.<id>.responsePrefix` (cascada de prefijos salientes), además de `channels.whatsapp.messagePrefix` (prefijo entrante de WhatsApp)
- Encadenamiento de respuestas mediante `replyToMode` y valores predeterminados por canal

Detalles: [Configuración](/gateway/configuration#messages) y la documentación de cada canal.
