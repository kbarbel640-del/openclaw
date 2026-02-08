---
summary: "Plataformas de mensagens às quais o OpenClaw pode se conectar"
read_when:
  - Você quer escolher um canal de chat para o OpenClaw
  - Você precisa de uma visão geral rápida das plataformas de mensagens suportadas
title: "Canais de Chat"
x-i18n:
  source_path: channels/index.md
  source_hash: 5269db02b77b1dc3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:15Z
---

# Canais de Chat

O OpenClaw pode falar com você em qualquer aplicativo de chat que você já usa. Cada canal se conecta por meio do Gateway.
Texto é suportado em todos; mídia e reações variam por canal.

## Canais suportados

- [WhatsApp](/channels/whatsapp) — Mais popular; usa Baileys e requer pareamento por QR.
- [Telegram](/channels/telegram) — Bot API via grammY; suporta grupos.
- [Discord](/channels/discord) — Discord Bot API + Gateway; suporta servidores, canais e mensagens diretas.
- [Slack](/channels/slack) — Bolt SDK; aplicativos de workspace.
- [Feishu](/channels/feishu) — Bot Feishu/Lark via WebSocket (plugin, instalado separadamente).
- [Google Chat](/channels/googlechat) — Aplicativo da Google Chat API via webhook HTTP.
- [Mattermost](/channels/mattermost) — Bot API + WebSocket; canais, grupos e mensagens diretas (plugin, instalado separadamente).
- [Signal](/channels/signal) — signal-cli; focado em privacidade.
- [BlueBubbles](/channels/bluebubbles) — **Recomendado para iMessage**; usa a API REST do servidor BlueBubbles no macOS com suporte completo de recursos (editar, desfazer envio, efeitos, reações, gerenciamento de grupos — editar atualmente quebrado no macOS 26 Tahoe).
- [iMessage (legado)](/channels/imessage) — Integração legada do macOS via CLI imsg (obsoleto; use BlueBubbles para novas configurações).
- [Microsoft Teams](/channels/msteams) — Bot Framework; suporte corporativo (plugin, instalado separadamente).
- [LINE](/channels/line) — Bot da LINE Messaging API (plugin, instalado separadamente).
- [Nextcloud Talk](/channels/nextcloud-talk) — Chat auto-hospedado via Nextcloud Talk (plugin, instalado separadamente).
- [Matrix](/channels/matrix) — Protocolo Matrix (plugin, instalado separadamente).
- [Nostr](/channels/nostr) — Mensagens diretas descentralizadas via NIP-04 (plugin, instalado separadamente).
- [Tlon](/channels/tlon) — Mensageiro baseado em Urbit (plugin, instalado separadamente).
- [Twitch](/channels/twitch) — Chat da Twitch via conexão IRC (plugin, instalado separadamente).
- [Zalo](/channels/zalo) — Zalo Bot API; mensageiro popular no Vietnã (plugin, instalado separadamente).
- [Zalo Personal](/channels/zalouser) — Conta pessoal do Zalo via login por QR (plugin, instalado separadamente).
- [WebChat](/web/webchat) — Interface WebChat do Gateway sobre WebSocket.

## Notas

- Os canais podem rodar simultaneamente; configure vários e o OpenClaw fará o roteamento por chat.
- A configuração mais rápida geralmente é **Telegram** (token de bot simples). O WhatsApp requer pareamento por QR e
  armazena mais estado em disco.
- O comportamento em grupos varia por canal; veja [Groups](/concepts/groups).
- Pareamento de mensagens diretas e allowlists são aplicados por segurança; veja [Security](/gateway/security).
- Internos do Telegram: [notas do grammY](/channels/grammy).
- Solução de problemas: [Solução de problemas de canais](/channels/troubleshooting).
- Provedores de modelo são documentados separadamente; veja [Model Providers](/providers/models).
