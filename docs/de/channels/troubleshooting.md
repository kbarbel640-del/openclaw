---
summary: "Kanalspezifische Troubleshooting-Kurzinfos (Discord/Telegram/WhatsApp)"
read_when:
  - Ein Kanal verbindet sich, aber Nachrichten fließen nicht
  - Untersuchung einer Kanal-Fehlkonfiguration (Intents, Berechtigungen, Datenschutzmodus)
title: "Kanal-Fehlerbehebung"
x-i18n:
  source_path: channels/troubleshooting.md
  source_hash: 6542ee86b3e50929
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:26Z
---

# Kanal-Fehlerbehebung

Beginnen Sie mit:

```bash
openclaw doctor
openclaw channels status --probe
```

`channels status --probe` gibt Warnungen aus, wenn häufige Kanal-Fehlkonfigurationen erkannt werden können, und enthält kleine Live-Prüfungen (Zugangsdaten, einige Berechtigungen/Mitgliedschaften).

## Kanäle

- Discord: [/channels/discord#troubleshooting](/channels/discord#troubleshooting)
- Telegram: [/channels/telegram#troubleshooting](/channels/telegram#troubleshooting)
- WhatsApp: [/channels/whatsapp#troubleshooting-quick](/channels/whatsapp#troubleshooting-quick)

## Telegram – schnelle Lösungen

- Logs zeigen `HttpError: Network request for 'sendMessage' failed` oder `sendChatAction` → prüfen Sie IPv6-DNS. Wenn `api.telegram.org` zuerst zu IPv6 auflöst und der Host keinen IPv6-Egress hat, erzwingen Sie IPv4 oder aktivieren Sie IPv6. Siehe [/channels/telegram#troubleshooting](/channels/telegram#troubleshooting).
- Logs zeigen `setMyCommands failed` → prüfen Sie ausgehendes HTTPS und die DNS-Erreichbarkeit zu `api.telegram.org` (häufig bei stark eingeschränkten VPS oder Proxys).
