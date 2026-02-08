---
summary: "Modo de ejecución elevado y directivas /elevated"
read_when:
  - Ajustar los valores predeterminados del modo elevado, las allowlists o el comportamiento de los comandos con barra
title: "Modo Elevado"
x-i18n:
  source_path: tools/elevated.md
  source_hash: 83767a0160930402
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:13Z
---

# Modo Elevado (/elevated directives)

## Qué hace

- `/elevated on` se ejecuta en el host del gateway y mantiene las aprobaciones de exec (igual que `/elevated ask`).
- `/elevated full` se ejecuta en el host del gateway **y** aprueba automáticamente exec (omite las aprobaciones de exec).
- `/elevated ask` se ejecuta en el host del gateway pero mantiene las aprobaciones de exec (igual que `/elevated on`).
- `on`/`ask` **no** fuerzan `exec.security=full`; la política de seguridad/consulta configurada sigue aplicando.
- Solo cambia el comportamiento cuando el agente está **en sandbox** (de lo contrario, exec ya se ejecuta en el host).
- Formas de directiva: `/elevated on|off|ask|full`, `/elev on|off|ask|full`.
- Solo se aceptan `on|off|ask|full`; cualquier otra cosa devuelve una sugerencia y no cambia el estado.

## Qué controla (y qué no)

- **Puertas de disponibilidad**: `tools.elevated` es la línea base global. `agents.list[].tools.elevated` puede restringir aún más lo elevado por agente (ambos deben permitirlo).
- **Estado por sesión**: `/elevated on|off|ask|full` establece el nivel elevado para la clave de sesión actual.
- **Directiva en línea**: `/elevated on|ask|full` dentro de un mensaje se aplica solo a ese mensaje.
- **Grupos**: En chats grupales, las directivas elevadas solo se respetan cuando se menciona al agente. Los mensajes solo de comandos que omiten los requisitos de mención se tratan como mencionados.
- **Ejecución en el host**: elevado fuerza `exec` en el host del gateway; `full` también establece `security=full`.
- **Aprobaciones**: `full` omite las aprobaciones de exec; `on`/`ask` las respetan cuando las reglas de allowlist/consulta lo requieren.
- **Agentes no en sandbox**: sin efecto para la ubicación; solo afecta a la habilitación, el registro y el estado.
- **La política de herramientas sigue aplicando**: si `exec` está denegado por la política de herramientas, no se puede usar elevado.
- **Separado de `/exec`**: `/exec` ajusta los valores predeterminados por sesión para remitentes autorizados y no requiere elevado.

## Orden de resolución

1. Directiva en línea en el mensaje (se aplica solo a ese mensaje).
2. Anulación de sesión (establecida enviando un mensaje solo con la directiva).
3. Valor predeterminado global (`agents.defaults.elevatedDefault` en la configuracion).

## Establecer un valor predeterminado de sesión

- Envíe un mensaje que sea **solo** la directiva (se permiten espacios en blanco), p. ej., `/elevated full`.
- Se envía una respuesta de confirmación (`Elevated mode set to full...` / `Elevated mode disabled.`).
- Si el acceso elevado está deshabilitado o el remitente no está en la allowlist aprobada, la directiva responde con un error accionable y no cambia el estado de la sesión.
- Envíe `/elevated` (o `/elevated:`) sin argumento para ver el nivel elevado actual.

## Disponibilidad + allowlists

- Puerta de la función: `tools.elevated.enabled` (el valor predeterminado puede estar desactivado vía configuracion incluso si el código lo admite).
- Allowlist de remitentes: `tools.elevated.allowFrom` con allowlists por proveedor (p. ej., `discord`, `whatsapp`).
- Puerta por agente: `agents.list[].tools.elevated.enabled` (opcional; solo puede restringir más).
- Allowlist por agente: `agents.list[].tools.elevated.allowFrom` (opcional; cuando se establece, el remitente debe coincidir con **ambas** allowlists global + por agente).
- Alternativa de Discord: si se omite `tools.elevated.allowFrom.discord`, se usa la lista `channels.discord.dm.allowFrom` como alternativa. Configure `tools.elevated.allowFrom.discord` (incluso `[]`) para sobrescribir. Las allowlists por agente **no** usan la alternativa.
- Todas las puertas deben aprobar; de lo contrario, elevado se trata como no disponible.

## Registro + estado

- Las llamadas de exec elevadas se registran a nivel info.
- El estado de la sesión incluye el modo elevado (p. ej., `elevated=ask`, `elevated=full`).
