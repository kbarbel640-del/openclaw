---
summary: "Lebenszyklus des Sprach-Overlays, wenn Aktivierungswort und Push-to-Talk sich überschneiden"
read_when:
  - Anpassen des Verhaltens des Sprach-Overlays
title: "Sprach-Overlay"
x-i18n:
  source_path: platforms/mac/voice-overlay.md
  source_hash: 3be1a60aa7940b23
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:06Z
---

# Lebenszyklus des Sprach-Overlays (macOS)

Zielgruppe: Mitwirkende an der macOS-App. Ziel: Das Sprach-Overlay vorhersehbar halten, wenn Aktivierungswort und Push-to-Talk sich überschneiden.

### Aktuelle Absicht

- Wenn das Overlay bereits durch das Aktivierungswort sichtbar ist und der Benutzer die Hotkey-Taste drückt, _übernimmt_ die Hotkey-Sitzung den bestehenden Text, anstatt ihn zurückzusetzen. Das Overlay bleibt sichtbar, solange der Hotkey gedrückt ist. Beim Loslassen: Senden, wenn getrimmter Text vorhanden ist, andernfalls schließen.
- Nur Aktivierungswort sendet weiterhin automatisch bei Stille; Push-to-Talk sendet sofort beim Loslassen.

### Implementiert (9. Dez. 2025)

- Overlay-Sitzungen tragen jetzt pro Aufnahme (Aktivierungswort oder Push-to-Talk) ein Token. Teil-/Final-/Senden-/Schließen-/Pegel-Updates werden verworfen, wenn das Token nicht übereinstimmt, wodurch veraltete Callbacks vermieden werden.
- Push-to-Talk übernimmt jeden sichtbaren Overlay-Text als Präfix (sodass das Drücken des Hotkeys, während das Wake-Overlay aktiv ist, den Text beibehält und neue Sprache anhängt). Es wartet bis zu 1,5 s auf ein finales Transkript, bevor es auf den aktuellen Text zurückfällt.
- Chime-/Overlay-Logging wird unter `info` in den Kategorien `voicewake.overlay`, `voicewake.ptt` und `voicewake.chime` ausgegeben (Sitzungsstart, Teil, Final, Senden, Schließen, Chime-Grund).

### Nächste Schritte

1. **VoiceSessionCoordinator (Actor)**
   - Besitzt zu jedem Zeitpunkt genau eine `VoiceSession`.
   - API (tokenbasiert): `beginWakeCapture`, `beginPushToTalk`, `updatePartial`, `endCapture`, `cancel`, `applyCooldown`.
   - Verwirft Callbacks mit veralteten Tokens (verhindert, dass alte Recognizer das Overlay erneut öffnen).
2. **VoiceSession (Modell)**
   - Felder: `token`, `source` (wakeWord|pushToTalk), bestätigter/volatiler Text, Chime-Flags, Timer (Auto-Senden, Leerlauf), `overlayMode` (display|editing|sending), Cooldown-Deadline.
3. **Overlay-Bindung**
   - `VoiceSessionPublisher` (`ObservableObject`) spiegelt die aktive Sitzung in SwiftUI.
   - `VoiceWakeOverlayView` rendert ausschließlich über den Publisher; es mutiert niemals direkt globale Singletons.
   - Overlay-Benutzeraktionen (`sendNow`, `dismiss`, `edit`) rufen mit dem Sitzungs-Token in den Coordinator zurück.
4. **Vereinheitlichter Sendepfad**
   - Bei `endCapture`: wenn getrimmter Text leer ist → schließen; andernfalls `performSend(session:)` (spielt den Sende-Chime einmal ab, leitet weiter, schließt).
   - Push-to-Talk: keine Verzögerung; Aktivierungswort: optionale Verzögerung für Auto-Senden.
   - Wenden Sie nach Abschluss von Push-to-Talk einen kurzen Cooldown auf die Wake-Laufzeit an, damit das Aktivierungswort nicht sofort erneut auslöst.
5. **Logging**
   - Der Coordinator emittiert `.info`-Logs im Subsystem `bot.molt`, Kategorien `voicewake.overlay` und `voicewake.chime`.
   - Zentrale Ereignisse: `session_started`, `adopted_by_push_to_talk`, `partial`, `finalized`, `send`, `dismiss`, `cancel`, `cooldown`.

### Debugging-Checkliste

- Streamen Sie Logs, während Sie ein „hängendes“ Overlay reproduzieren:

  ```bash
  sudo log stream --predicate 'subsystem == "bot.molt" AND category CONTAINS "voicewake"' --level info --style compact
  ```

- Verifizieren Sie, dass nur ein aktives Sitzungs-Token existiert; veraltete Callbacks sollten vom Coordinator verworfen werden.
- Stellen Sie sicher, dass das Loslassen von Push-to-Talk immer `endCapture` mit dem aktiven Token aufruft; wenn der Text leer ist, erwarten Sie `dismiss` ohne Chime oder Senden.

### Migrationsschritte (empfohlen)

1. Fügen Sie `VoiceSessionCoordinator`, `VoiceSession` und `VoiceSessionPublisher` hinzu.
2. Refaktorieren Sie `VoiceWakeRuntime`, um Sitzungen zu erstellen/aktualisieren/beenden, anstatt `VoiceWakeOverlayController` direkt zu berühren.
3. Refaktorieren Sie `VoicePushToTalk`, um bestehende Sitzungen zu übernehmen und beim Loslassen `endCapture` aufzurufen; wenden Sie einen Laufzeit-Cooldown an.
4. Verdrahten Sie `VoiceWakeOverlayController` mit dem Publisher; entfernen Sie direkte Aufrufe aus Runtime/PTT.
5. Fügen Sie Integrationstests für Sitzungsübernahme, Cooldown und Schließen bei leerem Text hinzu.
