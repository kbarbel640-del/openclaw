---
summary: "Plataformas de mensajería a las que OpenClaw puede conectarse"
read_when:
  - Quiere elegir un canal de chat para OpenClaw
  - Necesita una vista general rápida de las plataformas de mensajería compatibles
title: "Canales de chat"
x-i18n:
  source_path: channels/index.md
  source_hash: 5269db02b77b1dc3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:56Z
---

# Canales de chat

OpenClaw puede hablar con usted en cualquier app de chat que ya use. Cada canal se conecta a través del Gateway.
El texto es compatible en todos; los medios y las reacciones varían según el canal.

## Canales compatibles

- [WhatsApp](/channels/whatsapp) — El más popular; usa Baileys y requiere emparejamiento por QR.
- [Telegram](/channels/telegram) — Bot API vía grammY; admite grupos.
- [Discord](/channels/discord) — Discord Bot API + Gateway; admite servidores, canales y Mensajes directos.
- [Slack](/channels/slack) — Bolt SDK; apps de espacio de trabajo.
- [Feishu](/channels/feishu) — Bot de Feishu/Lark vía WebSocket (plugin, instalado por separado).
- [Google Chat](/channels/googlechat) — App de Google Chat API vía webhook HTTP.
- [Mattermost](/channels/mattermost) — Bot API + WebSocket; canales, grupos y Mensajes directos (plugin, instalado por separado).
- [Signal](/channels/signal) — signal-cli; enfocado en la privacidad.
- [BlueBubbles](/channels/bluebubbles) — **Recomendado para iMessage**; usa la API REST del servidor macOS de BlueBubbles con soporte completo de funciones (editar, deshacer envío, efectos, reacciones, gestión de grupos — editar actualmente roto en macOS 26 Tahoe).
- [iMessage (legacy)](/channels/imessage) — Integración heredada de macOS vía imsg CLI (obsoleto; use BlueBubbles para nuevas configuraciones).
- [Microsoft Teams](/channels/msteams) — Bot Framework; soporte empresarial (plugin, instalado por separado).
- [LINE](/channels/line) — Bot de LINE Messaging API (plugin, instalado por separado).
- [Nextcloud Talk](/channels/nextcloud-talk) — Chat autoalojado vía Nextcloud Talk (plugin, instalado por separado).
- [Matrix](/channels/matrix) — Protocolo Matrix (plugin, instalado por separado).
- [Nostr](/channels/nostr) — Mensajes directos descentralizados vía NIP-04 (plugin, instalado por separado).
- [Tlon](/channels/tlon) — Mensajero basado en Urbit (plugin, instalado por separado).
- [Twitch](/channels/twitch) — Chat de Twitch vía conexión IRC (plugin, instalado por separado).
- [Zalo](/channels/zalo) — Zalo Bot API; el mensajero popular de Vietnam (plugin, instalado por separado).
- [Zalo Personal](/channels/zalouser) — Cuenta personal de Zalo vía inicio de sesión con QR (plugin, instalado por separado).
- [WebChat](/web/webchat) — Interfaz WebChat del Gateway sobre WebSocket.

## Notas

- Los canales pueden ejecutarse simultáneamente; configure varios y OpenClaw enrutará por chat.
- La configuración más rápida suele ser **Telegram** (token de bot simple). WhatsApp requiere emparejamiento por QR y
  almacena más estado en disco.
- El comportamiento de grupos varía según el canal; consulte [Groups](/concepts/groups).
- El emparejamiento de Mensajes directos y las listas de permitidos se aplican por seguridad; consulte [Security](/gateway/security).
- Internos de Telegram: [notas de grammY](/channels/grammy).
- Solución de problemas: [Solución de problemas de canales](/channels/troubleshooting).
- Los proveedores de modelos se documentan por separado; consulte [Model Providers](/providers/models).
