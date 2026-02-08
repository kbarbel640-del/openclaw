---
summary: "Manejo de fecha y hora a través de sobres, prompts, herramientas y conectores"
read_when:
  - Usted está cambiando cómo se muestran las marcas de tiempo al modelo o a los usuarios
  - Usted está depurando el formato de hora en mensajes o en la salida del prompt del sistema
title: "Fecha y Hora"
x-i18n:
  source_path: date-time.md
  source_hash: 753af5946a006215
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:45Z
---

# Fecha y Hora

OpenClaw usa por defecto **hora local del host para las marcas de tiempo de transporte** y **zona horaria del usuario solo en el prompt del sistema**.
Las marcas de tiempo del proveedor se preservan para que las herramientas mantengan su semántica nativa (la hora actual está disponible mediante `session_status`).

## Sobres de mensajes (local por defecto)

Los mensajes entrantes se envuelven con una marca de tiempo (precisión de minutos):

```
[Provider ... 2026-01-05 16:26 PST] message text
```

Esta marca de tiempo del sobre es **local del host por defecto**, independientemente de la zona horaria del proveedor.

Puede sobrescribir este comportamiento:

```json5
{
  agents: {
    defaults: {
      envelopeTimezone: "local", // "utc" | "local" | "user" | IANA timezone
      envelopeTimestamp: "on", // "on" | "off"
      envelopeElapsed: "on", // "on" | "off"
    },
  },
}
```

- `envelopeTimezone: "utc"` usa UTC.
- `envelopeTimezone: "local"` usa la zona horaria del host.
- `envelopeTimezone: "user"` usa `agents.defaults.userTimezone` (vuelve a la zona horaria del host).
- Use una zona horaria IANA explícita (por ejemplo, `"America/Chicago"`) para una zona fija.
- `envelopeTimestamp: "off"` elimina las marcas de tiempo absolutas de los encabezados del sobre.
- `envelopeElapsed: "off"` elimina los sufijos de tiempo transcurrido (el estilo `+2m`).

### Ejemplos

**Local (por defecto):**

```
[WhatsApp +1555 2026-01-18 00:19 PST] hello
```

**Zona horaria del usuario:**

```
[WhatsApp +1555 2026-01-18 00:19 CST] hello
```

**Tiempo transcurrido habilitado:**

```
[WhatsApp +1555 +30s 2026-01-18T05:19Z] follow-up
```

## Prompt del sistema: Fecha y Hora actuales

Si se conoce la zona horaria del usuario, el prompt del sistema incluye una sección dedicada de
**Fecha y Hora actuales** solo con la **zona horaria** (sin reloj/formato de hora)
para mantener estable el caché del prompt:

```
Time zone: America/Chicago
```

Cuando el agente necesita la hora actual, use la herramienta `session_status`; la tarjeta de estado
incluye una línea de marca de tiempo.

## Líneas de eventos del sistema (local por defecto)

Los eventos del sistema en cola insertados en el contexto del agente se prefijan con una marca de tiempo usando la
misma selección de zona horaria que los sobres de mensajes (por defecto: local del host).

```
System: [2026-01-12 12:19:17 PST] Model switched.
```

### Configurar zona horaria del usuario + formato

```json5
{
  agents: {
    defaults: {
      userTimezone: "America/Chicago",
      timeFormat: "auto", // auto | 12 | 24
    },
  },
}
```

- `userTimezone` establece la **zona horaria local del usuario** para el contexto del prompt.
- `timeFormat` controla la **visualización de 12h/24h** en el prompt. `auto` sigue las preferencias del SO.

## Detección de formato de hora (automática)

Cuando `timeFormat: "auto"`, OpenClaw inspecciona la preferencia del SO (macOS/Windows)
y vuelve al formato de la configuración regional. El valor detectado se **almacena en caché por proceso**
para evitar llamadas repetidas al sistema.

## Cargas útiles de herramientas + conectores (hora cruda del proveedor + campos normalizados)

Las herramientas de canal devuelven **marcas de tiempo nativas del proveedor** y agregan campos normalizados para consistencia:

- `timestampMs`: milisegundos de época (UTC)
- `timestampUtc`: cadena ISO 8601 UTC

Los campos crudos del proveedor se preservan para que no se pierda nada.

- Slack: cadenas tipo época desde la API
- Discord: marcas de tiempo ISO UTC
- Telegram/WhatsApp: marcas de tiempo numéricas/ISO específicas del proveedor

Si necesita hora local, conviértala aguas abajo usando la zona horaria conocida.

## Documentos relacionados

- [System Prompt](/concepts/system-prompt)
- [Timezones](/concepts/timezone)
- [Messages](/concepts/messages)
