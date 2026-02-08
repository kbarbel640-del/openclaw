---
summary: "Referencia de la CLI para `openclaw cron` (programar y ejecutar trabajos en segundo plano)"
read_when:
  - Quiere trabajos programados y activaciones
  - Está depurando la ejecución de cron y los registros
title: "cron"
x-i18n:
  source_path: cli/cron.md
  source_hash: cef64f2ac4a648d4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:15Z
---

# `openclaw cron`

Administre trabajos cron para el programador del Gateway.

Relacionado:

- Trabajos cron: [Trabajos cron](/automation/cron-jobs)

Consejo: ejecute `openclaw cron --help` para ver el conjunto completo de comandos.

Nota: los trabajos aislados `cron add` usan por defecto la entrega `--announce`. Use `--no-deliver` para mantener la salida interna. `--deliver` permanece como un alias obsoleto de `--announce`.

Nota: los trabajos de una sola ejecución (`--at`) se eliminan después del éxito de forma predeterminada. Use `--keep-after-run` para conservarlos.

## Ediciones comunes

Actualice la configuración de entrega sin cambiar el mensaje:

```bash
openclaw cron edit <job-id> --announce --channel telegram --to "123456789"
```

Deshabilite la entrega para un trabajo aislado:

```bash
openclaw cron edit <job-id> --no-deliver
```

Anuncie en un canal específico:

```bash
openclaw cron edit <job-id> --announce --channel slack --to "channel:C1234567890"
```
