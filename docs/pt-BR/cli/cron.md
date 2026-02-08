---
summary: "Referencia da CLI para `openclaw cron` (agendar e executar jobs em segundo plano)"
read_when:
  - Voce quer jobs agendados e despertadores
  - Voce esta depurando a execucao do cron e os logs
title: "cron"
x-i18n:
  source_path: cli/cron.md
  source_hash: cef64f2ac4a648d4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:35Z
---

# `openclaw cron`

Gerencie jobs cron para o agendador do Gateway.

Relacionado:

- Jobs cron: [Cron jobs](/automation/cron-jobs)

Dica: execute `openclaw cron --help` para ver toda a superficie de comandos.

Nota: jobs `cron add` isolados usam como padrao a entrega `--announce`. Use `--no-deliver` para manter a saida interna. `--deliver` permanece como um alias obsoleto para `--announce`.

Nota: jobs one-shot (`--at`) sao excluidos apos o sucesso por padrao. Use `--keep-after-run` para mante-los.

## Edicoes comuns

Atualize as configuracoes de entrega sem alterar a mensagem:

```bash
openclaw cron edit <job-id> --announce --channel telegram --to "123456789"
```

Desative a entrega para um job isolado:

```bash
openclaw cron edit <job-id> --no-deliver
```

Anuncie em um canal especifico:

```bash
openclaw cron edit <job-id> --announce --channel slack --to "channel:C1234567890"
```
