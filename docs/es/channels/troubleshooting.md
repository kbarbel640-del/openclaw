---
summary: "Atajos de solucion de problemas especificos por canal (Discord/Telegram/WhatsApp)"
read_when:
  - Un canal se conecta pero los mensajes no fluyen
  - Investigando una mala configuracion del canal (intents, permisos, modo de privacidad)
title: "Solucion de problemas de canales"
x-i18n:
  source_path: channels/troubleshooting.md
  source_hash: 6542ee86b3e50929
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:59Z
---

# Solucion de problemas de canales

Comience con:

```bash
openclaw doctor
openclaw channels status --probe
```

`channels status --probe` imprime advertencias cuando puede detectar configuraciones incorrectas comunes de los canales, e incluye pequeñas comprobaciones en vivo (credenciales, algunos permisos/membresia).

## Canales

- Discord: [/channels/discord#troubleshooting](/channels/discord#troubleshooting)
- Telegram: [/channels/telegram#troubleshooting](/channels/telegram#troubleshooting)
- WhatsApp: [/channels/whatsapp#troubleshooting-quick](/channels/whatsapp#troubleshooting-quick)

## Correcciones rapidas de Telegram

- Los registros muestran `HttpError: Network request for 'sendMessage' failed` o `sendChatAction` → verifique el DNS IPv6. Si `api.telegram.org` se resuelve primero a IPv6 y el host no tiene salida IPv6, fuerce IPv4 o habilite IPv6. Vea [/channels/telegram#troubleshooting](/channels/telegram#troubleshooting).
- Los registros muestran `setMyCommands failed` → verifique la conectividad HTTPS saliente y el alcance de DNS hacia `api.telegram.org` (comun en VPS con restricciones o proxies).
