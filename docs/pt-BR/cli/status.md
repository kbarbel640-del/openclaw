---
summary: "Referencia de CLI para `openclaw status` (diagnosticos, verificacoes e snapshots de uso)"
read_when:
  - Voce quer um diagnostico rapido da saude dos canais + destinatarios de sessoes recentes
  - Voce quer um status “completo” colavel para depuracao
title: "status"
x-i18n:
  source_path: cli/status.md
  source_hash: 2bbf5579c48034fc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:50Z
---

# `openclaw status`

Diagnosticos para canais + sessoes.

```bash
openclaw status
openclaw status --all
openclaw status --deep
openclaw status --usage
```

Notas:

- `--deep` executa verificacoes ao vivo (WhatsApp Web + Telegram + Discord + Google Chat + Slack + Signal).
- A saida inclui armazenamentos de sessao por agente quando varios agentes estao configurados.
- A visao geral inclui o status de instalacao/execucao do Gateway + servico de host do node quando disponivel.
- A visao geral inclui o canal de atualizacao + git SHA (para checkouts de codigo-fonte).
- As informacoes de atualizacao aparecem na Visao geral; se uma atualizacao estiver disponivel, o status imprime uma dica para executar `openclaw update` (veja [Updating](/install/updating)).
