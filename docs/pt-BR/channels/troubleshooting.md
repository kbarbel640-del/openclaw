---
summary: "Atalhos de solucao de problemas especificos por canal (Discord/Telegram/WhatsApp)"
read_when:
  - Um canal conecta, mas as mensagens nao fluem
  - Investigando configuracao incorreta do canal (intents, permissoes, modo de privacidade)
title: "Solucao de problemas de canais"
x-i18n:
  source_path: channels/troubleshooting.md
  source_hash: 6542ee86b3e50929
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:25Z
---

# Solucao de problemas de canais

Comece com:

```bash
openclaw doctor
openclaw channels status --probe
```

`channels status --probe` imprime avisos quando consegue detectar configuracoes incorretas comuns de canais e inclui pequenas verificacoes ao vivo (credenciais, algumas permissoes/associacao).

## Canais

- Discord: [/channels/discord#troubleshooting](/channels/discord#troubleshooting)
- Telegram: [/channels/telegram#troubleshooting](/channels/telegram#troubleshooting)
- WhatsApp: [/channels/whatsapp#troubleshooting-quick](/channels/whatsapp#troubleshooting-quick)

## Correcoes rapidas do Telegram

- Os logs mostram `HttpError: Network request for 'sendMessage' failed` ou `sendChatAction` → verifique o DNS IPv6. Se `api.telegram.org` resolver primeiro para IPv6 e o host nao tiver saida IPv6, force IPv4 ou habilite IPv6. Veja [/channels/telegram#troubleshooting](/channels/telegram#troubleshooting).
- Os logs mostram `setMyCommands failed` → verifique a conectividade de HTTPS de saida e a resolucao DNS para `api.telegram.org` (comum em VPSs com restricoes ou proxies).
