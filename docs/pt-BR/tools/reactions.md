---
summary: "Semântica de reações compartilhada entre canais"
read_when:
  - Trabalhando com reações em qualquer canal
title: "Reações"
x-i18n:
  source_path: tools/reactions.md
  source_hash: 0f11bff9adb4bd02
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:36Z
---

# Ferramentas de reações

Semântica de reações compartilhada entre canais:

- `emoji` é obrigatório ao adicionar uma reação.
- `emoji=""` remove a(s) reação(ões) do bot quando suportado.
- `remove: true` remove o emoji especificado quando suportado (requer `emoji`).

Notas por canal:

- **Discord/Slack**: `emoji` vazio remove todas as reações do bot na mensagem; `remove: true` remove apenas esse emoji.
- **Google Chat**: `emoji` vazio remove as reações do app na mensagem; `remove: true` remove apenas esse emoji.
- **Telegram**: `emoji` vazio remove as reações do bot; `remove: true` também remove reações, mas ainda requer um `emoji` não vazio para validação da ferramenta.
- **WhatsApp**: `emoji` vazio remove a reação do bot; `remove: true` mapeia para emoji vazio (ainda requer `emoji`).
- **Signal**: notificações de reação de entrada emitem eventos de sistema quando `channels.signal.reactionNotifications` está habilitado.
