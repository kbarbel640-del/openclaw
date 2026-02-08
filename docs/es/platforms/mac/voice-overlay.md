---
summary: "Ciclo de vida de la superposición de voz cuando se superponen la palabra de activación y pulsar para hablar"
read_when:
  - Ajustar el comportamiento de la superposición de voz
title: "Superposición de Voz"
x-i18n:
  source_path: platforms/mac/voice-overlay.md
  source_hash: 3be1a60aa7940b23
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:34Z
---

# Ciclo de vida de la superposición de voz (macOS)

Audiencia: colaboradores de la app macOS. Objetivo: mantener la superposición de voz predecible cuando se superponen la palabra de activación y pulsar para hablar.

### Intención actual

- Si la superposición ya está visible por la palabra de activación y el usuario presiona la tecla rápida, la sesión de la tecla rápida _adopta_ el texto existente en lugar de restablecerlo. La superposición permanece visible mientras se mantiene presionada la tecla rápida. Cuando el usuario suelta: enviar si hay texto recortado; de lo contrario, descartar.
- Solo la palabra de activación sigue enviando automáticamente al detectar silencio; pulsar para hablar envía inmediatamente al soltar.

### Implementado (9 de diciembre de 2025)

- Las sesiones de superposición ahora llevan un token por captura (palabra de activación o pulsar para hablar). Las actualizaciones parciales/finales/enviar/descartar/nivel se descartan cuando el token no coincide, evitando callbacks obsoletos.
- Pulsar para hablar adopta cualquier texto visible de la superposición como prefijo (de modo que presionar la tecla rápida mientras la superposición de activación está visible conserva el texto y agrega el nuevo discurso). Espera hasta 1.5 s por una transcripción final antes de recurrir al texto actual.
- El registro de campanilla/superposición se emite en `info` en las categorías `voicewake.overlay`, `voicewake.ptt` y `voicewake.chime` (inicio de sesión, parcial, final, enviar, descartar, motivo de la campanilla).

### Próximos pasos

1. **VoiceSessionCoordinator (actor)**
   - Posee exactamente una `VoiceSession` a la vez.
   - API (basada en tokens): `beginWakeCapture`, `beginPushToTalk`, `updatePartial`, `endCapture`, `cancel`, `applyCooldown`.
   - Descarta callbacks que llevan tokens obsoletos (evita que reconocedores antiguos vuelvan a abrir la superposición).
2. **VoiceSession (modelo)**
   - Campos: `token`, `source` (wakeWord|pushToTalk), texto comprometido/volátil, banderas de campanilla, temporizadores (autoenvío, inactividad), `overlayMode` (display|editing|sending), fecha límite de enfriamiento.
3. **Vinculación de la superposición**
   - `VoiceSessionPublisher` (`ObservableObject`) refleja la sesión activa en SwiftUI.
   - `VoiceWakeOverlayView` renderiza solo a través del publicador; nunca muta directamente singletons globales.
   - Las acciones del usuario en la superposición (`sendNow`, `dismiss`, `edit`) llaman de vuelta al coordinador con el token de la sesión.
4. **Ruta unificada de envío**
   - En `endCapture`: si el texto recortado está vacío → descartar; de lo contrario `performSend(session:)` (reproduce la campanilla de envío una vez, reenvía y descarta).
   - Pulsar para hablar: sin demora; palabra de activación: demora opcional para autoenvío.
   - Aplicar un breve enfriamiento al runtime de activación después de que finalice pulsar para hablar para que la palabra de activación no se dispare inmediatamente.
5. **Registro**
   - El coordinador emite registros `.info` en el subsistema `bot.molt`, categorías `voicewake.overlay` y `voicewake.chime`.
   - Eventos clave: `session_started`, `adopted_by_push_to_talk`, `partial`, `finalized`, `send`, `dismiss`, `cancel`, `cooldown`.

### Lista de verificación de depuración

- Transmita los registros mientras reproduce una superposición persistente:

  ```bash
  sudo log stream --predicate 'subsystem == "bot.molt" AND category CONTAINS "voicewake"' --level info --style compact
  ```

- Verifique que solo haya un token de sesión activo; los callbacks obsoletos deben ser descartados por el coordinador.
- Asegúrese de que al soltar pulsar para hablar siempre se llame a `endCapture` con el token activo; si el texto está vacío, espere `dismiss` sin campanilla ni envío.

### Pasos de migración (sugeridos)

1. Agregar `VoiceSessionCoordinator`, `VoiceSession` y `VoiceSessionPublisher`.
2. Refactorizar `VoiceWakeRuntime` para crear/actualizar/finalizar sesiones en lugar de tocar `VoiceWakeOverlayController` directamente.
3. Refactorizar `VoicePushToTalk` para adoptar sesiones existentes y llamar a `endCapture` al soltar; aplicar enfriamiento del runtime.
4. Conectar `VoiceWakeOverlayController` al publicador; eliminar llamadas directas desde el runtime/PTT.
5. Agregar pruebas de integración para la adopción de sesiones, el enfriamiento y el descarte por texto vacío.
