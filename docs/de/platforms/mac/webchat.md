---
summary: „Wie die macOS‑App den Gateway‑WebChat einbettet und wie Sie ihn debuggen“
read_when:
  - Debugging der macOS‑WebChat‑Ansicht oder des Loopback‑Ports
title: „WebChat“
x-i18n:
  source_path: platforms/mac/webchat.md
  source_hash: 04ff448758e53009
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:03Z
---

# WebChat (macOS‑App)

Die macOS‑Menüleisten‑App bettet die WebChat‑UI als native SwiftUI‑Ansicht ein. Sie
stellt eine Verbindung zum Gateway her und verwendet standardmäßig die **Hauptsitzung**
für den ausgewählten Agenten (mit einem Sitzungsumschalter für andere Sitzungen).

- **Lokaler Modus**: verbindet sich direkt mit dem lokalen Gateway‑WebSocket.
- **Remote‑Modus**: leitet den Gateway‑Kontrollport über SSH weiter und nutzt diesen
  Tunnel als Datenebene.

## Start & Debugging

- Manuell: Lobster‑Menü → „Chat öffnen“.
- Automatisches Öffnen für Tests:
  ```bash
  dist/OpenClaw.app/Contents/MacOS/OpenClaw --webchat
  ```
- Logs: `./scripts/clawlog.sh` (Subsystem `bot.molt`, Kategorie `WebChatSwiftUI`).

## Wie es verdrahtet ist

- Datenebene: Gateway‑WS‑Methoden `chat.history`, `chat.send`, `chat.abort`,
  `chat.inject` und Ereignisse `chat`, `agent`, `presence`, `tick`, `health`.
- Sitzung: standardmäßig die primäre Sitzung (`main` oder `global`, wenn der Geltungsbereich
  global ist). Die UI kann zwischen Sitzungen wechseln.
- Die Einführung verwendet eine dedizierte Sitzung, um die Ersteinrichtung getrennt zu halten.

## Sicherheitsoberfläche

- Der Remote‑Modus leitet ausschließlich den Gateway‑WebSocket‑Kontrollport über SSH weiter.

## Bekannte Einschränkungen

- Die UI ist für Chatsitzungen optimiert (keine vollständige Browser‑Sandbox).
