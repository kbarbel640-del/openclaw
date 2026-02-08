---
summary: "Comportamiento y configuracion para el manejo de mensajes de grupo de WhatsApp (los mentionPatterns se comparten entre superficies)"
read_when:
  - Cambiar reglas de mensajes de grupo o menciones
title: "Mensajes de grupo"
x-i18n:
  source_path: concepts/group-messages.md
  source_hash: 181a72f12f5021af
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:35Z
---

# Mensajes de grupo (canal web de WhatsApp)

Objetivo: permitir que Clawd esté en grupos de WhatsApp, se active solo cuando se le menciona y mantenga ese hilo separado de la sesion personal de Mensaje directo.

Nota: `agents.list[].groupChat.mentionPatterns` ahora también es usado por Telegram/Discord/Slack/iMessage; este documento se centra en el comportamiento específico de WhatsApp. Para configuraciones con múltiples agentes, establezca `agents.list[].groupChat.mentionPatterns` por agente (o use `messages.groupChat.mentionPatterns` como respaldo global).

## Qué está implementado (2025-12-03)

- Modos de activación: `mention` (predeterminado) o `always`. `mention` requiere una mención (menciones reales de WhatsApp con @ vía `mentionedJids`, patrones regex o el E.164 del bot en cualquier parte del texto). `always` activa al agente en cada mensaje, pero solo debe responder cuando pueda aportar valor significativo; de lo contrario devuelve el token silencioso `NO_REPLY`. Los valores predeterminados se pueden establecer en la configuracion (`channels.whatsapp.groups`) y sobrescribir por grupo mediante `/activation`. Cuando se establece `channels.whatsapp.groups`, también actúa como una lista de permitidos del grupo (incluya `"*"` para permitir a todos).
- Política de grupo: `channels.whatsapp.groupPolicy` controla si se aceptan mensajes de grupo (`open|disabled|allowlist`). `allowlist` usa `channels.whatsapp.groupAllowFrom` (respaldo: `channels.whatsapp.allowFrom` explícito). El valor predeterminado es `allowlist` (bloqueado hasta que agregue remitentes).
- Sesiones por grupo: las claves de sesion se ven como `agent:<agentId>:whatsapp:group:<jid>`, por lo que comandos como `/verbose on` o `/think high` (enviados como mensajes independientes) se limitan a ese grupo; el estado del Mensaje directo personal no se ve afectado. Los heartbeats se omiten para hilos de grupo.
- Inyección de contexto: los mensajes de grupo **solo pendientes** (predeterminado 50) que _no_ activaron una ejecución se anteponen bajo `[Chat messages since your last reply - for context]`, con la línea desencadenante bajo `[Current message - respond to this]`. Los mensajes que ya están en la sesion no se reinjectan.
- Exposición del remitente: cada lote de grupo ahora termina con `[from: Sender Name (+E164)]` para que Pi sepa quién está hablando.
- Efímeros/ver una vez: los desempaquetamos antes de extraer texto/menciones, por lo que las menciones dentro de ellos aún activan.
- Prompt del sistema para grupos: en el primer turno de una sesion de grupo (y cada vez que `/activation` cambia el modo) inyectamos un breve texto en el prompt del sistema como `You are replying inside the WhatsApp group "<subject>". Group members: Alice (+44...), Bob (+43...), … Activation: trigger-only … Address the specific sender noted in the message context.`. Si los metadatos no están disponibles, aun así indicamos al agente que es un chat grupal.

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

- Las regex no distinguen mayúsculas y minúsculas; cubren una mención por nombre visible como `@openclaw` y el número en bruto con o sin `+`/espacios.
- WhatsApp aún envía menciones canónicas vía `mentionedJids` cuando alguien toca el contacto, por lo que el respaldo por número rara vez es necesario, pero es una red de seguridad útil.

### Comando de activación (solo propietario)

Use el comando del chat grupal:

- `/activation mention`
- `/activation always`

Solo el número del propietario (desde `channels.whatsapp.allowFrom`, o el E.164 del propio bot cuando no está establecido) puede cambiar esto. Envíe `/status` como mensaje independiente en el grupo para ver el modo de activación actual.

## Cómo usar

1. Agregue su cuenta de WhatsApp (la que ejecuta OpenClaw) al grupo.
2. Diga `@openclaw …` (o incluya el número). Solo los remitentes en la lista de permitidos pueden activarlo, a menos que establezca `groupPolicy: "open"`.
3. El prompt del agente incluirá el contexto reciente del grupo más el marcador final `[from: …]` para que pueda dirigirse a la persona correcta.
4. Las directivas a nivel de sesion (`/verbose on`, `/think high`, `/new` o `/reset`, `/compact`) se aplican solo a la sesion de ese grupo; envíelas como mensajes independientes para que se registren. Su sesion personal de Mensaje directo permanece independiente.

## Pruebas / verificación

- Prueba manual rápida:
  - Envíe una mención `@openclaw` en el grupo y confirme una respuesta que haga referencia al nombre del remitente.
  - Envíe una segunda mención y verifique que el bloque de historial se incluya y luego se borre en el siguiente turno.
- Revise los registros del Gateway (ejecute con `--verbose`) para ver entradas `inbound web message` que muestren `from: <groupJid>` y el sufijo `[from: …]`.

## Consideraciones conocidas

- Los heartbeats se omiten intencionalmente para grupos para evitar transmisiones ruidosas.
- La supresión de eco usa la cadena de lote combinada; si envía texto idéntico dos veces sin menciones, solo el primero obtendrá una respuesta.
- Las entradas del almacén de sesiones aparecerán como `agent:<agentId>:whatsapp:group:<jid>` en el almacén de sesiones (`~/.openclaw/agents/<agentId>/sessions/sessions.json` de forma predeterminada); una entrada faltante solo significa que el grupo aún no ha activado una ejecución.
- Los indicadores de escritura en grupos siguen `agents.defaults.typingMode` (predeterminado: `message` cuando no hay mención).
