---
summary: "Messaging-Plattformen, mit denen OpenClaw sich verbinden kann"
read_when:
  - Sie moechten einen Chat-Kanal fuer OpenClaw auswaehlen
  - Sie benoetigen einen schnellen Ueberblick ueber unterstuetzte Messaging-Plattformen
title: "Chat-Kanaele"
x-i18n:
  source_path: channels/index.md
  source_hash: 5269db02b77b1dc3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:23Z
---

# Chat-Kanaele

OpenClaw kann mit Ihnen in jeder Chat-App sprechen, die Sie bereits verwenden. Jeder Kanal verbindet sich ueber das Gateway.
Text wird ueberall unterstuetzt; Medien und Reaktionen variieren je nach Kanal.

## Unterstuetzte Kanaele

- [WhatsApp](/channels/whatsapp) — Am populaersten; verwendet Baileys und erfordert QR-Kopplung.
- [Telegram](/channels/telegram) — Bot API ueber grammY; unterstuetzt Gruppen.
- [Discord](/channels/discord) — Discord Bot API + Gateway; unterstuetzt Server, Kanaele und Direktnachrichten.
- [Slack](/channels/slack) — Bolt SDK; Workspace-Apps.
- [Feishu](/channels/feishu) — Feishu/Lark-Bot ueber WebSocket (Plugin, separat installiert).
- [Google Chat](/channels/googlechat) — Google Chat API-App ueber HTTP-Webhook.
- [Mattermost](/channels/mattermost) — Bot API + WebSocket; Kanaele, Gruppen, Direktnachrichten (Plugin, separat installiert).
- [Signal](/channels/signal) — signal-cli; datenschutzorientiert.
- [BlueBubbles](/channels/bluebubbles) — **Empfohlen fuer iMessage**; verwendet die BlueBubbles-macOS-Server-REST-API mit voller Funktionsunterstuetzung (Bearbeiten, Zurueckziehen, Effekte, Reaktionen, Gruppenverwaltung — Bearbeiten derzeit auf macOS 26 Tahoe defekt).
- [iMessage (legacy)](/channels/imessage) — Legacy-macOS-Integration ueber imsg CLI (veraltet, verwenden Sie BlueBubbles fuer neue Setups).
- [Microsoft Teams](/channels/msteams) — Bot Framework; Enterprise-Unterstuetzung (Plugin, separat installiert).
- [LINE](/channels/line) — LINE Messaging API-Bot (Plugin, separat installiert).
- [Nextcloud Talk](/channels/nextcloud-talk) — Selbstgehosteter Chat ueber Nextcloud Talk (Plugin, separat installiert).
- [Matrix](/channels/matrix) — Matrix-Protokoll (Plugin, separat installiert).
- [Nostr](/channels/nostr) — Dezentrale Direktnachrichten ueber NIP-04 (Plugin, separat installiert).
- [Tlon](/channels/tlon) — Urbit-basierter Messenger (Plugin, separat installiert).
- [Twitch](/channels/twitch) — Twitch-Chat ueber IRC-Verbindung (Plugin, separat installiert).
- [Zalo](/channels/zalo) — Zalo Bot API; Vietnams beliebter Messenger (Plugin, separat installiert).
- [Zalo Personal](/channels/zalouser) — Zalo-Persoenliches Konto ueber QR-Login (Plugin, separat installiert).
- [WebChat](/web/webchat) — Gateway WebChat-UI ueber WebSocket.

## Hinweise

- Kanaele koennen gleichzeitig laufen; konfigurieren Sie mehrere, und OpenClaw leitet pro Chat weiter.
- Das schnellste Setup ist in der Regel **Telegram** (einfaches Bot-Token). WhatsApp erfordert QR-Kopplung und
  speichert mehr Status auf der Festplatte.
- Das Gruppenverhalten variiert je nach Kanal; siehe [Groups](/concepts/groups).
- Direktnachrichten-Kopplung und Allowlists werden aus Sicherheitsgruenden erzwungen; siehe [Security](/gateway/security).
- Telegram-Interna: [grammY notes](/channels/grammy).
- Fehlerbehebung: [Channel troubleshooting](/channels/troubleshooting).
- Modellanbieter sind separat dokumentiert; siehe [Model Providers](/providers/models).
