---
summary: "Reaktionssemantik, die kanalübergreifend geteilt wird"
read_when:
  - Arbeit an Reaktionen in einem beliebigen Kanal
title: "Reaktionen"
x-i18n:
  source_path: tools/reactions.md
  source_hash: 0f11bff9adb4bd02
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:44Z
---

# Reaktionswerkzeuge

Geteilte Reaktionssemantik über Kanäle hinweg:

- `emoji` ist erforderlich, wenn eine Reaktion hinzugefügt wird.
- `emoji=""` entfernt die Reaktion(en) des Bots, sofern unterstützt.
- `remove: true` entfernt das angegebene Emoji, sofern unterstützt (erfordert `emoji`).

Kanalhinweise:

- **Discord/Slack**: Ein leeres `emoji` entfernt alle Reaktionen des Bots auf der Nachricht; `remove: true` entfernt nur dieses Emoji.
- **Google Chat**: Ein leeres `emoji` entfernt die Reaktionen der App auf der Nachricht; `remove: true` entfernt nur dieses Emoji.
- **Telegram**: Ein leeres `emoji` entfernt die Reaktionen des Bots; `remove: true` entfernt ebenfalls Reaktionen, erfordert jedoch weiterhin ein nicht leeres `emoji` für die Werkzeugvalidierung.
- **WhatsApp**: Ein leeres `emoji` entfernt die Bot-Reaktion; `remove: true` wird auf ein leeres Emoji abgebildet (erfordert weiterhin `emoji`).
- **Signal**: Eingehende Reaktionsbenachrichtigungen geben Systemereignisse aus, wenn `channels.signal.reactionNotifications` aktiviert ist.
