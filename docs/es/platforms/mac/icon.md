---
summary: "Estados y animaciones del ícono de la barra de menús para OpenClaw en macOS"
read_when:
  - Cambiar el comportamiento del ícono de la barra de menús
title: "Ícono de la barra de menús"
x-i18n:
  source_path: platforms/mac/icon.md
  source_hash: a67a6e6bbdc2b611
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:29Z
---

# Estados del ícono de la barra de menús

Autor: steipete · Actualizado: 2025-12-06 · Alcance: app de macOS (`apps/macos`)

- **Inactivo:** Animación normal del ícono (parpadeo, leve contoneo ocasional).
- **En pausa:** El elemento de estado usa `appearsDisabled`; sin movimiento.
- **Disparador de voz (orejas grandes):** El detector de activación por voz llama a `AppState.triggerVoiceEars(ttl: nil)` cuando se oye la palabra de activación, manteniendo `earBoostActive=true` mientras se captura la locución. Las orejas se escalan (1.9x), obtienen orificios circulares para mejorar la legibilidad y luego descienden mediante `stopVoiceEars()` tras 1 s de silencio. Solo se activa desde el flujo de voz dentro de la app.
- **Trabajando (agente en ejecución):** `AppState.isWorking=true` impulsa un micromovimiento de “correteo de cola/patas”: mayor movimiento de patas y un ligero desplazamiento mientras el trabajo está en curso. Actualmente se alterna alrededor de ejecuciones del agente WebChat; agregue la misma alternancia alrededor de otras tareas largas cuando las conecte.

Puntos de conexión

- Activación por voz: la llamada runtime/tester invoca `AppState.triggerVoiceEars(ttl: nil)` al dispararse y `stopVoiceEars()` después de 1 s de silencio para coincidir con la ventana de captura.
- Actividad del agente: establezca `AppStateStore.shared.setWorking(true/false)` alrededor de los tramos de trabajo (ya hecho en la llamada del agente WebChat). Mantenga los tramos cortos y restablezca en bloques `defer` para evitar animaciones atascadas.

Formas y tamaños

- Ícono base dibujado en `CritterIconRenderer.makeIcon(blink:legWiggle:earWiggle:earScale:earHoles:)`.
- La escala de orejas predeterminada es `1.0`; el refuerzo por voz establece `earScale=1.9` y alterna `earHoles=true` sin cambiar el marco general (imagen plantilla de 18×18 pt renderizada en un backing store Retina de 36×36 px).
- El correteo usa un movimiento de patas de hasta ~1.0 con un pequeño vaivén horizontal; es aditivo a cualquier contoneo inactivo existente.

Notas de comportamiento

- No hay alternancia externa por CLI/broker para orejas/trabajo; manténgalo interno a las señales propias de la app para evitar activaciones accidentales.
- Mantenga TTL cortos (&lt;10 s) para que el ícono vuelva rápidamente a la línea base si un trabajo se queda colgado.
