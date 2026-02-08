---
summary: "Referencia de la CLI para `openclaw system` (eventos del sistema, latido, presencia)"
read_when:
  - Quiere encolar un evento del sistema sin crear un trabajo cron
  - Necesita habilitar o deshabilitar los latidos
  - Quiere inspeccionar las entradas de presencia del sistema
title: "sistema"
x-i18n:
  source_path: cli/system.md
  source_hash: 36ae5dbdec327f5a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:22Z
---

# `openclaw system`

Ayudantes a nivel de sistema para el Gateway: encolar eventos del sistema, controlar los latidos,
y ver la presencia.

## Comandos comunes

```bash
openclaw system event --text "Check for urgent follow-ups" --mode now
openclaw system heartbeat enable
openclaw system heartbeat last
openclaw system presence
```

## `system event`

Encola un evento del sistema en la sesión **main**. El próximo latido lo inyectará
como una línea `System:` en el prompt. Use `--mode now` para activar el latido
de inmediato; `next-heartbeat` espera al siguiente tick programado.

Banderas:

- `--text <text>`: texto del evento del sistema requerido.
- `--mode <mode>`: `now` o `next-heartbeat` (predeterminado).
- `--json`: salida legible por máquina.

## `system heartbeat last|enable|disable`

Controles de latido:

- `last`: muestra el último evento de latido.
- `enable`: vuelve a activar los latidos (úselo si estaban deshabilitados).
- `disable`: pausa los latidos.

Banderas:

- `--json`: salida legible por máquina.

## `system presence`

Enumera las entradas actuales de presencia del sistema que el Gateway conoce (nodos,
instancias y líneas de estado similares).

Banderas:

- `--json`: salida legible por máquina.

## Notas

- Requiere un Gateway en ejecución accesible mediante su configuración actual (local o remota).
- Los eventos del sistema son efímeros y no se conservan entre reinicios.
