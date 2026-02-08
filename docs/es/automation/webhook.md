---
summary: "Ingreso por webhook para activación y ejecuciones de agentes aisladas"
read_when:
  - Al agregar o cambiar endpoints de webhook
  - Al conectar sistemas externos en OpenClaw
title: "Webhooks"
x-i18n:
  source_path: automation/webhook.md
  source_hash: f26b88864567be82
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:56Z
---

# Webhooks

Gateway puede exponer un pequeño endpoint HTTP de webhook para activadores externos.

## Habilitar

```json5
{
  hooks: {
    enabled: true,
    token: "shared-secret",
    path: "/hooks",
  },
}
```

Notas:

- `hooks.token` es obligatorio cuando `hooks.enabled=true`.
- `hooks.path` tiene como valor predeterminado `/hooks`.

## Autenticación

Cada solicitud debe incluir el token del hook. Prefiera encabezados:

- `Authorization: Bearer <token>` (recomendado)
- `x-openclaw-token: <token>`
- `?token=<token>` (obsoleto; registra una advertencia y se eliminará en una futura versión mayor)

## Endpoints

### `POST /hooks/wake`

Carga útil:

```json
{ "text": "System line", "mode": "now" }
```

- `text` **obligatorio** (string): La descripción del evento (p. ej., "Nuevo correo recibido").
- `mode` opcional (`now` | `next-heartbeat`): Si se debe activar un heartbeat inmediato (predeterminado `now`) o esperar a la siguiente verificación periódica.

Efecto:

- Encola un evento del sistema para la sesión **principal**
- Si `mode=now`, activa un heartbeat inmediato

### `POST /hooks/agent`

Carga útil:

```json
{
  "message": "Run this",
  "name": "Email",
  "sessionKey": "hook:email:msg-123",
  "wakeMode": "now",
  "deliver": true,
  "channel": "last",
  "to": "+15551234567",
  "model": "openai/gpt-5.2-mini",
  "thinking": "low",
  "timeoutSeconds": 120
}
```

- `message` **obligatorio** (string): El prompt o mensaje para que el agente lo procese.
- `name` opcional (string): Nombre legible para humanos del hook (p. ej., "GitHub"), usado como prefijo en los resúmenes de sesión.
- `sessionKey` opcional (string): La clave usada para identificar la sesión del agente. De forma predeterminada es un `hook:<uuid>` aleatorio. Usar una clave consistente permite una conversación de múltiples turnos dentro del contexto del hook.
- `wakeMode` opcional (`now` | `next-heartbeat`): Si se debe activar un heartbeat inmediato (predeterminado `now`) o esperar a la siguiente verificación periódica.
- `deliver` opcional (boolean): Si `true`, la respuesta del agente se enviará al canal de mensajería. El valor predeterminado es `true`. Las respuestas que solo son acuses de recibo del heartbeat se omiten automáticamente.
- `channel` opcional (string): El canal de mensajería para la entrega. Uno de: `last`, `whatsapp`, `telegram`, `discord`, `slack`, `mattermost` (plugin), `signal`, `imessage`, `msteams`. El valor predeterminado es `last`.
- `to` opcional (string): El identificador del destinatario para el canal (p. ej., número de teléfono para WhatsApp/Signal, ID de chat para Telegram, ID de canal para Discord/Slack/Mattermost (plugin), ID de conversación para MS Teams). El valor predeterminado es el último destinatario en la sesión principal.
- `model` opcional (string): Anulación del modelo (p. ej., `anthropic/claude-3-5-sonnet` o un alias). Debe estar en la lista de modelos permitidos si hay restricciones.
- `thinking` opcional (string): Anulación del nivel de pensamiento (p. ej., `low`, `medium`, `high`).
- `timeoutSeconds` opcional (number): Duración máxima para la ejecución del agente en segundos.

Efecto:

- Ejecuta un turno de agente **aislado** (con su propia clave de sesión)
- Siempre publica un resumen en la sesión **principal**
- Si `wakeMode=now`, activa un heartbeat inmediato

### `POST /hooks/<name>` (mapeado)

Los nombres de hooks personalizados se resuelven mediante `hooks.mappings` (ver configuración). Un mapeo puede
convertir cargas útiles arbitrarias en acciones `wake` o `agent`, con plantillas opcionales o
transformaciones de código.

Opciones de mapeo (resumen):

- `hooks.presets: ["gmail"]` habilita el mapeo integrado de Gmail.
- `hooks.mappings` le permite definir `match`, `action` y plantillas en la configuración.
- `hooks.transformsDir` + `transform.module` carga un módulo JS/TS para lógica personalizada.
- Use `match.source` para mantener un endpoint de ingesta genérico (enrutamiento impulsado por la carga útil).
- Las transformaciones TS requieren un cargador TS (p. ej., `bun` o `tsx`) o `.js` precompilado en tiempo de ejecución.
- Configure `deliver: true` + `channel`/`to` en los mapeos para enrutar respuestas a una superficie de chat
  (`channel` tiene como valor predeterminado `last` y recurre a WhatsApp).
- `allowUnsafeExternalContent: true` deshabilita el envoltorio de seguridad de contenido externo para ese hook
  (peligroso; solo para fuentes internas de confianza).
- `openclaw webhooks gmail setup` escribe la configuración `hooks.gmail` para `openclaw webhooks gmail run`.
  Consulte [Gmail Pub/Sub](/automation/gmail-pubsub) para el flujo completo de observación de Gmail.

## Respuestas

- `200` para `/hooks/wake`
- `202` para `/hooks/agent` (ejecución asíncrona iniciada)
- `401` ante fallo de autenticación
- `400` ante carga útil inválida
- `413` ante cargas útiles sobredimensionadas

## Ejemplos

```bash
curl -X POST http://127.0.0.1:18789/hooks/wake \
  -H 'Authorization: Bearer SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"text":"New email received","mode":"now"}'
```

```bash
curl -X POST http://127.0.0.1:18789/hooks/agent \
  -H 'x-openclaw-token: SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Summarize inbox","name":"Email","wakeMode":"next-heartbeat"}'
```

### Usar un modelo diferente

Agregue `model` a la carga útil del agente (o al mapeo) para anular el modelo para esa ejecución:

```bash
curl -X POST http://127.0.0.1:18789/hooks/agent \
  -H 'x-openclaw-token: SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Summarize inbox","name":"Email","model":"openai/gpt-5.2-mini"}'
```

Si usted aplica `agents.defaults.models`, asegúrese de que el modelo de anulación esté incluido allí.

```bash
curl -X POST http://127.0.0.1:18789/hooks/gmail \
  -H 'Authorization: Bearer SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"source":"gmail","messages":[{"from":"Ada","subject":"Hello","snippet":"Hi"}]}'
```

## Seguridad

- Mantenga los endpoints de hooks detrás de loopback, tailnet o un proxy inverso de confianza.
- Use un token de hook dedicado; no reutilice tokens de autenticación del gateway.
- Evite incluir cargas útiles sin procesar y sensibles en los registros de webhooks.
- Las cargas útiles de hooks se tratan como no confiables y se envuelven con límites de seguridad de forma predeterminada.
  Si debe deshabilitar esto para un hook específico, configure `allowUnsafeExternalContent: true`
  en el mapeo de ese hook (peligroso).
