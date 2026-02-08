---
summary: "Comportamiento y configuracion para el manejo de mensajes de grupo de WhatsApp (los mentionPatterns se comparten entre superficies)"
read_when:
  - Al cambiar reglas de mensajes de grupo o menciones
title: "Mensajes de grupo"
x-i18n:
  source_path: channels/group-messages.md
  source_hash: 181a72f12f5021af
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:30Z
---

# Mensajes de grupo (canal web de WhatsApp)

Objetivo: permitir que Clawd esté en grupos de WhatsApp, se active solo cuando lo mencionen y mantenga ese hilo separado de la sesion personal de Mensaje directo.

Nota: `agents.list[].groupChat.mentionPatterns` ahora tambien se usa en Telegram/Discord/Slack/iMessage; este documento se centra en el comportamiento especifico de WhatsApp. Para configuraciones con multiples agentes, establezca `agents.list[].groupChat.mentionPatterns` por agente (o use `messages.groupChat.mentionPatterns` como respaldo global).

## Lo implementado (2025-12-03)

- Modos de activacion: `mention` (predeterminado) o `always`. `mention` requiere una mencion (menciones reales @ de WhatsApp mediante `mentionedJids`, patrones regex, o el E.164 del bot en cualquier parte del texto). `always` activa al agente con cada mensaje, pero solo debe responder cuando pueda aportar valor significativo; de lo contrario devuelve el token silencioso `NO_REPLY`. Los valores predeterminados pueden establecerse en la configuracion (`channels.whatsapp.groups`) y sobrescribirse por grupo mediante `/activation`. Cuando se establece `channels.whatsapp.groups`, tambien actua como una lista de permitidos del grupo (incluya `"*"` para permitir a todos).
- Politica de grupo: `channels.whatsapp.groupPolicy` controla si se aceptan mensajes de grupo (`open|disabled|allowlist`). `allowlist` usa `channels.whatsapp.groupAllowFrom` (respaldo: `channels.whatsapp.allowFrom` explicito). El valor predeterminado es `allowlist` (bloqueado hasta que agregue remitentes).
- Sesiones por grupo: las claves de sesion se ven como `agent:<agentId>:whatsapp:group:<jid>`, por lo que comandos como `/verbose on` o `/think high` (enviados como mensajes independientes) se limitan a ese grupo; el estado del Mensaje directo personal no se ve afectado. Los heartbeats se omiten para los hilos de grupo.
- Inyeccion de contexto: los mensajes de grupo **solo pendientes** (50 por defecto) que _no_ activaron una ejecucion se anteponen bajo `[Chat messages since your last reply - for context]`, con la linea activadora bajo `[Current message - respond to this]`. Los mensajes que ya estan en la sesion no se reinyectan.
- Exposicion del remitente: cada lote de grupo ahora termina con `[from: Sender Name (+E164)]` para que Pi sepa quien habla.
- Efimeros/ver una vez: los desempaquetamos antes de extraer texto/menciones, por lo que las menciones dentro de ellos igualmente activan.
- Prompt del sistema para grupos: en el primer turno de una sesion de grupo (y cada vez que `/activation` cambia el modo) inyectamos una breve nota en el prompt del sistema como `You are replying inside the WhatsApp group "<subject>". Group members: Alice (+44...), Bob (+43...), … Activation: trigger-only … Address the specific sender noted in the message context.`. Si los metadatos no estan disponibles, igualmente indicamos al agente que es un chat grupal.

## Ejemplo de configuracion (WhatsApp)

Agregue un bloque `groupChat` a `~/.openclaw/openclaw.json` para que las menciones por nombre visible funcionen incluso cuando WhatsApp elimina el `@` visual en el cuerpo del texto:

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "*": { requireMention: true },
      },
    },
  },
  agents: {
    list: [
      {
        id: "main",
        groupChat: {
          historyLimit: 50,
          mentionPatterns: ["@?openclaw", "\\+?15555550123"],
        },
      },
    ],
  },
}
```

Notas:

- Las regex no distinguen mayusculas y minusculas; cubren una mencion por nombre visible como `@openclaw` y el numero en bruto con o sin `+`/espacios.
- WhatsApp aun envia menciones canonicas mediante `mentionedJids` cuando alguien toca el contacto, por lo que el respaldo por numero rara vez es necesario, pero es una red de seguridad util.

### Comando de activacion (solo propietario)

Use el comando del chat grupal:

- `/activation mention`
- `/activation always`

Solo el numero del propietario (desde `channels.whatsapp.allowFrom`, o el E.164 del propio bot cuando no se establece) puede cambiar esto. Envie `/status` como un mensaje independiente en el grupo para ver el modo de activacion actual.

## Como usar

1. Agregue su cuenta de WhatsApp (la que ejecuta OpenClaw) al grupo.
2. Diga `@openclaw …` (o incluya el numero). Solo los remitentes en la lista de permitidos pueden activarlo a menos que establezca `groupPolicy: "open"`.
3. El prompt del agente incluira el contexto reciente del grupo mas el marcador final `[from: …]` para que pueda dirigirse a la persona correcta.
4. Las directivas a nivel de sesion (`/verbose on`, `/think high`, `/new` o `/reset`, `/compact`) se aplican solo a la sesion de ese grupo; envielas como mensajes independientes para que se registren. Su sesion personal de Mensaje directo permanece independiente.

## Pruebas / verificacion

- Prueba manual rapida:
  - Envie una mencion `@openclaw` en el grupo y confirme una respuesta que haga referencia al nombre del remitente.
  - Envie una segunda mencion y verifique que el bloque de historial se incluya y luego se borre en el siguiente turno.
- Revise los registros del Gateway (ejecute con `--verbose`) para ver entradas `inbound web message` que muestren `from: <groupJid>` y el sufijo `[from: …]`.

## Consideraciones conocidas

- Los heartbeats se omiten intencionalmente en grupos para evitar transmisiones ruidosas.
- La supresion de eco usa la cadena combinada del lote; si envia el mismo texto dos veces sin menciones, solo la primera obtendra respuesta.
- Las entradas del almacenamiento de sesiones apareceran como `agent:<agentId>:whatsapp:group:<jid>` en el almacenamiento de sesiones (`~/.openclaw/agents/<agentId>/sessions/sessions.json` de forma predeterminada); una entrada faltante solo significa que el grupo aun no ha activado una ejecucion.
- Los indicadores de escritura en grupos siguen `agents.defaults.typingMode` (predeterminado: `message` cuando no hay mencion).
