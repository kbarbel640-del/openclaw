---
summary: "Integration der Telegram Bot API über grammY mit Hinweisen zur Einrichtung"
read_when:
  - Arbeit an Telegram- oder grammY-Pfaden
title: grammY
x-i18n:
  source_path: channels/grammy.md
  source_hash: ea7ef23e6d77801f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:19Z
---

# grammY-Integration (Telegram Bot API)

# Warum grammY

- TS-first Bot-API-Client mit integrierten Long-Poll- und Webhook-Hilfen, Middleware, Fehlerbehandlung und Rate Limiter.
- Sauberere Medien-Helfer als manuelles Umsetzen mit fetch + FormData; unterstützt alle Bot-API-Methoden.
- Erweiterbar: Proxy-Unterstützung über benutzerdefiniertes fetch, Sitzungs-Middleware (optional), typsicherer Kontext.

# Was wir ausgeliefert haben

- **Einzelner Client-Pfad:** fetch-basierte Implementierung entfernt; grammY ist jetzt der einzige Telegram-Client (Senden + Gateway) mit standardmäßig aktiviertem grammY-Throttler.
- **Gateway:** `monitorTelegramProvider` erstellt einen grammY-`Bot`, verdrahtet Erwähnungs-/Allowlist-Gating, Medien-Download über `getFile`/`download` und liefert Antworten mit `sendMessage/sendPhoto/sendVideo/sendAudio/sendDocument`. Unterstützt Long-Poll oder Webhook über `webhookCallback`.
- **Proxy:** optionales `channels.telegram.proxy` verwendet `undici.ProxyAgent` über grammYs `client.baseFetch`.
- **Webhook-Unterstützung:** `webhook-set.ts` kapselt `setWebhook/deleteWebhook`; `webhook.ts` hostet den Callback mit Health-Checks + graceful shutdown. Das Gateway aktiviert den Webhook-Modus, wenn `channels.telegram.webhookUrl` + `channels.telegram.webhookSecret` gesetzt sind (ansonsten wird Long-Polling verwendet).
- **Sitzungen:** Direktchats werden in die Hauptsitzung des Agenten zusammengeführt (`agent:<agentId>:<mainKey>`); Gruppen verwenden `agent:<agentId>:telegram:group:<chatId>`; Antworten werden in denselben Kanal zurückgeleitet.
- **Konfigurationsoptionen:** `channels.telegram.botToken`, `channels.telegram.dmPolicy`, `channels.telegram.groups` (Allowlist + Erwähnungs-Defaults), `channels.telegram.allowFrom`, `channels.telegram.groupAllowFrom`, `channels.telegram.groupPolicy`, `channels.telegram.mediaMaxMb`, `channels.telegram.linkPreview`, `channels.telegram.proxy`, `channels.telegram.webhookSecret`, `channels.telegram.webhookUrl`.
- **Entwurfs-Streaming:** optionales `channels.telegram.streamMode` verwendet `sendMessageDraft` in privaten Topic-Chats (Bot API 9.3+). Dies ist getrennt vom Kanal-Block-Streaming.
- **Tests:** grammY-Mocks decken Direktnachrichten + Gruppen-Erwähnungs-Gating sowie ausgehendes Senden ab; weitere Medien-/Webhook-Fixtures sind weiterhin willkommen.

Offene Fragen

- Optionale grammY-Plugins (Throttler), falls wir auf Bot-API-429er stoßen.
- Mehr strukturierte Medientests hinzufügen (Sticker, Sprachnachrichten).
- Webhook-Listen-Port konfigurierbar machen (derzeit fest auf 8787 gesetzt, sofern nicht über das Gateway verdrahtet).
