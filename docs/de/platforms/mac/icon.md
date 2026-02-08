---
summary: "Zustände und Animationen des Menüleistensymbols für OpenClaw unter macOS"
read_when:
  - Ändern des Verhaltens des Menüleistensymbols
title: "Menüleistensymbol"
x-i18n:
  source_path: platforms/mac/icon.md
  source_hash: a67a6e6bbdc2b611
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:02Z
---

# Zustände des Menüleistensymbols

Autor: steipete · Aktualisiert: 2025-12-06 · Geltungsbereich: macOS-App (`apps/macos`)

- **Leerlauf:** Normale Symbolanimation (Blinken, gelegentliches Wackeln).
- **Pausiert:** Status-Item verwendet `appearsDisabled`; keine Bewegung.
- **Sprach-Trigger (große Ohren):** Der Sprach-Wake-Detektor ruft `AppState.triggerVoiceEars(ttl: nil)` auf, wenn das Aktivierungswort erkannt wird, und hält `earBoostActive=true`, während die Äußerung erfasst wird. Die Ohren skalieren nach oben (1,9×), erhalten aus Gründen der Lesbarkeit kreisförmige Ohröffnungen und fallen dann über `stopVoiceEars()` nach 1 s Stille wieder ab. Wird nur aus der In-App-Sprachpipeline ausgelöst.
- **Arbeitend (Agent läuft):** `AppState.isWorking=true` steuert eine Mikrobewegung „Schwanz-/Bein-Gehuschel“: schnelleres Beinwackeln und eine leichte Versetzung, während Arbeit in Ausführung ist. Derzeit rund um WebChat-Agent-Läufe umgeschaltet; fügen Sie denselben Toggle bei anderen langen Aufgaben hinzu, wenn Sie diese anbinden.

Anbindungspunkte

- Sprach-Wake: Laufzeit/Tester ruft bei Auslösung `AppState.triggerVoiceEars(ttl: nil)` auf und nach 1 s Stille `stopVoiceEars()`, um dem Erfassungsfenster zu entsprechen.
- Agentenaktivität: Setzen Sie `AppStateStore.shared.setWorking(true/false)` um Arbeitsabschnitte (bereits im WebChat-Agentenaufruf umgesetzt). Halten Sie Abschnitte kurz und setzen Sie in `defer`-Blöcken zurück, um festhängende Animationen zu vermeiden.

Formen & Größen

- Basissymbol gezeichnet in `CritterIconRenderer.makeIcon(blink:legWiggle:earWiggle:earScale:earHoles:)`.
- Ohrskalierung standardmäßig `1.0`; der Sprach-Boost setzt `earScale=1.9` und schaltet `earHoles=true` um, ohne den Gesamtrahmen zu ändern (18×18 pt Vorlagenbild, gerendert in einen 36×36 px Retina-Backing-Store).
- Das Gehuschle nutzt Beinwackeln bis ~1,0 mit einer kleinen horizontalen Bewegung; es ist additiv zu jedem bestehenden Leerlauf-Wackeln.

Verhaltenshinweise

- Kein externer CLI-/Broker-Toggle für Ohren/Arbeitend; halten Sie dies intern an die eigenen Signale der App gebunden, um unbeabsichtigtes Flattern zu vermeiden.
- Halten Sie TTLs kurz (&lt;10 s), damit das Symbol schnell zur Basislinie zurückkehrt, falls ein Auftrag hängt.
